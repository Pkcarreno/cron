# Investigación Técnica: Cohesión Visual y Arquitectura de Botones en el Floating Action Dock

- **Repositorio**: `cron`
- **Entorno**: React Native 0.88.0, Expo SDK 58 (`~58.0.16`), New Architecture (Fabric), React 19 (`19.3.0`), `expo-blur` (`~58.0.5`), Jotai 2 (`2.19.1`)
- **Archivos Clave Analizados**:
  - [`screens/menu/components/floating-action-dock.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/screens/menu/components/floating-action-dock.tsx)
  - [`components/button.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/button.tsx)
  - [`components/glass-surface.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/glass-surface.tsx)
  - [`screens/menu/components/form-pager/metrics.ts`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/screens/menu/components/form-pager/metrics.ts)
  - [`docs/adr/0006-menu-custom-tabs-and-segmented-pager.md`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/docs/adr/0006-menu-custom-tabs-and-segmented-pager.md)
- **Fecha**: Noviembre 2026
- **Estado**: Investigación de Arquitectura y Propuestas de Diseño

---

## 1. Resumen Ejecutivo

El menú principal de `cron` (`screens/menu`) integra un **Floating Action Dock** inferior compuesto por una cápsula translúcida (`GlassSurface`) que alberga dos acciones principales:

1. Acceso a configuración (`Settings`, mediante icono `SlidersIcon`).
2. Disparador principal de entrenamiento (`Start`, botón de alta prominencia que inicia el temporizador seleccionado).

A raíz de la migración a superficies edge-to-edge con `expo-blur`, se han identificado dos fricciones principales de cohesión visual y diseño de componentes:

1. **Manipulación externa de estilos en vez de diseño de componentes**: En [`screens/menu/components/floating-action-dock.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/screens/menu/components/floating-action-dock.tsx#L73-L80), el componente dock inyecta manualmente `borderRadius: 22` mediante la prop `style` tanto al botón de ajustes como al botón de inicio. Esto elude las definiciones nativas del componente [`components/button.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/button.tsx) (cuyo `borderRadius` base es `8`), forzando una geometría ad-hoc para encajar con el radio exterior `28` de la cápsula.
2. **Conflicto dimensional y asimetría de alturas**: El botón de inicio utiliza el tamaño por defecto `size="md"` con `padding: 24`, produciendo una altura real de ~68px a 70px. Por contra, el botón de icono utiliza `size="icon"` con `padding: 12`, generando una altura de ~48px. Esto no solo genera un desfase visual asimétrico en el dock, sino que contradice la constante determinista `MENU_DOCK_METRICS.dockHeight = 56` definida en el sistema de layout.
3. **Incompatibilidad visual de `variant="ghost"` sobre `GlassSurface`**: La variante `ghost` en `Button` tiene como fondo `colors.neutral[950]` (`#0a0a0a`), lo cual es **completamente intencional** para contrastar sobre fondos OLED negros (`#000000`). Sin embargo, al renderizarse dentro de un `GlassSurface` con material translúcido (`systemUltraThinMaterialDark`), ese `#0a0a0a` sólido actúa como un parche opaco ("agujero negro") que bloquea la luz y el desenfoque del fondo, destruyendo la ilusión de cristal translúcido continuo.

---

## 2. Diagnóstico Detallado de la Situación Actual

### 2.1 La Anatomía de `FloatingActionDock`

```tsx
// screens/menu/components/floating-action-dock.tsx
<GlassSurface
  testID="floating-action-dock"
  collapsable={false}
  borderTreatment="full"
  blurTarget={context?.blurTargetRef}
  style={styles.capsule}
>
  <Link href="/settings" asChild>
    <Button
      size="icon"
      icon={SlidersIcon}
      variant="ghost"
      style={styles.settingsButton} // <- sobrescritura ad-hoc
    />
  </Link>

  <Button
    testID="start-timer-button"
    disabled={!isValid}
    style={styles.startButton} // <- sobrescritura ad-hoc
    title="Start"
    onPress={handleStart}
  />
</GlassSurface>;

const styles = StyleSheet.create({
  capsule: {
    alignItems: "center",
    borderRadius: 28,
    flexDirection: "row",
    gap: 8,
    padding: 6,
  },
  settingsButton: {
    borderRadius: 22, // radio manual inyectado
  },
  startButton: {
    borderRadius: 22, // radio manual inyectado
    flex: 1,
  },
});
```

### 2.2 Descomposición Matemática de los Radios y Padding

El valor `borderRadius: 22` no fue elegido al azar: proviene de la fórmula geométrica de **concentricidad de bordes**:

$$\text{Radio Interior} = \text{Radio Exterior} - \text{Padding} = 28 - 6 = 22\text{px}$$

Al tener el contenedor un radio de 28px y un padding de 6px, el espacio interno exige un radio de 22px para que la curva del hijo sea perfectamente concéntrica con la del padre.

Sin embargo, en el resto de la aplicación:

- **Botones estándar** (`components/button.tsx`): `borderRadius: 8`.
- **Menús y grupos** (`components/menu.tsx`): `borderRadius: 12`.
- **Tabs y Píldora activa** (`segmented-tab-bar.tsx`): `borderRadius: 12`.
- **Switches** (`components/switch.tsx`): `borderRadius: 9999` (píldora estricta).

Al no existir un contrato formal en `Button` para botones de tipo cápsula (`shape="pill"` o `rounded="full"`), se violó el principio de diseño de sistemas acoplando estilos externos mediante la prop `style`.

### 2.3 Discrepancia de Altura y Padding

| Elemento | Prop `size` | Padding vertical | Contenido | Altura estimada | Altura esperada por Dock Metrics |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Settings** | `size="icon"` | $12 + 12 = 24\text{px}$ | Icono 22px | **~48px** | 44px ($56 - 2 \times 6$) |
| **Start** | `size="md"` (default) | $24 + 24 = 48\text{px}$ | Texto 18px (line-height ~22px) | **~72px** | 44px ($56 - 2 \times 6$) |
| **Dock Total** | — | $6 + 6 = 12\text{px}$ | Elemento más alto (Start) | **~84px** | **56px** (`dockHeight`) |

En [`screens/menu/components/form-pager/metrics.ts`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/screens/menu/components/form-pager/metrics.ts#L17-L22):

```typescript
export const MENU_DOCK_METRICS = {
  dockHeight: 56,
  dockMarginBottom: 24,
  dockPaddingTop: 16,
  minBottomInset: 128,
} as const;
```

El sistema de insets deterministas del layout asume que el dock mide **56px** de alto. Pero la altura real del botón `Start` (72px) infla el dock a más de 84px, provocando que en pantallas pequeñas el formulario quede más tapado de lo calculado. Además, al medir 72px de alto, un `borderRadius: 22` en el botón `Start` ya **no produce una forma de cápsula/píldora** (requeriría un radio de 36px, es decir, la mitad de 72px), sino un rectángulo con esquinas redondeadas y lados verticales planos, mientras que el botón de Settings sí parece casi un círculo ($48 / 2 = 24 \approx 22$).

### 2.4 El Problema Óptico de la Variante `ghost`

En [`components/button.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/button.tsx#L121-L126):

```typescript
ghost: {
  backgroundColor: colors.neutral[950], // #0a0a0a
},
ghostText: {
  color: colors.neutral[300],
},
```

- **Por qué `#0a0a0a` es intencional**: En interfaces oscuras puras (OLED black `#000000`), un botón sin borde requiere un color tenue pero perceptible (`#0a0a0a` vs `#000000`) para delimitar el target táctil sin generar el peso visual de un botón secundario (`neutral[700]`).
- **Por qué falla dentro de `GlassSurface`**:
  - `GlassSurface` es un componente de cristal translúcido impulsado por `BlurView` (`expo-blur`) con tint `systemUltraThinMaterialDark` y un borde hairline `rgba(255, 255, 255, 0.08)`.
  - Cuando el usuario navega y hace scroll, los números, textos y campos del formulario pasan **por debajo** del dock y se difuminan con elegancia a través del cristal.
  - Al colocar un botón con `backgroundColor: colors.neutral[950]` directamente sobre el cristal, el botón actúa como una máscara opaca impenetrable.
  - Ópticamente se genera un "bloque negro" que bloquea el material translúcido. Da la impresión de un elemento descontextualizado o una pegatina opaca pegada encima de una ventana de vidrio, rompiendo la coherencia de materiales de Apple Design (§12 _Materials & Depth_).

---

## 3. Opciones de Solución: Cohesión de Estilos en Botones

Para eliminar la manipulación forzada de `borderRadius: 22` y resolver la discrepancia de alturas, se evalúan las siguientes alternativas arquitectónicas:

### Opción 1: Formalizar la Geometría en `Button` (`shape="pill" | "rounded"` y tamaño alineado a Dock) _(Recomendada)_

En lugar de que cada contenedor exterior modifique los estilos internos del botón con `style={{ borderRadius: 22 }}`, dotar a `Button` de una propiedad declarativa de forma y soporte de altura adecuada:

1. **Prop `shape` en `ButtonProps`**:
   - `shape?: "rounded" | "pill"` (por defecto `"rounded"`).
   - `styles.rounded`: `borderRadius: 8` (el estándar rectangular suavizado de la app).
   - `styles.pill`: `borderRadius: 9999` (utilizado ya en `Switch`). Con `borderRadius: 9999`, React Native renderiza automáticamente un semicírculo perfecto en los extremos sin importar la altura del elemento, garantizando concentricidad natural.
2. **Alineación de Tamaño para Docks y Barras**:
   - Para que el dock cumpla fielmente con `MENU_DOCK_METRICS.dockHeight = 56` (con padding de 6px), la altura interior debe ser exactamente **44px** (el target mínimo estándar de Apple HIG).
   - En `components/button.tsx`:
     - O bien se añade `size="dock"` (o `compact`): `paddingVertical: 10, paddingHorizontal: 16`, altura fija o implícita de 44px.
     - O bien se ajusta `size="sm"` para Start: `size="sm"` en `button.tsx` tiene `padding: 12` y `fontSize: 16`, lo que produce una altura de $12 + 12 + 16 + 2 = 42\text{-}44\text{px}$, perfectamente alineada con el botón de ajustes (`size="icon"` con `padding: 12` y tamaño de icono 20-22px).
3. **Resultado en `FloatingActionDock`**:
   ```tsx
   <GlassSurface style={styles.capsule}>
     <Link href="/settings" asChild>
       <Button
         size="dock"
         shape="pill"
         icon={SlidersIcon}
         variant="glass" // o transparent
       />
     </Link>
     <Button
       size="dock"
       shape="pill"
       variant="primary"
       title="Start"
       disabled={!isValid}
       style={styles.startButton} // únicamente { flex: 1 }
       onPress={handleStart}
     />
   </GlassSurface>
   ```

- **Ventajas**:
  - Elimina los estilos "mágicos" (`borderRadius: 22`).
  - Convierte la capacidad de botón-píldora en una opción reutilizable en todo el sistema.
  - Reconcilia la altura real del dock con `MENU_DOCK_METRICS.dockHeight = 56`.
  - Ambos botones (Start y Settings) quedan con exactamente la misma altura (44px) y curvatura perfecta.

---

### Opción 2: Dock Rectangular Suavizado alineado al Radio Estándar de la App (`borderRadius: 14`)

Si la intención es que el dock se sienta más hermano de los menús de la app:

- Modificar el contenedor del dock para que no sea una cápsula semicircular, sino una barra flotante suavizada con `borderRadius: 14` (similar a `MenuGroup` con `borderRadius: 12`).
- De este modo, los botones dentro del dock pueden mantener el `borderRadius: 8` por defecto de `Button` sin ninguna modificación de radio.

- **Ventajas**:
  - Máxima homogeneidad con las listas de `screens/settings` y los `MenuGroup`.
  - No requiere alterar la prop `shape` en `Button`.
- **Desventajas**:
  - Pierde la silueta de "cápsula flotante" (pill FAB) característica de las barras de acción flotantes de Apple (como en iOS 18 o visionOS).
  - La cápsula flotante inferior es un patrón visualmente diferenciador frente a las cajas de contenido del formulario.

---

## 4. Opciones de Solución: Variante de Ajustes sobre `GlassSurface`

Dado que `variant="ghost"` con fondo `colors.neutral[950]` es intencional y necesario para vistas con fondo opaco, se exploran las siguientes soluciones específicas para no romper ese comportamiento y resolver el problema en el dock:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPARATIVA VISUAL                              │
├────────────────────────────────────────────────────────────────────────┤
│ Actual: Ghost opaco (neutral[950]) sobre GlassSurface                  │
│ [  (■ Settings #0a0a0a)     (    Start Primary White    )  ] <- Parche │
├────────────────────────────────────────────────────────────────────────┤
│ Opción A: Variante "glass" (fill translúcido con blur continuo)       │
│ [  (░ Settings 8% white)    (    Start Primary White    )  ] <- Fluido │
├────────────────────────────────────────────────────────────────────────┤
│ Opción B: Variante "clear" (totalmente transparente en reposo)         │
│ [  (  Settings icon only )  (    Start Primary White    )  ] <- Minimal│
├────────────────────────────────────────────────────────────────────────┤
│ Opción C: Utilidad integrada con separador sutil                       │
│ [   Settings  │             Start Primary White            ] <- Toolbar│
└────────────────────────────────────────────────────────────────────────┘
```

---

### Opción A: Nueva variante `variant="glass"` en `Button` _(Recomendada)_

Incorporar en `components/button.tsx` una variante diseñada explícitamente para elementos que reposan sobre superficies translúcidas (`GlassSurface`, cabeceras de cristal, modales flotantes).

#### Especificación Técnica:

```typescript
// components/button.tsx
const variantStyles = StyleSheet.create({
  // ...
  glass: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: colors.glassBorder, // "rgba(255, 255, 255, 0.08)"
  },
  glassText: {
    color: colors.neutral[300],
  },
});
```

- **Comportamiento en reposo**:
  - Fondo sutilmente iluminado por un 8% de blanco translúcido (`rgba(255, 255, 255, 0.08)`).
  - Borde hairline translúcido.
  - Al no ser opaco, la luz del desenfoque de `BlurView` atraviesa el botón. Da la sensación de una tecla tallada en el propio cristal (material depth).
- **Comportamiento en `:pressed`**:
  - Al presionarse, el scale baja a `0.96` (o `0.97`) y la opacidad/color se intensifica sutilmente a `rgba(255, 255, 255, 0.16)`.
- **Por qué funciona**:
  - Respeta íntegramente la variante `ghost` existente para sus usos normales.
  - Proporciona una variante semántica clara (`glass`) que podrá ser usada en cualquier botón que viva sobre un `GlassSurface`.
  - Sigue la directriz de Apple Design (§12 _Materials & Depth_): _"Translucent controls on translucent surfaces inherit background radiance without creating solid occlusion"_.

---

### Opción B: Variante `variant="clear"` o prop `transparent` (100% transparente en reposo)

Crear una variante `clear` (o prop `transparent?: boolean`) donde el botón no tenga ningún fondo en estado de reposo:

```typescript
clear: {
  backgroundColor: colors.transparent,
  borderColor: colors.transparent,
},
clearText: {
  color: colors.neutral[300],
},
```

- **Comportamiento**:
  - En reposo, únicamente se dibuja el icono `SlidersIcon` flotando sobre el cristal del dock.
  - Al presionarse (`pressed`), se activa una respuesta visual táctil (ej. feedback de escala `0.96` y fondo temporal translúcido).
- **Ventajas**:
  - Es el patrón clásico de las Toolbars nativas de iOS (donde los botones con icono no tienen cápsula interna; la cápsula la da la barra exterior).
  - Maximiza la jerarquía del botón `Start`: no hay ningún elemento que compita en forma con él, `Start` es el único botón con cápsula sólida blanca.
- **Desventajas**:
  - El target táctil del icono no tiene una delimitación visual explícita en reposo (aunque su hit-box sea de 44x44px).

---

### Opción C: Utilidad Integrada en el Dock (Dock Split Layout)

En lugar de tratar a Settings como un botón independiente dentro de la cápsula:

- El dock se concibe como una sola barra de herramientas unificada.
- El icono de ajustes se sitúa a la izquierda, separado del botón Start por una línea divisoria vertical sutil (`borderRightWidth: StyleSheet.hairlineWidth`, `borderRightColor: colors.glassBorder`).
- El botón Start ocupa el resto del espacio interior.

- **Ventajas**:
  - Aspecto ultra-pulido y compacto.
- **Desventajas**:
  - Requiere alterar la estructura interna de `FloatingActionDock` y añadir lógica de layout específica.

---

## 5. Tabla Comparativa de Soluciones

| Criterio | Situación Actual | Opción 1 + A (Recomendada: `shape="pill"` + `variant="glass"`) | Opción 1 + B (`shape="pill"` + `variant="clear"`) | Opción 2 (Dock Rectangular `borderRadius: 14`) |
| :-- | :-- | :-- | :-- | :-- |
| **Respeto a `variant="ghost"`** | Sólido `#0a0a0a` (intencional) | **100% Intacto** (se añade `variant="glass"`) | **100% Intacto** (se añade `variant="clear"`) | Requiere igualmente resolver el parche oscuro |
| **Cohesión con `Button`** | ❌ Manipulación ad-hoc con `style` | API declarativa oficial en `Button` | API declarativa oficial en `Button` | Usa `borderRadius: 8` nativo |
| **Comportamiento sobre Blur** | ❌ Parche opaco ("agujero negro") | Cristal translúcido continuo | Icono puro sobre cristal | ❌ Sigue teniendo el parche si no se cambia la variante |
| **Alturas y Métricas** | ❌ Start 72px vs Settings 48px (Dock 84px vs 56px) | Alturas unificadas en 44px (Dock 56px exacto) | Alturas unificadas en 44px (Dock 56px exacto) | ❌ Requiere ajustar paddings para cumplir 56px |
| **Fidelidad Apple Design** | Baja (bordes forzados y oclusión) | **Muy Alta** (materiales y proporciones HIG) | **Alta** (estilo iOS toolbar clásica) | Media (pierde estética de píldora flotante) |

---

## 6. Recomendación de Implementación Paso a Paso

Si se aprueba la dirección recomendada (**Opción 1 + Opción A**):

1. **Extender el componente `Button` (`components/button.tsx`)**:
   - Añadir soporte para `shape?: "rounded" | "pill"`:
     ```typescript
     export type ButtonShape = "rounded" | "pill";
     ```
   - Añadir la variante `glass`:
     ```typescript
     glass: {
       backgroundColor: "rgba(255, 255, 255, 0.08)",
       borderColor: colors.glassBorder,
     },
     glassText: {
       color: colors.neutral[300],
     },
     ```
   - Añadir o ajustar el tamaño para dock/compact: Garantizar que exista un tamaño (ej. `size="dock"` o calibrar `size="sm"` / `size="icon"`) que garantice exactamente **44px** de altura tanto para texto como para icono, preservando accesibilidad táctil.

2. **Limpiar `FloatingActionDock` (`screens/menu/components/floating-action-dock.tsx`)**:
   - Eliminar `settingsButton: { borderRadius: 22 }` y `startButton: { borderRadius: 22 }`.
   - Invocar:
     ```tsx
     <Link href="/settings" asChild>
       <Button
         size="dock"
         shape="pill"
         variant="glass"
         icon={SlidersIcon}
       />
     </Link>

     <Button
       testID="start-timer-button"
       size="dock"
       shape="pill"
       variant="primary"
       disabled={!isValid}
       style={styles.startButton} // solo { flex: 1 }
       title="Start"
       onPress={handleStart}
     />
     ```

3. **Verificación y Pruebas**:
   - Ejecutar la suite de tests existente (`screens/menu/components/floating-action-dock.test.tsx` e `index.test.tsx`).
   - Añadir tests unitarios en `components/button.test.tsx` para verificar la prop `shape="pill"` y la variante `glass`.
   - Verificar en modo oscuro y al scrollear formularios (`IntervalForm`) que el desenfoque fluya con continuidad por debajo del botón de ajustes sin generar recortes opacos.

---

## 7. Resolución Adoptada (Sesión `$grill-me`)

Tras la sesión de diseño crítico con el usuario (`$grill-me`), se acordó la siguiente arquitectura definitiva:

1. **Priorización de Ergonomía para Atletas Fatigados**:
   - Se mantiene el botón **Start** en su formato estándar grande (`size="md"`, `padding: 24`, altura ~70px, `borderRadius: 8`), priorizando que un atleta bajo esfuerzo intenso y fatiga visual/cognitiva tenga un objetivo táctil inequívoco e imposible de fallar.

2. **Geometría del Dock Concéntrica (`borderRadius: 14`)**:
   - Para que el marco acompañe con naturalidad los bordes `borderRadius: 8` de los botones sin necesidad de forzar estilos ad-hoc (`borderRadius: 22`), el dock adopta **`borderRadius: 14`** con `padding: 6` ($8 + 6 = 14\text{px}$).
   - Se eliminaron por completo las sobrescrituras manuales `borderRadius: 22` en `startButton` y `settingsButton`.

3. **Sincronización Determinista de Métricas (`dockHeight: 84`)**:
   - En [`screens/menu/components/form-pager/metrics.ts`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/screens/menu/components/form-pager/metrics.ts), `MENU_DOCK_METRICS.dockHeight` se actualizó de 56 a **84px**, reflejando la altura real del botón grande con su padding. Los cálculos de insets de scroll garantizan que ningún campo de formulario quede oculto detrás del dock.

4. **Selección de la Variante `clear` y Eliminación de Código No Utilizado**:
   - Para el botón de ajustes sobre `GlassSurface`, se seleccionó la variante **`clear`** (`backgroundColor: colors.transparent`). El icono reposa directamente sobre el cristal sin ningún bloque opaco que ocluya el desenfoque.
   - La variante experimental `glass` fue eliminada de [`components/button.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/button.tsx) para evitar código muerto.
   - Se preservó `variant="ghost"` con su `#0a0a0a` para sus casos de uso intencionales en pantallas oscuras.

5. **Pruebas y Cobertura**:
   - Se creó la suite [`components/button.test.tsx`](file:///home/pk/.t3/worktrees/cron/t3-da4ea6c7-9b5825550734c8de/components/button.test.tsx) validando las variantes, estilos base, renderizado de iconos y accesibilidad.
   - Se actualizaron las pruebas en `floating-action-dock.test.tsx` e `index.test.tsx` a `borderRadius: 14`, pasando el 100% de la suite (618 tests).
