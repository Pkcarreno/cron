# Investigación Técnica: Menú Principal Edge-to-Edge y Transición a `expo-blur`

- **Repositorio**: `cron`
- **Entorno**: React Native 0.88.0, Expo SDK 58 (`~58.0.16`), New Architecture (Fabric), React 19 (`19.3.0`), Reanimated 4 (`4.7.1`), Jotai 2 (`2.19.1`), `react-native-pager-view` (`9.0.7`)
- **Documentos Relacionados**: [`docs/adr/0006-menu-custom-tabs-and-segmented-pager.md`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/docs/adr/0006-menu-custom-tabs-and-segmented-pager.md)
- **Fecha**: Noviembre 2026
- **Estado**: Propuesta de Arquitectura y Evaluación de Viabilidad

---

## 1. Resumen Ejecutivo

El menú principal de `cron` (`screens/menu`) constituye el punto de entrada crítico de la aplicación. En la arquitectura actual ([ADR 0006](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/docs/adr/0006-menu-custom-tabs-and-segmented-pager.md)), el menú utiliza un sistema de tabs segmentados (`SegmentedTabBar`) sincronizado de forma pasiva y unidireccional con un pager nativo (`react-native-pager-view`).

Actualmente, el layout divide la pantalla verticalmente en tres secciones secuenciales dentro del flujo normal de Flexbox:

1. **Header superior estático**: Título "Cron" y Logo (`screens/menu/index.tsx`).
2. **Contenido interactivo central**: Subtítulo "Job" + `FormPager` (que contiene `SegmentedTabBar` arriba y `AnimatedPagerView` abajo).
3. **Floating Action Dock inferior**: Contenedor flotante con `LinearGradient` de negro a transparente para los botones de Start y Settings.

### El Problema Detectado

Al interactuar con formularios con contenido vertical extenso (principalmente `IntervalForm` y en menor medida `EmomForm`), el desplazamiento vertical se ve recortado en una línea horizontal estricta e inflexible inmediatamente debajo del `SegmentedTabBar`. Los elementos del formulario desaparecen bruscamente en ese límite en lugar de deslizarse con naturalidad por debajo de la barra de navegación superior. Además, en la parte inferior se depende de un degradado lineal estático (`LinearGradient`) que no unifica el lenguaje visual con la barra superior ni aporta la profundidad de materiales translúcidos propia de los estándares de Apple Design.

### La Propuesta

1. **Transformar el Pager en una superficie Edge-to-Edge verdadera**: El `AnimatedPagerView` y los `ScrollView`s internos deben ocupar el 100% del alto de la pantalla (desde `y = 0` hasta la base del dispositivo), permitiendo que el contenido se desplace tanto por debajo del Header superior y Tab Bar como por debajo del Dock inferior.
2. **Definir con precisión el Espacio Activo (Content Insets)**: En reposo (`scrollY = 0`), los formularios deben iniciar visualmente en la misma posición actual (justo debajo del `SegmentedTabBar`), mediante un `paddingTop` calculado en el `contentContainerStyle` del `ScrollView`.
3. **Migrar del `LinearGradient` a `expo-blur` (`BlurView`)**: Implementar materiales translúcidos (`systemUltraThinMaterialDark` / `dark`) tanto en el Header superior como en el Dock inferior, eliminando cortes abruptos y ofreciendo una sensación de profundidad continua sin penalizar los 120 FPS de la New Architecture (Fabric).

---

## 2. Radiografía de la Arquitectura Actual del Menú

### 2.1 Árbol de Componentes y Jerarquía de Vistas

```
screens/menu/index.tsx (Menu)
│
├── <View style={[styles.container, { paddingTop: inset.top }]}>
│   │
│   ├── <View style={styles.header}>  [Cron (size 48) + Logo]
│   │
│   ├── <View style={styles.content}>
│   │   ├── <Text>Job</Text>
│   │   └── <FormPager> (screens/menu/components/form-pager/index.tsx)
│   │       ├── <SegmentedTabBar>  [GestureDetector (Pan + Tap), IndicatorPill, Labels]
│   │       └── <AnimatedPagerView>  [react-native-pager-view]
│   │           └── <View style={styles.page}>
│   │               └── <IntervalForm paddingBottom={formPaddingBottom}>
│   │                   └── <ScrollView contentContainerStyle={{ paddingBottom }}>
│   │
│   └── <LinearGradient style={styles.floatingDockGradient}>  [absolute bottom: 0]
│       └── <FloatingActionDock style={{ paddingBottom: inset.bottom + 12 }}>
```

### 2.2 Diagnóstico del Flujo de Insets y Clipping Geométrico

1. **Restricción de Altura del PagerView**: En [`screens/menu/index.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/index.tsx#L22-L39), el contenedor raíz aplica `paddingTop: inset.top`. Luego, en flujo Flexbox secuencial, se renderiza el `header` (altura ~58px), el margen `gap: 16`, el texto "Job" (altura ~18px), el `gap: 12` de `FormPager`, y el `SegmentedTabBar` (`height: 36px`). Por lo tanto, el `<AnimatedPagerView>` inicia físicamente a una distancia de: $$\text{topOffset} = \text{inset.top} + 58 + 16 + 18 + 12 + 36 + 12 \approx \text{inset.top} + 152\text{px}$$

2. **Corte Rígido por Límites de Renderizado Nativo**: `react-native-pager-view` se compila como `UIPageViewController` en iOS y `ViewPager2` en Android. Ambos componentes nativos poseen recorte estricto de viewport (`clipsToBounds = true` en UIKit, `setClipChildren(true)` en Android). Cuando el usuario realiza un desplazamiento vertical hacia arriba en el `ScrollView` de `IntervalForm`, las vistas hijas se recortan de golpe al alcanzar `y = 0` relativo al `PagerView`. Visualmente se aprecia un corte horizontal plano en el vacío negro.

3. **Inyección Unidireccional de Insets**: En [`screens/menu/components/form-pager/index.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/form-pager/index.tsx#L30):
   ```tsx
   const formPaddingBottom = Math.max(128, 102 + insets.bottom + 24);
   ```
   La función `content` de [`FormTabOption`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/form-pager/types.ts#L8) solo recibe `{ bottom: number }`. No existe el concepto de inset superior para los formularios, ya que se asumía que el header era un bloque rígido opaco.

---

## 3. Propuesta de Arquitectura Edge-to-Edge

Para permitir que el formulario fluya por detrás del Header y por detrás del Dock sin alterar la posición inicial de reposo ni interferir con los gestos, la arquitectura de layout debe pasar de un modelo **apilado en Flexbox** a un modelo **superpuesto en capas (Z-Index Layering)**.

### 3.1 Estructura de Capas (Layering Stacking)

```
+-------------------------------------------------------------+
| Capa 1 (Top Floating Header Overlay - zIndex: 10)           |
| [BlurView / Material]                                       |
| - insets.top                                                |
| - Header: "Cron" + Logo                                     |
| - Label: "Job"                                              |
| - SegmentedTabBar (Tabs interactivos con scrubbing)         |
+-------------------------------------------------------------+
|                                                             |
| Capa 0 (Fondo Edge-to-Edge - zIndex: 0)                     |
| AnimatedPagerView (StyleSheet.absoluteFill)                 |
|                                                             |
|  ScrollView (contentContainerStyle: {                       |
|    paddingTop: calculatedHeaderHeight,                      |
|    paddingBottom: calculatedDockHeight                      |
|  })                                                         |
|                                                             |
|  [Contenido Formulario: Presets, Rounds, Work, Rest...]     |
|                                                             |
+-------------------------------------------------------------+
| Capa 2 (Bottom Floating Action Dock - zIndex: 10)           |
| [BlurView / Material]                                       |
| - FloatingActionDock (Sliders + Start Button)               |
| - insets.bottom                                             |
+-------------------------------------------------------------+
```

### 3.2 Cálculo del "Espacio Activo" (Content Insets)

Para que el contenido aparezca visualmente en el mismo lugar que hoy cuando el usuario no ha scrolleado (`scrollY === 0`), el `paddingTop` del `ScrollView` debe coincidir exactamente con la altura proyectada del Header superpuesto:

```typescript
// Geometría predecible y determinista
export const MENU_HEADER_METRICS = {
  headerTitleHeight: 58, // Text "Cron" (size 48 + line height)
  headerMarginBottom: 16, // Espaciado entre Header y "Job"
  jobLabelHeight: 18, // Text "Job" (size 14 + line height)
  jobMarginBottom: 12, // Espaciado entre "Job" y Tab Bar
  tabBarHeight: 36, // TAB_CONTAINER_HEIGHT precalculado
  tabBarMarginBottom: 16, // Margen de seguridad hasta el primer campo
};

// Altura total del Header Flotante:
export const getMenuTopInset = (safeAreaTop: number): number => {
  return (
    safeAreaTop +
    MENU_HEADER_METRICS.headerTitleHeight +
    MENU_HEADER_METRICS.headerMarginBottom +
    MENU_HEADER_METRICS.jobLabelHeight +
    MENU_HEADER_METRICS.jobMarginBottom +
    MENU_HEADER_METRICS.tabBarHeight +
    MENU_HEADER_METRICS.tabBarMarginBottom
  );
};
```

#### Ventajas del Inset Superior en los Formularios:

1. **Posición de reposo (`scrollY = 0`)**: El primer elemento interactivo ("Presets" en `IntervalForm`, o "Time Cap" en `ForTimeForm`) reposa justo debajo de la barra de tabs, sin solapamientos.
2. **Desplazamiento ascendente**: Al hacer scroll, los campos se deslizan hacia arriba, pasando con fluidez por debajo de los tabs y del título de la aplicación.
3. **Scroll Indicator en iOS**: Al configurar en el `ScrollView`:
   ```tsx
   scrollIndicatorInsets={{
     top: topInset,
     bottom: bottomInset,
   }}
   ```
   La barra de desplazamiento nativa de iOS se limita estrictamente a la ventana visible activa, sin meterse debajo de las barras flotantes.

### 3.3 Impacto en los 5 Modos de Entrenamiento

| Modo | Campos actuales | Comportamiento con Edge-to-Edge |
| :-- | :-- | :-- |
| **INTERVAL** | Presets + 3 Campos (Rounds, Work, Rest) | **Impacto Máximo**: Es el formulario más largo. Con Edge-to-Edge puede scrollearse completamente por debajo del header y del dock sin cortes rígidos. |
| **EMOM** | Presets + 2 Campos (Rounds, Round Duration) | **Impacto Medio**: En pantallas estándar o compactas, se beneficia del scroll completo sin choque con el header. |
| **FOR TIME** | 1 Campo (Time Cap) | **Consistencia**: Con `paddingTop`, el campo queda exactamente a la misma altura que el primer campo de Interval, evitando saltos de posición al cambiar de tab. |
| **AMRAP** | 1 Campo (Duration) | **Consistencia**: Mantiene la misma alineación visual uniforme. |
| **STOP WATCH** | Texto centrado ("All set!") | **Centrado Proporcional**: Actualmente usa `justifyContent: 'center'`. Al tener `paddingTop` y `paddingBottom`, el centrado se calcula respecto al espacio útil entre header y dock. |

---

## 4. Migración a `expo-blur` (`BlurView`)

El usuario plantea sustituir el `LinearGradient` por un desenfoque nativo con `expo-blur`, buscando unificar la estética y eliminar la sensación de corte estricto en la parte superior.

### 4.1 Evaluación Técnica de `expo-blur` en SDK 58 / New Architecture

1. **Soporte en iOS (`UIVisualEffectView`)**:
   - `expo-blur` en iOS es un wrapper directo sobre `UIVisualEffectView`.
   - Corre 100% acelerado por hardware en el compositor de GPU de iOS.
   - Soporta nativamente estilos de material de Apple (`systemUltraThinMaterialDark`, `systemThinMaterialDark`, `dark`).
   - El costo computacional durante el scroll de 120 FPS es prácticamente cero.

2. **Soporte en Android (RenderNode / DimezisBlurView)**:
   - En Android, `expo-blur` requiere para desenfoque dinámico envolver el contenido en `<BlurTargetView ref={targetRef}>` y pasar `blurTarget={targetRef}` junto con `blurMethod="dimezisBlurViewSdk31Plus"`.
   - Si no se especifica `blurTarget`, en Android la librería cae en `'none'`, que renderiza un fondo semitransparente simple (`backgroundColor: rgba(...)`) sin desenfoque real.
   - En dispositivos Android < 12 (SDK 30 hacia abajo), el blur dinámico de vistas complejas genera sobrecarga en la CPU/GPU. Por ello, la política recomendada en Expo es `dimezisBlurViewSdk31Plus` (desenfoque real en Android 12+ y fallback suave en versiones anteriores).

### 4.2 El Desafío del "Borde Rígido" del Blur y Soluciones de Diseño

Un `BlurView` es, por definición en UIKit y Android, una vista rectangular de bordes rectos. Si simplemente colocamos un `BlurView` rectangular cubriendo el Header desde `y = 0` hasta debajo de los tabs, nos encontraremos con un **nuevo tipo de corte**:

- El contenido del formulario fuera del `BlurView` estará 100% enfocado.
- En cuanto cruza el borde inferior del `BlurView`, se desenfoca de golpe.
- Esto produce una línea de discontinuidad óptica en el borde inferior del Header.

Para resolver esto y conseguir la estética fluida que busca el usuario (inspirada en Apple Design y Emil Kowalski), se analizan tres estrategias:

#### Estrategia A: Blur con Gradiente de Atenuación (Hybrid Blur + Masked/Gradient Feathering)

- Consiste en superponer el `BlurView` en la zona del Header y añadir en su borde inferior un fundido suave (`LinearGradient` de 20-30px) que pase de la opacidad del blur al negro transparente.
- **Resultado**: El contenido no pasa bruscamente de nítido a desenfocado; se difumina suavemente como en las barras de Apple Music o iOS Photos.

#### Estrategia B: BlurView Flotante con Borde Material (`systemUltraThinMaterialDark`)

- En lugar de intentar disimular el corte, se asume el Header y TabBar como una **superficie funcional flotante unificada**:
  - Un contenedor con `BlurView` (`tint="systemUltraThinMaterialDark"`, `intensity={80}`).
  - Borde inferior sutil con luz tenue (`borderBottomWidth: StyleSheet.hairlineWidth`, `borderColor: 'rgba(255, 255, 255, 0.08)'`).
  - Esto sigue las directrices de Apple Design (§12 _Materials & Depth_): _"Build nav/toolbars as translucent layers with content scrolling underneath"_.
- **Resultado**: El usuario percibe una barra de navegación de cristal oscuro sobre la que descansan el título y los tabs, mientras los datos del formulario se deslizan por detrás.

#### Estrategia C: Header Blur Reactivo al Scroll

- La barra superior permanece transparente cuando `scrollY === 0`.
- Cuando el usuario empieza a scrollear (`scrollY > 5px`), la opacidad del `BlurView` superior se anima suavemente de 0 a 1 usando un `useAnimatedStyle` de Reanimated vinculado al scroll.
- **Resultado**: Cuando el usuario está al principio, el diseño es negro puro OLED 100% limpio. Solo cuando el contenido viaja hacia arriba, el material de cristal "emerge" para proteger la legibilidad de los textos del Header.

---

## 5. Gestión de Gestos y Pointer Events

Uno de los mayores riesgos al hacer un `AnimatedPagerView` edge-to-edge con overlays flotantes es el conflicto de toques y gestos.

### 5.1 Jerarquía de Gestos Actual

- `react-native-pager-view`: Swipe horizontal entre los 5 modos de entrenamiento.
- `SegmentedTabBar`: Posee un `GestureDetector` con `Gesture.Race(panGesture, tapGesture)` para arrastre continuo (scrubbing) y selección por tap.
- `ScrollView` (dentro de cada formulario): Desplazamiento vertical.

### 5.2 Reglas para evitar Bloqueos de Interacción

1. **Contenedor del Header**: Debe tener `pointerEvents="box-none"`.
   ```tsx
   <View pointerEvents="box-none" style={styles.floatingHeaderContainer}>
     <BlurView ... />
     <View style={styles.header}>
       <Text>Cron</Text>
       <Logo />
     </View>
     <SegmentedTabBar ... />
   </View>
   ```
   Con `pointerEvents="box-none"`, los toques en las áreas vacías entre el título y el logo no bloquean el `ScrollView` de fondo.
2. **SegmentedTabBar**: El `GestureDetector` de los tabs debe seguir capturando prioritariamente el Pan horizontal y los Taps sobre las pastillas. Dado que `Gesture.Pan()` en `SegmentedTabBar` tiene `activeOffsetX([-5, 5])`, solo se activa con movimiento horizontal en la barra, permitiendo que un gesto vertical en esa zona no interfiera.
3. **Floating Action Dock**: El footer ya implementa `pointerEvents="box-none"` en su contenedor externo, permitiendo tocar el botón Start o Settings, pero dejando pasar toques fuera de los botones si los hubiera.

---

## 6. Plan de Implementación Paso a Paso

### Fase 1: Incorporación de Dependencia y Mocks

- **Instalar `expo-blur`**:
  ```bash
  pnpm add expo-blur@~58.0.5
  ```
- **Configurar Mock en Jest (`jest.setup.ts`)**: Crear el mock para `BlurView` y `BlurTargetView` para asegurar que los 30 tests de `screens/menu` sigan pasando sin errores.

### Fase 2: Extensión de Tipos y Geometría del Pager

- En [`screens/menu/components/form-pager/types.ts`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/form-pager/types.ts): Actualizar `FormTabOption`:
  ```typescript
  export interface FormInsets {
    top: number;
    bottom: number;
  }

  export interface FormTabOption<T extends string> {
    value: T;
    label: string;
    content: React.ReactNode | ((insets: FormInsets) => React.ReactNode);
  }
  ```
- En [`screens/menu/pages.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/pages.tsx): Propagar tanto `paddingTop` como `paddingBottom` a los 5 formularios:
  ```typescript
  export const MENU_PAGES: FormTabOption<TimerMode>[] = TIMER_MODES.map((mode) => {
    const FormComponent = FORM_COMPONENTS[mode];
    return {
      content: (insets) => (
        <FormComponent
          paddingTop={insets.top}
          paddingBottom={insets.bottom}
        />
      ),
      label: mode,
      value: mode,
    };
  });
  ```

### Fase 3: Reestructuración de `screens/menu/index.tsx`

- Separar el `AnimatedPagerView` para que ocupe toda la pantalla de forma absoluta (`StyleSheet.absoluteFillObject`).
- Colocar el Header Flotante (`FloatingHeader`) en posición absoluta superior con `BlurView`.
- Reemplazar el `LinearGradient` inferior por el `BlurView` con idéntico tint (`systemUltraThinMaterialDark` o `dark`).

### Fase 4: Actualización de los Formularios Individuales

- Modificar [`interval-form.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/forms/interval-form.tsx), [`emom-form.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/forms/emom-form.tsx), [`for-time-form.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/forms/for-time-form.tsx), [`amrap-form.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/forms/amrap-form.tsx) y [`stopwatch-form.tsx`](file:///home/pk/.t3/worktrees/cron/t3-c80e420d-edb8afa1033f3afd/screens/menu/components/forms/stopwatch-form.tsx):
  ```tsx
  <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={{
      paddingTop,
      paddingBottom,
    }}
    scrollIndicatorInsets={{
      top: paddingTop,
      bottom: paddingBottom,
    }}
  >
  ```

### Fase 5: Validación y Benchmarking

- Ejecutar suite de pruebas: `pnpm test screens/menu`.
- Verificar linter y tipos: `pnpm typecheck && pnpm lint`.
- Probar en simulador iOS y emulador Android para verificar la fluidez del blur a 120 FPS.

---

## 7. Conclusiones y Recomendación Final

La propuesta de hacer el menú edge-to-edge con `expo-blur` es **completamente viable y arquitectónicamente coherente** con el stack actual de `cron` (React Native 0.88, Fabric, Reanimated 4, PagerView nativo).

**Recomendaciones clave**:

1. **Adopción de `expo-blur`**: Es la herramienta estándar para lograr materiales translúcidos en Expo SDK 58. En iOS se beneficia directamente de `UIVisualEffectView`. En Android debe configurarse con `dimezisBlurViewSdk31Plus` para proteger dispositivos con versiones anteriores a Android 12.
2. **Acabado Visual del Header**: Para evitar el "borde rígido" del blur, la opción más elegante es tratar el Header y el TabBar como una barra de cristal unificada con un sutil borde translúcido inferior (`borderColor: 'rgba(255,255,255,0.08)'`), combinable opcionalmente con un desvanecimiento suave de opacidad.
3. **Cálculo Determinista de Insets**: Centralizar la altura del header en constantes de métricas claras para evitar discrepancias entre los distintos formularios al cambiar de modo en el pager.
