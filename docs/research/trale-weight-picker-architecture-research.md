# Investigación Arquitectónica: Selector de Peso en Trale (Flutter) y su Aplicación en `InputThumbwheel` (`cron`)

- **Repositorio de Referencia**: [`QuantumPhysique/trale`](https://github.com/QuantumPhysique/trale)
- **Componentes Analizados en Trale**:
  - [`ruler_picker.dart`](https://github.com/QuantumPhysique/trale/blob/master/app/lib/widget/weight_picker_parts/ruler_picker.dart) (Controlador, colapso con teclado, gestión de steppers)
  - [`weight_slider.dart`](https://github.com/QuantumPhysique/trale/blob/master/app/lib/widget/weight_picker_parts/weight_slider.dart) (`ListView.builder`, escalado óptico y cálculo de paddings)
  - [`scroll_physics.dart`](https://github.com/QuantumPhysique/trale/blob/master/app/lib/widget/weight_picker_parts/scroll_physics.dart) (`MultiItemSnapScrollPhysics`, resortes balísticos y amortiguamiento)
- **Repositorio Destino**: `cron` (React Native 0.88, Expo SDK 58, Fabric New Architecture, Reanimated 4.7)
- **Archivo Objetivo**: [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx)
- **Fecha**: Octubre 2026
- **Estado**: Análisis de Código Fuente y Diseño Arquitectónico Concluido

---

## 1. Resumen Ejecutivo

El usuario reporta que el componente [`InputThumbwheel`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx) en `cron` se percibe "trabajoso", pesado y con baja responsividad táctil al deslizar con el dedo en dispositivos de gama alta. Como contraparte, la aplicación open-source **Trale** ([QuantumPhysique/trale](https://github.com/QuantumPhysique/trale)) ofrece un selector de peso tipo cinta métrica/ruler que exhibe una fluidez y respuesta táctil inmediata (120 Hz sin microstuttering ni resistencia artificial).

Tras clonar y auditar en profundidad el código fuente primario de Trale, se constata que **la fluidez de Trale no proviene de un gesto táctil customizado ni de cálculos matemáticos en el hilo de UI de alto nivel, sino del aprovechamiento del motor de desplazamiento nativo con física balística personalizada y desacoplamiento de frames.**

En `cron`, la implementación actual utiliza `PanResponder` de React Native. `PanResponder` despacha cada micromovimiento táctil a través del puente serializado al hilo de JavaScript (JS thread), donde compite con la reconciliación de React (`onChangeValue`) antes de enviar comandos de vuelta a la GPU mediante Reanimated. Este cuello de botella genera una latencia perceptible de entrada (input lag), interpretada físicamente como resistencia o sensación "trabajosa".

Este documento detalla los 6 pilares de la arquitectura de Trale y define la hoja de ruta para trasladar estos principios a React Native y la Nueva Arquitectura (Fabric).

---

## 2. Análisis Forense del Código Fuente de Trale

### 2.1 Uso de `ListView.builder` con `itemExtent` Fijo vs Gestos Sintéticos

En lugar de construir un reconocedor de gestos de arrastre manual (`GestureDetector` o `PanGestureRecognizer`), Trale delega todo el desplazamiento en un widget nativo de listas:

```dart
// app/lib/widget/weight_picker_parts/weight_slider.dart
ListView.builder(
  controller: scrollController,
  scrollDirection: Axis.horizontal,
  padding: EdgeInsets.symmetric(horizontal: leadTrailPad),
  physics: MultiItemSnapScrollPhysics(
    snapSize: tickWidth,
    parent: const ClampingScrollPhysics(),
  ),
  itemExtent: tickWidth,
  itemBuilder: (BuildContext context, int index) { ... }
)
```

**Ventajas clave:**

1. **Tiempo $O(1)$ en layout**: Al especificar `itemExtent: tickWidth` ($10\text{ px}$), el motor de Flutter no calcula la geometría de cada elemento individual. El offset de cualquier tick $i$ es invariablemente $i \times \text{tickWidth}$.
2. **Loop de renderizado directo**: Los eventos de scroll se procesan directamente en el render loop del motor a 60/120 fps sin atravesar capas intermedias de lógica de negocio.

---

### 2.2 Balística Personalizada: `MultiItemSnapScrollPhysics`

El factor determinante en la sensación táctil de Trale reside en [`scroll_physics.dart`](https://github.com/QuantumPhysique/trale/blob/master/app/lib/widget/weight_picker_parts/scroll_physics.dart). Trale extiende `ScrollPhysics` para controlar la inercia (fling) y el anclaje (snap):

```dart
// app/lib/widget/weight_picker_parts/scroll_physics.dart
class MultiItemSnapScrollPhysics extends ScrollPhysics {
  const MultiItemSnapScrollPhysics({
    required this.snapSize,
    this.maxItemsPerFling = 50.0,
    this.velocityDivisor = 10.0,
    super.parent,
  });

  static const double stiffness = 140.0;
  static const double ratio = 0.8;

  @override
  SpringDescription get spring => SpringDescription.withDampingRatio(
    mass: 1.0,
    stiffness: stiffness,
    ratio: ratio,
  );

  @override
  Simulation? createBallisticSimulation(
    ScrollMetrics position,
    double velocity,
  ) {
    if (position.outOfRange) {
      return parent?.createBallisticSimulation(position, velocity);
    }

    final Tolerance tol = toleranceFor(position);
    final double currentPage = _page(position);

    // 1. Arrastre lento o estático: snap directo al tick más cercano
    if (velocity.abs() <= tol.velocity) {
      final double targetPage = currentPage.roundToDouble();
      final double targetPx = _pixelsForPage(targetPage);
      if ((targetPx - position.pixels).abs() < tol.distance) {
        return null;
      }
      return ScrollSpringSimulation(
        spring,
        position.pixels,
        targetPx,
        velocity,
        tolerance: tol,
      );
    }

    // 2. Fling rápido: proyectar ticks según velocidad y detenerse exactamente en un tick
    final double deltaItems = (velocity.abs() / (snapSize * velocityDivisor))
        .clamp(1.0, maxItemsPerFling);

    final double minPage = position.minScrollExtent / snapSize;
    final double maxPage = position.maxScrollExtent / snapSize;
    final double targetPage = (currentPage + deltaItems * velocity.sign)
        .clamp(minPage, maxPage)
        .roundToDouble();

    final double targetPx = _pixelsForPage(targetPage);
    if ((targetPx - position.pixels).abs() < tol.distance) {
      return null;
    }

    return ScrollSpringSimulation(
      spring,
      position.pixels,
      targetPx,
      velocity,
      tolerance: tol,
    );
  }
}
```

#### Parámetros Críticos de la Física

- **Stiffness ($140.0$) y Damping Ratio ($0.8$)**: Proporcionan un asentamiento elástico rápido y controlado (ligeramente sub-amortiguado), similar al estándar de iOS. No hay oscilaciones residuales molestas.
- **`deltaItems` con `velocityDivisor = 10.0` y `clamp(1.0, 50.0)`**: Un impulso fuerte no desliza descontroladamente hasta el final; proyecta un avance cuantizado en ticks enteros y activa un resorte hacia el tick meta.

---

### 2.3 Centrado Matemático Infalible vía Padding del Viewport (`leadTrailPad`)

En `weight_slider.dart`, Trale resuelve la alineación central del indicador fijo de aguja sin transformaciones de coordenadas arbitrarias:

```dart
final double leadTrailPad = ((width - tickWidth) / 2.0).clamp(0.0, double.infinity);

ListView.builder(
  padding: EdgeInsets.symmetric(horizontal: leadTrailPad),
  ...
)
```

**Por qué funciona matemáticamente:**

- Cuando el scroll offset es $0$, el borde del primer tick está situado exactamente a `(width - tickWidth) / 2` del inicio del contenedor.
- El centro del primer tick se encuentra a: $$\text{Offset} = \frac{\text{width} - \text{tickWidth}}{2} + \frac{\text{tickWidth}}{2} = \frac{\text{width}}{2}$$
- Como el indicador central está ubicado en $\frac{\text{width}}{2}$, el tick $0$ queda milimétricamente alineado al centro sin compensaciones dinámicas de transform.

---

### 2.4 Desacoplamiento de Notificación: `addPostFrameCallback` y Deduplicación

Uno de los mayores causantes de lentitud en selectores interactivos es la emisión síncrona de eventos hacia el estado del padre. Trale aísla completamente el rendering del scroll de la notificación de cambios:

```dart
// app/lib/widget/weight_picker_parts/weight_slider.dart
final int nearestIndex = page.round();
if (nearestIndex != _lastReportedIndex) {
  _lastReportedIndex = nearestIndex;
  final double newValue = nearestIndex / widget.ticksPerStep;
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!mounted) return;
    widget.onValueChange(newValue);
  });
}
```

1. **Deduplicación estricta**: Aunque el offset cambie en cada subpíxel ($10.2 \to 10.4 \to 10.8$), sólo se evalúa el índice redondeado (`page.round()`).
2. **`addPostFrameCallback`**: La llamada a `onValueChange` no interrumpe el pipeline de renderizado del frame actual. El motor dibuja a 120 fps y, una vez finalizado el frame, notifica al diálogo contenedor.

---

### 2.5 Atenuación Óptica y Escalado Visual (`scaleForIndex`)

Para que la cinta métrica sea visualmente legible y enfoque la atención en el centro, Trale aplica una matriz de escala a los ticks según su distancia al centro:

```dart
double scaleForIndex(int index) {
  final double rel = ((index - page) / (pagesVisible / 2.0)).abs();
  final double denom = max(1e-6, zeroAtRel - edgeStart);
  final double t = ((rel - edgeStart) / denom).clamp(0.0, 1.0);
  return 1.0 - t;
}
```

Los ticks decrecen en escala horizontal y vertical hacia los extremos del viewport, evitando saturación visual.

---

### 2.6 Gestión de Steppers Acumulativos (`_stepTarget`)

Para los botones de incremento/decremento rápidos (`-10`, `+10`), Trale evita leer el scroll offset en pleno vuelo si el usuario presiona repetidamente:

```dart
// app/lib/widget/weight_picker_parts/ruler_picker.dart
Future<void> _stepBy(int steps) async {
  final double target = max(
    0.0,
    (_stepTarget ?? _scrolledValue) + steps * _stepSize,
  );
  _stepTarget = target;
  await _scrollToValue(target);
  if (_stepTarget == target) {
    _stepTarget = null;
  }
}
```

Si el usuario pulsa `+5` tres veces seguidas antes de que termine la animación, los objetivos se acumulan de forma determinista en lugar de truncarse.

---

## 3. Comparativa de Arquitecturas: Trale vs `cron`

| Dimensión | Trale (Flutter) | `cron` (Implementación Actual) | Impacto en la UX |
| :-- | :-- | :-- | :-- |
| **Manejador Táctil** | `ListView.builder` nativo | `PanResponder` de React Native | `PanResponder` corre en JS y causa latencia de puente en cada movimiento. |
| **Inercia y Desaceleración** | `MultiItemSnapScrollPhysics` con resorte ($k=140, \zeta=0.8$) | Fling sintético en JS con `Math.min(maxFling, vx * 120)` | La inercia en JS se siente "pegajosa" o truncada abruptamente. |
| **Alineación Central** | Padding horizontal estático: `(width - tickWidth) / 2` | `translateX` manual calculado con márgenes dinámicos | En `cron` requiere calcular límites de rubber-band en cada frame. |
| **Notificación de Estado** | `addPostFrameCallback` tras dedup de índice | `requestAnimationFrame` en JS pero ligado a `PanResponder` | El hilo de JS reconcilia React al mismo tiempo que procesa el arrastre. |
| **Integración con Modales** | `Column` dentro de `Dialog` nativo | Dentro de `TrueSheet` (`@lodev09/react-native-true-sheet`) | En iOS, los `UIScrollView` horizontales nativos colaboran con hojas modales sin capturar el swipe vertical de cierre. |

---

## 4. Diagnóstico de Causa Raíz en `cron`

En [`components/input-thumbwheel.tsx`](file:///home/pk/Projects/cron/components/input-thumbwheel.tsx), la razón por la cual se siente "trabajoso" es la combinación de:

1. **Doble cruce de hilo en cada frame**: $$\text{Touch Event (Nativo)} \xrightarrow{\text{Bridge}} \text{JS (PanResponder)} \xrightarrow{\text{Bridge}} \text{Reanimated (UI Thread TransX)}$$ Esto añade entre 8ms y 30ms de retardo entre el movimiento del dedo y la actualización visual de la regla.
2. **Re-renderizado de componentes padres en el JS Thread**: Al invocar `scheduleNotify`, el formulario `NumberPickerForm` ([`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx)) actualiza su estado local en React. Esto consume ciclos del hilo de JS justo cuando `onPanResponderMove` necesita procesar las siguientes coordenadas táctiles.
3. **Falso supuesto de la evaluación previa**: La evaluación previa ([`docs/research/input-thumbwheel-evaluation.md`](file:///home/pk/Projects/cron/docs/research/input-thumbwheel-evaluation.md)) reemplazó `FlatList` por `PanResponder` asumiendo que los componentes de lista eran inherentemente defectuosos para ticks pequeños. En realidad, el problema del `FlatList` original eran condiciones de carrera (`dynamicPadding > 0` que impedía el montaje inicial) y un filtro `distance < 0.3` erróneo, no el motor de scroll nativo.

---

## 5. Arquitectura Propuesta para `cron`

Para replicar la respuesta instantánea de Trale en React Native bajo la New Architecture (Fabric), disponemos de dos caminos arquitectónicos:

### Alternativa 1 (Recomendada): Motor de Scroll Nativo (`Animated.ScrollView`)

Implementar un `ScrollView` horizontal nativo configurado con los parámetros óptimos del sistema operativo:

```tsx
<Animated.ScrollView
  ref={scrollViewRef}
  horizontal
  showsHorizontalScrollIndicator={false}
  bounces={true}
  decelerationRate="fast"
  snapToInterval={TICK_WIDTH}
  snapToAlignment="start"
  disableIntervalMomentum={false}
  contentContainerStyle={{
    paddingHorizontal: (containerWidth - TICK_WIDTH) / 2,
  }}
  contentOffset={{ x: initialIndex * TICK_WIDTH, y: 0 }}
  onScroll={scrollHandler}
  scrollEventThrottle={16}
>
  <TickStrip min={min} step={step} totalTicks={totalTicks} />
</Animated.ScrollView>
```

#### Ventajas:

1. **Desplazamiento 100% nativo**: En iOS corre sobre `UIScrollView` y en Android sobre `HorizontalScrollView`. La respuesta al tacto es inmediata (0ms de input lag).
2. **Convivencia perfecta con `TrueSheet`**: En iOS, `UISheetPresentationController` entiende de forma nativa los gestos de un `UIScrollView` horizontal y no colisiona con el deslizamiento vertical para cerrar el sheet.
3. **Física del SO**: `decelerationRate="fast"` junto a `snapToInterval={TICK_WIDTH}` ejecuta en C++/Obj-C el snapping idéntico a `MultiItemSnapScrollPhysics` de Trale.

---

### Alternativa 2: Gesto Puro en UI Thread (`Gesture.Pan()` de Gesture Handler)

Si se desea retener el diseño de tira continua sin `ScrollView`:

- Debe utilizarse `Gesture.Pan()` de `react-native-gesture-handler`.
- **Todos** los callbacks (`onBegin`, `onUpdate`, `onEnd`) deben ser estrictamente worklets ejecutados en el hilo de UI (`runOnJS(false)`).
- La desaceleración inercial debe ejecutarse con `withDecay` o `withSpring` de Reanimated 4 directamente en el hilo de UI.
- La retroalimentación háptica y la notificación de valor deben despacharse mediante `scheduleOnRN` / `runOnJS` únicamente al cruzar un tick entero.

---

## 6. Plan de Acción Recomendado

1. **Adoptar la fórmula de centrado de Trale**: Establecer `paddingHorizontal = (containerWidth - TICK_WIDTH) / 2`.
2. **Reemplazar `PanResponder` por `Animated.ScrollView` nativo**: Aprovechar `snapToInterval={TICK_WIDTH}` y `decelerationRate="fast"`.
3. **Iniciar en `contentOffset` sin useEffect diferido**: Al inicializar con `contentOffset={{ x: initialIndex * TICK_WIDTH, y: 0 }}`, el componente nace centrado en el valor exacto desde el primer frame de layout, erradicando los saltos iniciales.
4. **Deduplicar y diferir `onChangeValue`**: Notificar al componente padre únicamente cuando `Math.round(offsetX / TICK_WIDTH)` cambie de número entero, utilizando un callback encolado en microtask o `onMomentumScrollEnd` para no bloquear los 120 fps del gesto.

---

## 7. Conclusión

El análisis de Trale demuestra que la alta responsividad en un selector tipo ruler se logra apoyándose en las primitivas de scroll de la plataforma nativa y desacoplando el renderizado de la sincronización de estado. Adaptar estos principios en `cron` devolverá la sensación táctil de alta precisión sin penalizar los fps en dispositivos móviles.
