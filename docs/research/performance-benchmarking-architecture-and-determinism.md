# Investigación de Arquitectura: Medición Determinista de Rendimiento (Expo 58, Fabric y Flashlight + Maestro)

- **Repositorio**: `cron`
- **Entorno**: React Native 0.88.0, Expo SDK ~58.0.16, New Architecture (Fabric), React 19.3.0
- **Librerías Clave**: `react-native-reanimated@4.7.1`, `@lodev09/react-native-true-sheet@^3.11.18`, `react-native-worklets@0.13.0`
- **Herramientas de Evaluación**: Flashlight (`/bamlab/flashlight`), Maestro (`maestro.mobile.dev`), Android ADB / UIAutomator
- **Fecha**: Octubre 2026
- **Estado**: Aprobado / Especificación de Arquitectura de Pruebas

---

## 1. Resumen Ejecutivo y Hallazgos Críticos

La investigación contra fuentes primarias (código fuente de Flashlight `BAMPerfProfiler`, especificaciones de Android Developers sobre `<profileable>` y trazas de Fabric en React Native 0.88) valida la viabilidad del stack **Flashlight + Maestro**, pero revela **seis trampas técnicas críticas** que deben mitigarse para evitar mediciones sesgadas:

1. **Atribución de Hilos en Reanimated 4**: Los worklets de animación no corren en el hilo de JavaScript (`mqt_js`), sino en el **UI Thread** (hilo principal). Una sobrecarga de animación saturará el UI Thread mientras `mqt_js` marca 0% de uso.
2. **Presupuesto de Fotogramas y Pantallas de 120 Hz**: Flashlight asume por defecto 60 Hz (16.66 ms). Las pantallas con refresco adaptativo (LTPO) introducen varianza aleatoria. Se debe forzar el bloqueo de tasa de refresco a 60 Hz o 120 Hz vía ADB antes de medir.
3. **Requisito de `<profileable android:shell="true" />`**: En Android 10+ (API 29+), las trazas nativas de aplicación y Simpleperf se bloquean en compilaciones de producción a menos que se declare esta etiqueta en `AndroidManifest.xml`.
4. **Fabric View Flattening y `testID`**: Fabric elimina vistas nativas estructurales. Para que Maestro resuelva un `testID` en un contenedor plano, se debe asignar `collapsable={false}`.
5. **Alineación de Gestos en TrueSheet**: Los gestos en modales nativos deben contener coordenadas relativas explícitas y duración fija para evitar activar el dismiss del backdrop.
6. **Eliminación de JIT en Android**: Para evitar la variabilidad del compilador en tiempo de ejecución (JIT), se debe forzar la precompilación AOT de ART (`cmd package compile -m speed`) antes de iniciar la prueba.

---

## 2. Flashlight en Android con New Architecture

### 2.1 Identificación de Hilos y Monitoreo de Kernel

Flashlight no inyecta bibliotecas en el código fuente de la aplicación. Despliega un ejecutable nativo en C++ (`BAMPerfProfiler`) en `/data/local/tmp/` mediante ADB:

- Lee directamente los archivos `/proc/<PID>/stat` y `/proc/<PID>/task/<TID>/stat` del kernel Linux.
- Calcula el consumo delta $(\Delta \text{utime} + \Delta \text{stime}) / \Delta \text{total\_time}$ para cada hilo de ejecución.
- En React Native 0.88 (Fabric), el hilo de ejecución de Hermes conserva el nombre nativo `mqt_js` en `/proc/<PID>/task/<TID>/comm`.
- **Diferencia con Legacy Architecture**: El antiguo hilo `mqt_native_modules` desaparece en Fabric, ya que las llamadas a TurboModules se resuelven de forma síncrona en C++ o en pools de hilos auxiliares.

### 2.2 Requisito de Manifiesto (`<profileable>`)

En compilaciones de Release (`android:debuggable="false"`), el entorno seguro de Android restringe las trazas de `atrace` y Perfetto a nivel de aplicación. Declarar `<profileable android:shell="true" />`:

- Habilita la captura completa de trazas nativas y contadores por parte del usuario ADB `shell`.
- Mantiene activas todas las optimizaciones de producción de R8, optimizaciones de bytecode de Hermes y compilación nativa C++ en Release.

---

## 3. Maestro en React Native Release y Fabric

### 3.1 Resolución de Identificadores y Optimización de Vistas

Maestro localiza elementos mediante la API de accesibilidad de Android (`AccessibilityNodeInfo`). En React Native:

- `testID` se propaga como identificador de vista accesible.
- Los optimizadores de Fabric C++ colapsan (_view flattening_) cualquier `<View>` que no contenga estilos visuales o detectores de gestos.
- **Regla obligatoria para pruebas**: Todo contenedor padre referenciado por `testID` en flujos de Maestro debe llevar `collapsable={false}`.

### 3.2 Gestos Deterministas y Repetibles

Los comandos con dirección genérica (`swipe: UP`) generan velocidad variable según el dispositivo. Los flujos en `.maestro/perf/` deben usar coordenadas porcentuales y duración fija:

```yaml
- swipe:
    start: "50%, 75%"
    end: "50%, 35%"
    duration: 800
```

Tras cada interacción de arrastre, se debe incluir una pausa de asentamiento físico para esperar a que los algoritmos de decaimiento inercial de Reanimated lleguen a reposo.

---

## 4. Protocolo de Mitigación de Varianza en Hardware

Para garantizar que las métricas entre la versión base y la candidata sean comparables dentro de un margen de error menor al ±2%, el banco de pruebas debe ejecutar las siguientes fases:

1. **Calentamiento (Warmup)**: Ejecución de una pasada previa no computada para precargar bibliotecas nativas (`.so`), compilar cierres de worklets e inicializar estructuras de JSI.
2. **Compilación AOT de ART**:
   ```bash
   adb shell cmd package compile -m speed -f com.pkcarreno.cron.preview
   ```
3. **Bloqueo de Tasa de Refresco**:
   ```bash
   adb shell settings put system min_refresh_rate 60.0
   adb shell settings put system peak_refresh_rate 60.0
   ```
4. **Aislamiento Térmico y de Red**:
   - Activar modo avión (`adb shell cmd connectivity airplane-mode enable`).
   - Pausa de reposo de 5 a 6 segundos entre iteraciones para disipación térmica.
   - Batería del dispositivo entre 60% y 85% para evitar límites de ahorro de energía.
5. **Muestra Estadística**: Mínimo de 10 iteraciones por escenario, reportando mediana y percentil 90.

---

## 5. Comparativa Técnica de Herramientas

| Dimensión | Flashlight + Maestro | Android Jetpack Macrobenchmark | In-App Performance Marks |
| :-- | :-- | :-- | :-- |
| **Intrusión en Código** | Nula (cero código nativo en `android/`) | Alta (requiere módulo Gradle `:benchmark`) | Media (marcadores manuales en componentes) |
| **Resistencia a Actualizaciones Expo** | Alta (independiente de cambios de SDK) | Baja (fragilidad con AGP y Expo prebuild) | Alta |
| **Monitoreo de Hilos Separados** | Sí (distingue `mqt_js` y UI Thread) | No directo (requiere análisis Perfetto) | No (solo mide tiempos en hilo JS) |
| **Precisión de Fotogramas** | Basada en SurfaceFlinger / atrace | Basada en contadores de kernel Perfetto | No mide fotogramas nativos |
| **Automatización E2E** | Declarativa en YAML con Maestro | Código Kotlin con UIAutomator | Requiere harness propio |

---

## 6. Fuentes Primarias Citadas

- [Flashlight Source & Architecture](https://github.com/bamlab/flashlight)
- [Flashlight Issue #349: 120 Hz Display Handling](https://github.com/bamlab/flashlight/issues/349)
- [Android Developers: Profileable Element Documentation](https://developer.android.com/guide/topics/manifest/profileable-element)
- [Android Developers: Android Runtime (ART) Compilation Options](https://source.android.com/docs/core/runtime/configure)
- [Maestro Documentation: Commands and Selectors](https://maestro.mobile.dev/)
- [React Native New Architecture: Fabric Renderer Invariants](https://reactnative.dev/docs/new-architecture-intro)
