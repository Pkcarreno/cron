# Evaluación Técnica: Rediseño de `InputThumbwheel` en `cron`

- **Repositorio**: `cron`
- **Entorno**: React Native 0.88.0, Expo SDK ~58.0.16, New Architecture (Fabric), React 19.3.0
- **Librerías Core**: `react-native-reanimated@4.7.1`, `react-native-gesture-handler@~3.3.0`, `react-native-worklets@0.13.0`, `expo-haptics@~58.0.7`
- **Archivo Analizado**: [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx)
- **Consumidor Principal**: [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx) (`NumberPickerForm` dentro de `SheetContent` de TrueSheet)
- **Fecha**: Octubre 2026
- **Estado**: Evaluación de Investigación Completa

---

## 1. Resumen Ejecutivo y Diagnóstico Forense

El componente [`InputThumbwheel`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx) implementa una "cinta métrica" o selector de dial/regla horizontal para seleccionar números mediante gestos táctiles. El diseño se basa en una aguja central fija ([`centerIndicator`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx#L295-L305)) y marcas graduadas (ticks) móviles con retroalimentación háptica.

Actualmente, el componente sufre dos fallos estructurales reportados:

1. **Inicialización errónea en 0**: A pesar de recibir un `value` inicial distinto de 0 (por ejemplo, `25` o `50`), el componente arranca visualmente en el extremo inicial (0) y en ocasiones sobreescribe el valor del padre con 0.
2. **Imprecisión táctil y desacople de valor**: Es sumamente difícil seleccionar un número exacto; al soltar el dedo, la regla suele saltar a números contiguos (±1 o ±2), o bien la aguja queda visualmente sobre un número pero el estado retiene el valor anterior.

Adicionalmente, el componente depende de `FlatList` de `react-native-gesture-handler`, lo cual introduce una sobrecarga innecesaria y conflictos de gestos al renderizarse dentro de una hoja modal (`@lodev09/react-native-true-sheet`).

---

## 2. Diagnóstico de Causa Raíz

### 2.1 Problema 1: Por qué inicializa siempre en 0

Al analizar el código de [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx), se identifica una condición de carrera (_race condition_) entre el renderizado condicional, la medición del layout y el hook de sincronización:

1. **Estado inicial del padding dinámico**:
   ```tsx
   // Line 118
   const [dynamicPadding, setDynamicPadding] = useState(0);
   ```
2. **Montaje condicional de la lista**:
   ```tsx
   // Line 255-272
   <View style={styles.container} onLayout={handleLayout}>
     <View style={styles.centerIndicator} pointerEvents="none" />

     {dynamicPadding > 0 && (
       <FlatList
         ref={flatListRef}
         ...
       />
     )}
   </View>
   ```
   En el primer render, `dynamicPadding` vale `0`. Por lo tanto, **`<FlatList>` no existe en el árbol de componentes**.
3. **Fallo silencioso del `useEffect` inicial**:
   ```tsx
   // Line 137-167
   useEffect(() => {
     if (!scrollState.current.isScrolling && flatListRef.current) {
       ...
       flatListRef.current?.scrollToOffset({ ... });
     }
   }, [value, min, max, step]);
   ```
   En el montaje inicial, el `useEffect` se ejecuta de inmediato. Como `flatListRef.current` es `null` (la lista no está montada), el bloque `if` se salta por completo. No se programa ningún `scrollToOffset`.
4. **Medición tardía de layout y desincronización**:
   - `onLayout` se ejecuta tras el cálculo nativo y llama a `setDynamicPadding(width / 2 - TICK_WIDTH / 2)`.
   - El componente se re-renderiza y ahora monta `<FlatList>`.
   - **Sin embargo, el array de dependencias `[value, min, max, step]` no ha cambiado**. El `useEffect` **no se vuelve a ejecutar**.
   - `<FlatList>` monta con su scroll nativo por defecto en `offset: 0` (que corresponde a `min`).
5. **Efecto de retroalimentación destructiva**: Cuando el usuario toca la pantalla o el motor nativo reporta el layout inicial del scroll, `handleScroll` recibe `offsetX = 0`, calcula `closestIndex = 0` y dispara `onChangeValue(0)`, destruyendo el valor que el usuario tenía configurado previamente.

---

### 2.2 Problema 2: Por qué es impreciso y salta de número

La imprecisión es el resultado directo de intentar usar físicas de `ScrollView` para un instrumento de medición de precisión:

1. **Incompatibilidad de `snapToInterval` con pasos pequeños**: `TICK_WIDTH` está configurado en `16px`. Los algoritmos nativos de desaceleración e inercia de iOS (`UIScrollView`) y Android (`RecyclerView`) están diseñados para tarjetas o páginas (mínimo 100-300px), no para micro-intervalos de 16px. Al aplicar inercia con `decelerationRate="fast"`, la curva matemática de fricción del sistema operativo suele detenerse en un punto intermedio y luego saltar bruscamente al siguiente o anterior tick.
2. **El "Filtro Fantasma" (`distance < 0.3`)**: En las líneas 95-107:
   ```tsx
   const getUpdatedValue = (closestIndex, lastIndex, distance, params) => {
     const isNearCenter = distance < 0.3;
     const isFastScroll = Math.abs(closestIndex - lastIndex) > 1;

     if (isNearCenter || isFastScroll) {
       return Number((params.min + closestIndex * params.step).toFixed(2));
     }
     return null;
   };
   ```
   - Si el scroll desacelera y se detiene en una distancia normalizada de `0.32` (apenas a 5 píxeles del centro), la función retorna `null`.
   - Al retornar `null`, `onChangeValue` **no se llama**.
   - Resultado: La aguja visual queda apuntando a un número, pero el estado de la aplicación queda congelado en el número anterior.
3. **Latencia del Bridge de Fabric y Throttling**: `onScroll` corre a través de `scrollEventThrottle={16}`. Los eventos viajan del hilo de UI al hilo de JavaScript, donde cada cambio actualiza el estado de React en [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx) (`setDraftValue`), provocando re-renders del componente padre mientras se arrastra.
4. **Hápticos desincronizados**: La función `processHaptics` tiene un límite temporal arbitrario (`now - lastHapticTime > 40`). Si el usuario arrastra con rapidez o desacelera, los ticks hápticos se saltean o se retrasan, rompiendo la ilusión física táctil de la rueda dentada.
5. **Colisión con acciones rápidas (`-10`, `+5`)**: En [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx), existen botones para sumar y restar 5 o 10. Al pulsar estos botones, el `value` cambia externamente, disparando un `setTimeout(50ms)` con `flatListRef.current.scrollToOffset`. Si el usuario pulsa rápidamente varios botones, los timers colisionan y el scroll queda desfasado.

---

## 3. Por qué `FlatList` es la Abstracción Incorrecta

| Característica | `FlatList` | Requisitos del `Thumbwheel` |
| --- | --- | --- |
| **Propósito** | Virtualización de miles de elementos complejos y heterogéneos. | Regla o dial continuo con marcas simples homogéneas. |
| **Control de Físicas** | Caja negra del sistema operativo (iOS UIScrollView / Android Fling). | Control determinista de inercia, fricción y atracción magnética (_snap_ exacto). |
| **Puntos de Parada** | `snapToInterval` aproximado por el motor nativo. | Aterrizaje matemático exacto en `i * TICK_WIDTH`. |
| **Gestos en Modales** | Conflictos de interacción con el gesto de cierre del Bottom Sheet. | Aislable mediante `Gesture.Pan()` con control de gestos simultáneos o exclusivos. |
| **Inicialización** | Asíncrona, dependiente de `onLayout` y medición de contenido. | Inmediata y síncrona: `translationX = f(value)` calculable al instante. |

En el dominio de `cron`, el rango típico de este selector va de `0` a `99` (máximo `200`). Renderizar 100 líneas simples en la Nueva Arquitectura de React Native (Fabric) tiene un impacto despreciable de memoria y tiempo de montaje (< 1ms), haciendo que la complejidad de virtualización de `FlatList` sea perjudicial.

---

## 4. Evaluación de Alternativas de Arquitectura

### Opción A: Pan Gesture de Reanimated 4 + Contenedor Transformado (Recomendada)

- **Mecanismo**: Un contenedor `<Animated.View>` cuyo desplazamiento horizontal (`translateX`) es controlado por un `SharedValue`. El usuario interactúa mediante `Gesture.Pan()` de `react-native-gesture-handler@~3.3.0`.
- **Físicas e Inercia**:
  - Durante el arrastre: `translateX.value` sigue directamente al dedo con sensibilidad 1:1.
  - Al soltar el dedo: Se utiliza `withDecay` con la opción `modifyTarget` de Reanimated. `modifyTarget` calcula matemáticamente el tick más cercano sobre el punto de parada inercial y fuerza el aterrizaje exacto en ese píxel.
  - Para ajustes finos o toques: `withSpring` ajusta magnéticamente la regla al tick entero más próximo.
- **Sincronización Bidireccional**:
  - Al montar: `translateX.value` se inicializa con `-(initialValue - min) / step * TICK_WIDTH + (containerWidth / 2)`.
  - Cuando el valor cambia por props (por ejemplo, al pulsar los botones `-10` o `+5`): Se anima suavemente con `withSpring` hacia la nueva posición sin temporizadores (`setTimeout`) ni condiciones de carrera.
- **Hápticos**:
  - Se monitoriza el cruce de ticks mediante un `useAnimatedReaction` o dentro del callback de actualización del gesto, despachando `triggerHaptic` al hilo de JS mediante `scheduleOnRN` de `react-native-worklets`.

#### Ventajas:

1. **Precisión absoluta**: Es imposible aterrizar entre dos marcas o saltar números.
2. **Cero dependencias de scroll nativo**: No sufre por `snapToInterval`, ni problemas de `decelerationRate`.
3. **Arranque perfecto**: Se dibuja directamente en la posición de `value`, sin parpadeos ni reinicios en 0.
4. **Totalmente compatible con Bottom Sheets**: Al usar `Gesture.Pan()`, se puede configurar para coexistir pacíficamente con el arrastre vertical de `@lodev09/react-native-true-sheet`.

---

### Opción B: Ventana Virtual Deslizante (_Virtual Window / Modulo Strip_)

- **Mecanismo**: En lugar de renderizar todos los ticks del rango `[min, max]`, se renderiza una cantidad constante fija de marcas (por ejemplo, 25-30 marcas) que cubren únicamente el ancho visible de la pantalla más un margen de seguridad.
- **Ventajas**: Escala a rangos gigantescos (e.g. `min: 0, max: 100,000`).
- **Desventajas**: Mayor complejidad algorítmica para reposicionar dinámicamente los números y marcas; innecesario para los rangos de `cron` (donde el máximo observado es 99 o 200).

---

### Opción C: Canvas / Dibujo Directo con `react-native-svg`

- **Mecanismo**: Un único elemento `<Svg>` que dibuja todas las marcas mediante líneas vectoriales y texto SVG, desplazado con un `<G transform="...">`.
- **Ventajas**: Un único nodo nativo en el árbol de vistas.
- **Desventajas**: La renderización de fuentes y estilos de texto en SVG es menos consistente con el sistema de diseño de la app ([`components/text.tsx`](file:///home/pk/Projects/cron/components/text.tsx)), requiriendo configuración de fuentes específica para SVG.

---

## 5. Tabla Comparativa

| Criterio | Implementación Actual (`FlatList`) | Opción A: Reanimated Pan (Recomendada) | Opción B: Ventana Virtual | Opción C: SVG Canvas |
| --- | --- | --- | --- | --- |
| **Inicialización en `value`** | ❌ Falla siempre (inicia en 0) | ✅ Instantánea y determinista | ✅ Instantánea | ✅ Instantánea |
| **Precisión de selección** | ❌ Imprecisa (salta ±1/±2 ticks) | ✅ Exacta (físicas controladas) | ✅ Exacta | ✅ Exacta |
| **Sensación física (Inercia)** | ⚠️ Brusca con `decelerationRate` | ✅ Fluida con `withDecay` + snap | ✅ Fluida | ✅ Fluida |
| **Sincronización con botones (+5/-10)** | ❌ Frágil (`setTimeout 50ms`) | ✅ Fluida (`withSpring`) | ✅ Fluida | ✅ Fluida |
| **Respuesta Háptica** | ⚠️ Desincronizada (JS bridge lag) | ✅ Sincronizada al tick | ✅ Sincronizada | ✅ Sincronizada |
| **Mantenibilidad del Código** | ❌ Compleja (muchos refs y hacks) | ✅ Alta (código declarativo) | ⚠️ Media (lógica de módulo) | ⚠️ Media (SVG coords) |
| **Compatibilidad con TrueSheet** | ⚠️ Conflictos de scroll | ✅ Aislado con RNGH v3 | ✅ Aislado con RNGH v3 | ✅ Aislado |

---

## 6. Blueprint de Implementación Recomendado

A continuación se detalla la arquitectura de código propuesta para sustituir [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx).

### Principios de Diseño:

1. **Regla de Espaciado**: `TICK_WIDTH = 20` (en lugar de 16) para mejorar el target táctil y la legibilidad.
2. **Modelo de Coordenadas**: $$\text{offset}(v) = -(v - \text{min}) \times \frac{\text{TICK\_WIDTH}}{\text{step}}$$ El centro del contenedor se suma a `translateX` para alinear el tick actual con la aguja central.
3. **Decay con Snapping**:
   ```ts
   translateX.value = withDecay({
     velocity: event.velocityX,
     clamp: [minTranslate, maxTranslate],
     modifyTarget: (target) => {
       "worklet";
       const index = Math.round((centerX - target) / TICK_WIDTH);
       return centerX - index * TICK_WIDTH;
     },
   });
   ```
4. **Despacho Seguro al Hilo JS**: Uso de `scheduleOnRN` de `react-native-worklets` para las llamadas a `onChangeValue` y `triggerHaptic`, cumpliendo con las directrices de Reanimated 4 y New Architecture.

---

## 7. Plan de Acción Recomendado

1. **Reemplazo del componente**: Reescribir [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx) siguiendo el patrón de Pan Gesture + Reanimated 4.
2. **Validación de Integración con `InputNumber`**: Verificar que abrir el modal [`NumberPickerSheet`](file:///home/pk/Projects/cron/components/input-number.tsx#L162) muestre la regla perfectamente posicionada en el valor actual (sin saltos visuales).
3. **Verificación de Acciones Rápidas**: Probar que pulsar `-10`, `-5`, `+5`, `+10` desplace suavemente la aguja al nuevo número con animación de resorte (`withSpring`).
4. **Verificación de Gestos en Hoja Modal**: Comprobar que el arrastre horizontal de la regla no cierre accidentalmente la hoja modal de TrueSheet.
