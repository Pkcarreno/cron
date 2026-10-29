# Investigación Técnica: Arquitectura de Audio y UX Sonoro para Timers HIIT / CrossFit

**Fecha:** Octubre 2026  
**Contexto del Proyecto:** Cron (Expo SDK 58 / React Native 0.88 / `react-native-audio-api` 0.13.6 / New Architecture / Hermes)  
**Objetivo:** Diagnosticar las causas raíz de la inconsistencia tímbrica y temporal en la reproducción de tonos actual, y definir el estándar de UX de sonido / psicoacústica para señalización crítica en entrenamientos de alta intensidad (estilo CrossFit / HIIT).

---

## 1. Diagnóstico de la Implementación Actual: Causas de la Inconsistencia

Al inspeccionar el servicio activo ([`services/audio/web-audio-oscillator-service.ts`](file:///home/pk/.t3/worktrees/cron/t3-85940740/services/audio/web-audio-oscillator-service.ts)), se observa que la arquitectura de clases y la separación de capas están limpias. Sin embargo, a nivel de **DSP (Procesamiento Digital de Señales)** y **programación de audio en tiempo real**, existen vulnerabilidades arquitectónicas directas que provocan que las notas no suenen idénticas ni en timbre ni en cadencia temporal.

```
Arquitectura Actual (Flujo Problemático):
[JS Event Loop] -> setTimeout / delay(ms) -> osc.start(now) / osc.stop(now + dur) -> Direct to Destination (Sin Gain)
      │                     │                                                            │
      ▼                     ▼                                                            ▼
Jitter de 20-150ms     Latencia asíncrona                                          Clicks y pops por
en intervalos          al reanudar Context                                        corte de fase DC
```

### 1.1. Causa Raíz Temporal: JS Event Loop (`setTimeout`) vs. Audio Hardware Clock

En `WebAudioOscillatorService`:

```typescript
public async playToneSequence(steps: ToneSequenceStep[]): Promise<void> {
  // ...
  for (const step of steps) {
    await this.executeTone(step.frequencyHz, step.durationMs, token);
    if (step.silenceAfterMs > 0) {
      await this.delay(step.silenceAfterMs); // <- setTimeout de JavaScript
    }
  }
}

private delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    this.currentTimeout = setTimeout(..., ms);
  });
}
```

#### El Problema

`setTimeout` y las promesas de JavaScript corren en el hilo de JavaScript (Hermes / JS Event Loop). En React Native, este hilo sufre variaciones constantes de latencia (jitter) causadas por:

1. Renders concurrentes de React y commits de UI.
2. Ticks concurrentes del temporizador (Jotai atoms, re-cálculos de estado en `useTimer`).
3. Ciclos de Garbage Collection (Hermes GC pauses).

Un `setTimeout(..., 150)` programado para un silencio entre beeps raramente se resuelve en 150.0 ms en un teléfono; típicamente oscila entre **160 ms y 240 ms**, o más si el dispositivo está caliente o bajo throttling térmico. Esto destruye la cadencia métrica del "3, 2, 1" y de la fanfarria de finalización, haciendo que los beeps se sientan "tropiezos" o "arrítmicos".

#### La Solución Técnica

La especificación de **Web Audio API** fue creada precisamente para resolver esto mediante el reloj de audio por hardware (`audioContext.currentTime`). Todos los eventos de una secuencia deben programarse en bloque sobre la línea de tiempo del hardware, permitiendo que el motor de audio en C++ (`react-native-audio-api` sobre CoreAudio en iOS y AAudio/Oboe en Android) los despache con precisión de microsegundos en el hilo de audio nativo de alta prioridad.

---

### 1.2. Causa Raíz Tímbrica: Ausencia de GainNode y "Clicks" por Discontinuidad de Fase (Spectral Splatter)

En `WebAudioOscillatorService`:

```typescript
private static createAndStartOscillator(
  ctx: AudioContext,
  frequencyHz: number,
  durationMs: number
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = frequencyHz;
  osc.connect(ctx.destination); // <- Conexión directa sin nodo de ganancia

  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + durationMs / 1000); // <- Corte abrupto de la onda

  return osc;
}
```

#### El Problema

Cuando una forma de onda (incluso una onda senoidal o triangular) comienza o se detiene instantáneamente en un punto donde la amplitud no es cero (zero-crossing), se introduce una discontinuidad matemática instantánea (una función escalón de Heaviside).

En el dominio de la frecuencia, una discontinuidad de este tipo genera un fenómeno acústico conocido como **dispersión espectral (spectral splatter)** o transitorio de DC (clic/pop):

- Si el oscilador arranca cuando la fase está en el pico (+1), se produce un chasquido agudo metálico.
- Si arranca cerca de cero, el ataque es suave.
- Como la fase y el instante de inicio varían aleatoriamente con cada invocación, **cada beep suena con un timbre, pegada y brillo diferente**, dando la percepción directa de que "la nota no es siempre la misma".

#### La Solución Técnica

Nunca se debe conectar un oscilador directamente al `destination`. Siempre se debe intercalar un `GainNode` con una envolvente de amplitud (Attack-Decay-Sustain-Release o rampas anti-click):

```typescript
// Rampa suave de entrada (Attack de 3-5 ms) y salida (Release de 5-10 ms)
gain.gain.setValueAtTime(0, startTime);
gain.gain.linearRampToValueAtTime(1, startTime + 0.005);
gain.gain.setValueAtTime(1, stopTime - 0.01);
gain.gain.linearRampToValueAtTime(0, stopTime);
```

Esto elimina el 100% de los clics parásitos y garantiza que la fundamental y los armónicos suenen con idéntica textura en cada disparo.

---

### 1.3. Latencia del Primer Beep ("Cold Start" de Hardware y Suspensión del Contexto)

En `WebAudioOscillatorService`:

```typescript
private async getAudioContext(): Promise<AudioContext> {
  if (!this.audioContext) {
    this.audioContext = new AudioContext();
  }
  if (this.audioContext.state === "suspended") {
    await this.audioContext.resume();
  }
  return this.audioContext;
}
```

#### El Problema

Los sistemas operativos móviles (iOS y Android) entran en modos agresivos de ahorro de energía. Cuando una app no reproduce audio continuo, el subsistema de hardware (DAC - Digital to Analog Converter, amplificadores de salida y pipelines de DSP nativos) entra en estado de suspensión (_DAC sleep_).

Al llegar el segundo 3 de la cuenta regresiva:

1. Se invoca `playCountdownBeep(3)`.
2. Se ejecuta `audioContext.resume()`.
3. El SO tarda entre **50 ms y 250 ms** en inicializar el stream de hardware nativo (Oboe en Android / AudioUnit en iOS).
4. El inicio de la onda se reproduce cuando el altavoz aún se está encendiendo, truncando el ataque del primer beep o retrasándolo de forma perceptible. Los beeps 2 y 1 ya encuentran el hardware "caliente" y suenan completos, acentuando la disparidad entre notas.

#### La Solución Técnica

- **Precalentamiento (Warm-up):** Activar y resumir el `AudioContext` en el momento en que el usuario entra en la pantalla del timer o pulsa "Start" (antes de que empiece la cuenta regresiva), reproduciendo si es necesario un buffer silencioso de 1 sample para asegurar que el DAC esté despierto.
- **Mantener el contexto vivo:** No destruir ni suspender el contexto entre tonos contiguos.

---

### 1.4. Sesión de Audio del Sistema Operativo y Convivencia con Música (Audio Session / Audio Focus)

Actualmente no hay configuración de `AudioManager` en el ciclo de vida del timer.

#### El Problema en el Box / Gimnasio

Los usuarios de una app de timer casi siempre entrenan escuchando música en segundo plano (Spotify, Apple Music, YouTube Music) a través de altavoces del teléfono o auriculares Bluetooth:

1. **Sin configuración explícita:** El comportamiento de iOS por defecto silencia la música de fondo o, peor aún, si el interruptor físico de silencio (silent switch / mute) está activo, los beeps del timer no suenan en absoluto (`ambient` respeta el botón de silencio).
2. **Audio Ducking:** Sin ducking automático (`duckOthers`), o la app de música apaga los beeps de Cron, o Cron corta en seco la música del usuario.
3. **Bluetooth A2DP vs HFP:** En auriculares Bluetooth o altavoces portátiles de box, si el sistema conmuta erróneamente el perfil de audio a comunicación bidireccional (HFP), la frecuencia de muestreo cae a 16 kHz, distorsionando y filtrando los tonos.

#### La Solución Técnica

Utilizar `AudioManager` de `react-native-audio-api`:

```typescript
AudioManager.setAudioSessionOptions({
  iosCategory: "playback", // Suena aunque el switch físico de silencio esté activo
  iosMode: "default",
  iosOptions: ["duckOthers", "mixWithOthers", "defaultToSpeaker"],
});
AudioManager.observeAudioInterruptions(true); // Solicita y gestiona Audio Focus en Android
```

---

## 2. Calidad de Sonido y Sound UX para HIIT y CrossFit

### 2.1. El Entorno Psicoacústico de un Entrenamiento de Alta Intensidad

Un WOD de CrossFit o una sesión de HIIT es uno de los entornos de usuario más exigentes para el diseño de interfaces:

| Factor Ambiental / Fisiológico | Impacto en el Usuario | Requisito para el Sonido |
| :-- | :-- | :-- |
| **Ruido de fondo masivo (80–95 dB SPL)** | Música estridente, caída de barras con bumpers, ventiladores industriales, respiración agitada. | El sonido debe ocupar un espacio espectral que no esté congestionado por graves ni ruidos de impacto. |
| **Fatiga cognitiva y visión de túnel** | Ritmo cardíaco a >85% FCmax; el atleta no puede mirar la pantalla del móvil. | El feedback debe ser **100% auditivo y discriminable sin ambigüedad** en los primeros 100 ms. |
| **Condicionamiento motor reflejo (Pavloviano)** | El atleta sincroniza el inicio del esfuerzo (ej. primer pull de un snatch o salida de un sprint) con el tono. | Latencia cero, ataque tajante y consistencia timbre-tono milimétrica. |

---

### 2.2. Por qué la Onda Triangular (Triangle) a 523–880 Hz Falla en Móviles

El servicio actual utiliza una onda triangular simple a:

- 523 Hz (Do5)
- 659 Hz (Mi5)
- 698 Hz (Fa5)
- 880 Hz (La5)

#### Análisis de Fallo Acústico

1. **Filtro físico de los altavoces de smartphone:** Los transductores miniatura de un teléfono (iPhone / Android) tienen una frecuencia de resonancia natural alta y un corte pasa-altos pronunciado alrededor de 350–500 Hz. Las frecuencias entre 500 y 700 Hz exigen un desplazamiento mecánico del cono que genera distorsión por intermodulación y volumen anémico.
2. **Curvas Isosónicas de Fletcher-Munson (ISO 226):** El oído humano es relativamente sordo a 500 Hz en comparación con la zona de **2.5 kHz a 4.0 kHz**, donde la longitud del canal auditivo genera una resonancia acústica natural.
3. **Pobreza de armónicos de la onda triangular:** La onda triangular concentra el 90% de su energía en la frecuencia fundamental, cayendo sus armónicos a razón de $1/n^2$. En un ambiente ruidoso, suena como un "beep de juguete" de microondas o calculadora, sin el filo ni la presencia de un reloj de box.

---

### 2.3. La Firma Acústica de los Timers Reales de CrossFit (Rogue Echo, Gymboss, Seiko)

Los relojes comerciales de box (como el **Rogue Echo Timer** o los timers de pared LED) utilizan transductores piezoeléctricos industriales excitados por trenes de pulsos cuadrados a su frecuencia de resonancia mecánica:

```
Espectro de un Buzzer de Timer de CrossFit:
Amplitud
  ▲
  │         Frecuencia Resonante (~2.8 - 3.2 kHz)
  │                   ▲
  │                   │
  │        ┌─┐       ┌┴┐       ┌─┐
  │        │ │       │ │       │ │   (Armónicos impares de alta energía)
  │  ┌─┐   │ │   ┌─┐ │ │ ┌─┐   │ │
  └──┴─┴───┴─┴───┴─┴─┴─┴─┴─┴───┴─┴────────► Frecuencia (Hz)
     500   1k    2k   3k  4k    6k
```

- **Frecuencia base:** Entre **2.2 kHz y 3.5 kHz**.
- **Forma de onda:** Onda cuadrada (Square wave) o síntesis FM dual, rica en armónicos impares ($f, 3f, 5f\dots$).
- **Envolvente:** Ataque ultrarrápido (< 2 ms) para simular el impacto percusivo del buzzer mecánico, pero con micro-fade out (5 ms) para evitar chasquido digital espurio.
- **Volumen percibido:** Al concentrar la energía espectral en los 3 kHz, el sonido "corta" cualquier mezcla de música pesada y se escucha a decenas de metros en el gimnasio con un consumo de potencia mínimo.

---

### 2.4. Gramática y Semiótica Sonora Recomendada para Cron

Para que los usuarios desarrollen un condicionamiento auditivo robusto, los sonidos deben ser **semánticamente coherentes** (Earcons estructurados):

| Evento | Función Psicológica | Perfil Acústico Propuesto | Duración | Comportamiento |
| :-- | :-- | :-- | :-- | :-- |
| **Countdown (3, 2, 1)** | Preparación neuromuscular, conteo métrico rítmico. | Beep penetrante a **2,400 Hz** (onda cuadrada filtrada con low-pass a 6 kHz o muestra de piezo). | 120 ms | Corto, seco, idéntico en cada segundo. |
| **GO / Work Start** | Disparo motor explosivo ("Salida"). | Buzzer industrial de alta energía a **3,200 Hz** (o acorde de buzzer dual 2.4 kHz + 3.2 kHz). | 750 ms | Sostenido, autoritario, imposible de ignorar. |
| **Rest Transition** | Relajación y cese del esfuerzo. | Tono descendente bifásico (ej. **1,200 Hz $\rightarrow$ 800 Hz** en 300 ms). | 350 ms | Curva descendente asociada naturalmente a "bajada de revoluciones". |
| **Round / Lap Change** | Checkpoint de progreso sin detener el esfuerzo. | Doble chirp agudo y ágil a **2,800 Hz** (50 ms tono + 40 ms silencio + 50 ms tono). | 140 ms total | Breve para no interferir con la respiración ni la concentración. |
| **Workout Finished** | Catarsis y finalización del sufrimiento (Time Cap). | Secuencia clásica de box: 3 bocinas con acento métrico: **[200ms] - pausa [150ms] - [200ms] - pausa [150ms] - [800ms sostenido]** a 2.8 kHz / 3.2 kHz. | ~1.5 s total | Fanfarria industrial inconfundible de fin de entrenamiento. |

---

## 3. Comparativa de Arquitecturas Técnicas: Síntesis vs. AudioBuffers Precargados

Existen dos vías para implementar esta solución en React Native:

| Criterio | Opción A: Síntesis Web Audio en Tiempo Real (`OscillatorNode` + `GainNode` + `BiquadFilter`) | Opción B: Samples PCM Precargados (`AudioBufferSourceNode`) | Opción C (Recomendada): Motor Híbrido |
| :-- | :-- | :-- | :-- |
| **Consistencia Tímbrica** | Alta (si se usa GainNode con envelope). | **Perfecta (100% determinista, grabado y masterizado en DAW profesional).** | **Perfecta** para samples reales de CrossFit + fallback a síntesis pura. |
| **Precisión Temporal** | Precisión de microsegundos usando `ctx.currentTime`. | Precisión de microsegundos usando `ctx.currentTime`. | Precisión de microsegundos de hardware. |
| **Fidelidad al Buzzer de CrossFit** | Muy buena (aproximada con Square Wave + Filter). | **Auténtica (audio real de temporizadores Rogue/Gymboss grabados).** | Auténtica. |
| **Uso de Memoria / Bundle** | 0 KB extra de assets. | ~150 KB en total (archivos WAV/MP3 minúsculos de 0.1 a 0.8s en 44.1kHz mono). | ~150 KB. |
| **Latencia de Disparo** | Cero latencia si el Context está activo. | **Cero latencia:** el buffer está decodificado en RAM nativa (PCM Float32). | Cero latencia. |

### Por qué la Opción B / Híbrida es el Estándar de la Industria

En aplicaciones como _WOD Nation_, _SmartWOD_, _Seconds Pro_ o _Nike Training Club_, los sonidos de los timers no se sintetizan en tiempo real mediante osciladores matemáticos simples: **se utilizan samples PCM de alta fidelidad pre-renderizados y masterizados con limitadores/compresores a 0 dBFS**.

Esto ofrece tres ventajas insuperables:

1. **Masterización acústica para altavoces móviles:** Los archivos de audio pueden pre-filtrarse con EQ compensatoria para que suenen limpios y sin distorsión armónica en los pequeños altavoces de iPhone y Android.
2. **Cero trabajo de CPU en el tick:** En vez de instanciar nodos, conectar cables de audio virtuales y calcular funciones matemáticas en cada segundo, el motor de audio simplemente clona un puntero al buffer PCM en memoria nativa con `createBufferSource()`.
3. **Libertad de diseño sonoro:** Permite agregar un toque de campana olímpica, claxon de baloncesto o el zumbador clásico del Rogue Echo Timer con total realismo.

---

## 4. Diseño de la Solución Técnica Propuesta

### 4.1. Configuración de Sesión con Ducking Inteligente

En el arranque de la aplicación o al montar el timer:

```typescript
import { AudioManager } from "react-native-audio-api";

export function configureWorkoutAudioSession(): void {
  AudioManager.setAudioSessionOptions({
    iosCategory: "playback", // Funciona incluso si el teléfono está en modo silencio
    iosMode: "default",
    iosOptions: [
      "duckOthers", // Atenúa la música de Spotify mientras suena el buzzer
      "mixWithOthers", // No corta ni pausa la música externa
      "defaultToSpeaker", // Enruta a altavoz principal si no hay auriculares
    ],
  });
  AudioManager.observeAudioInterruptions(true); // Manejo de focus en Android
}
```

### 4.2. Precarga de Buffers en Memoria (Zero-Latency Audio Engine)

Cargar los assets de audio en memoria al inicio de la sesión:

```typescript
import {
  AudioContext,
  type AudioBuffer,
  type AudioBufferSourceNode,
} from "react-native-audio-api";

export class SampleAudioFeedbackService implements AudioFeedbackService {
  private ctx: AudioContext;
  private soundBuffers: Map<string, AudioBuffer> = new Map();
  private isReady = false;

  constructor() {
    this.ctx = new AudioContext();
  }

  public async init(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    // Precarga y decodificación de samples a PCM en RAM nativa
    // await this.loadSample("beep", require("@/assets/audio/beep.wav"));
    // await this.loadSample("buzzer", require("@/assets/audio/buzzer.wav"));
    this.isReady = true;
  }

  public playCue(name: string): void {
    const buffer = this.soundBuffers.get(name);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start(this.ctx.currentTime); // Inmediato con reloj de audio nativo
  }
}
```

### 4.3. Programación Determinista en Síntesis de Ondas (Si se mantiene síntesis pura)

Si se desea mantener la síntesis matemática pura sin archivos de audio externos, el servicio debe refactorizarse para:

1. Eliminar `setTimeout` y programar todas las secuencias usando `ctx.currentTime`.
2. Usar forma de onda `'square'` (cuadrada) con un `BiquadFilterNode` pasa-bajos a ~4.5 kHz para replicar el buzzer piezoeléctrico de CrossFit.
3. Usar `GainNode` con rampas exponenciales o lineales para eliminar los clics de DC.

```typescript
// Implementación determinista de tono con envelope anti-click:
private playPreciseTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  durationSec: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square"; // Riqueza armónica de buzzer de box
  osc.frequency.setValueAtTime(freq, startTime);

  // Envolvente de volumen (Attack rápido de 3ms, Decay suave de 8ms al final)
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.85, startTime + 0.003);
  gain.gain.setValueAtTime(0.85, startTime + durationSec - 0.008);
  gain.gain.linearRampToValueAtTime(0.001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec);
}
```

---

## 5. Resumen de Recomendaciones y Plan de Acción

1. **Inmediato (Fix de Estabilidad y Clics):**
   - Intercalar un `GainNode` con envolvente anti-click en `WebAudioOscillatorService`.
   - Pre-calentar el `AudioContext` en el montaje del Timer para erradicar el lag del primer segundo.
   - Migrar `playToneSequence` para que use `ctx.currentTime` y descarte `setTimeout` en la cadencia de notas.

2. **Corto Plazo (Sound Design & Identidad HIIT / CrossFit):**
   - Elevar el registro de frecuencias al estándar psicoacústico de gimnasio (de los anémicos 523–659 Hz a **2,400 Hz en Beep** y **3,200 Hz en Buzzer** con onda cuadrada o muestras reales).
   - Configurar `AudioManager.setAudioSessionOptions` con `duckOthers` y `playback` para que el atleta pueda escuchar su música sin perderse las alarmas y funcione con el switch de silencio activado.
   - Adoptar `AudioBufferSourceNode` con un set de 4–5 micro-samples masterizados (.wav PCM mono de alta fidelidad: `countdown_beep`, `go_buzzer`, `rest_tone`, `round_change`, `workout_complete`).
