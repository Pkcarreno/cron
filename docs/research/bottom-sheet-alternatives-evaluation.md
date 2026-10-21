# Evaluación Técnica: Alternativas a `@gorhom/bottom-sheet` en `cron`

- **Repositorio**: `cron`
- **Entorno**: React Native 0.88.0, Expo SDK ~58.0.16, New Architecture (Fabric), React 19.3.0
- **Librerías Core**: `react-native-reanimated@4.7.1`, `react-native-gesture-handler@~3.3.0`, `react-native-screens@~4.30.0`
- **Estado Actual**: `@gorhom/bottom-sheet@^5.2.14`
- **Fecha**: Octubre 2026
- **Estado**: Evaluación de Investigación Completa

---

## 1. Resumen Ejecutivo y Diagnóstico

El objetivo de esta investigación es determinar si es viable y recomendable reemplazar `@gorhom/bottom-sheet` en el proyecto `cron`, motivado por la recurrente fricción al actualizar dependencias (Expo SDK, React Native, Reanimated y Gesture Handler).

### 1.1 El Problema Fundamental de `@gorhom/bottom-sheet`

`@gorhom/bottom-sheet` es la solución más popular en el ecosistema, pero sufre de un problema estructural de acoplamiento:

1. **Acoplamiento profundo a internals de Reanimated**: Depende íntimamente de las versiones internas del motor de worklets (`react-native-worklets`), `useSharedValue`, animaciones de layout y el ciclo de vida de Reanimated.
2. **Dependencia estricta de Gesture Handler**: Con la transición de RNGH v2 (Builder API) a RNGH v3 (Hook API en SDK 58), las librerías basadas en gestos de JS sufren desajustes frecuentes en tipos y comportamiento en runtime.
3. **Costo de actualización**: Como se constató en [`docs/research/expo-upgrade-evaluation.md`](file:///home/pk/Projects/cron/docs/research/expo-upgrade-evaluation.md), cada actualización mayor de Expo o React Native suele verse frenada esperando a que `@gorhom/bottom-sheet` publique un parche compatible con las versiones fijadas por Expo.

### 1.2 Diagnóstico del Uso Actual en `cron`

Al auditar el código de `cron`, se observa una ventaja arquitectónica clave:

- `@gorhom/bottom-sheet` **no está disperso** en la aplicación.
- Está completamente encapsulado dentro de [`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx), el cual provee una API de alto nivel declarativa (estilo Radix / `@rn-primitives`): `<Sheet>`, `<SheetTrigger>`, `<SheetContent>`, `<SheetHeader>`, `<SheetTitle>`.
- El único consumidor real en la app es [`components/input-number.tsx`](file:///home/pk/Projects/cron/components/input-number.tsx) (`NumberPickerSheet`), utilizado para la selección de números en formularios de configuración (`screens/settings/index.tsx`) y menús (`screens/menu/index.tsx`).
- Se utiliza con `enableDynamicSizing={true}` para ajustarse al contenido del formulario.
- En [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx) existe un `<BottomSheetModalProvider>` obligatorio en la raíz.

**Conclusión preliminar**: Dado que el uso está totalmente encapsulado y solo se requiere para un modal de selección numérico con auto-altura, **el costo de migración es mínimo (menos de un día de trabajo)** y el riesgo de regresión es muy bajo.

---

## 2. Análisis Detallado de Opciones

### Opción A: `@lodev09/react-native-true-sheet` (True Sheet v3 / v4)

**¿Cómo funciona?** True Sheet no emula las físicas ni los gestos en JavaScript. En su lugar, es un wrapper nativo en C++/Objective-C/Kotlin sobre las APIs nativas del sistema operativo:

- **iOS**: `UISheetPresentationController` (nativo desde iOS 15).
- **Android**: `com.google.android.material.bottomsheet.BottomSheetDialog` / `BottomSheetBehavior`.

#### Beneficios (Pros):

- **Desacoplamiento total de Reanimated y Gesture Handler**: No utiliza worklets ni gestos de JS para el movimiento del sheet. Los upgrades de Expo SDK y Reanimated jamás volverán a romper los sheets.
- **Rendimiento 100% nativo a 60/120 FPS**: El arrastre, inercia, rebote y descarte ocurren directamente en el hilo principal del sistema operativo (UIKit / Android View system).
- **Soporte Fabric / New Architecture de primera clase**: Versiones v3+ y v4 están construidas con TurboModules y Fabric Components.
- **Manejo nativo de Teclado**: No requiere hacks de `KeyboardAvoidingView` en JS; el sistema operativo desplaza el sheet nativamente cuando se enfoca un `TextInput`.
- **Dynamic Sizing nativo**: Soporta `detents={['auto']}` para medir el contenido automáticamente, justo lo que necesita `NumberPickerSheet`.
- **API imperativa limpia y async**: Métodos `await sheetRef.current?.present()` y `await sheetRef.current?.dismiss()` devuelven Promises.
- **Eliminación de providers globales**: No necesita ningún provider en la raíz como `BottomSheetModalProvider`.

#### Contras:

- **Diferencias visuales de plataforma (Por diseño)**: En iOS se ve y comporta como una hoja modal de Apple; en Android se ve y comporta como el componente Material de Google. Si se busca paridad de píxeles 1:1 estricta entre iOS y Android, no es la opción adecuada.
- **Requiere Development Build**: Al tener código nativo, requiere prebuild (lo cual `cron` ya tiene configurado con EAS y carpetas `ios/` y `android/`).
- **Control de animaciones complejas**: No permite interpolar valores compartidos de Reanimated durante el arrastre para animar otros elementos en segundo plano en la pantalla padre.

---

### Opción B: Native Modals vía Expo Router / `react-native-screens` (`presentation: 'formSheet'`)

**¿Cómo funciona?** Tanto React Navigation como Expo Router (vía `react-native-screens`) soportan la presentación de pantallas como hojas modales nativas usando las mismas APIs del sistema operativo (`UISheetPresentationController` y Material BottomSheet).

```tsx
// app/_layout.tsx o ruta modal
<Stack.Screen
  name="number-picker-modal"
  options={{
    presentation: "formSheet",
    sheetAllowedDetents: [0.5, 0.9],
    sheetGrabberVisible: true,
    sheetCornerRadius: 24,
  }}
/>
```

#### Beneficios (Pros):

- **Cero dependencias adicionales**: Ya está instalado y configurado en el proyecto (`expo-router` y `react-native-screens`).
- **Recomendación oficial del skill de buenas prácticas**: Respaldado por el skill del repo [`.agents/skills/vercel-react-native-skills/rules/ui-native-modals.md`](file:///home/pk/Projects/cron/.agents/skills/vercel-react-native-skills/rules/ui-native-modals.md) (_"Use Native Modals Over JS-Based Bottom Sheets"_).
- **Historial y Deep Linking**: Cada apertura de sheet es una URL navegable en Expo Router (`router.push('/number-picker')`), facilitando el botón 'Atrás' de Android sin listeners manuales.

#### Contras:

- **Modelo mental de navegación vs. Estado local**: Convertir un picker efímero (como cambiar un número de minutos en un formulario con draft local) en una ruta de Expo Router obliga a gestionar el estado mediante parámetros de URL o un store global (Jotai), perdiendo la simplicidad del callback `onChange(val)`.
- **Detents dinámicos limitados en Android**: En Android, `react-native-screens` restringe los detents a un máximo de 3 valores fijos y el soporte de altura dinámica ('auto' / fitToContents) ha presentado inconsistencias entre versiones de Android Material.
- **Menor ergonomía para componentes compuestos**: Rompe la abstracción de `<SheetTrigger>` / `<SheetContent>` inline dentro del propio JSX del componente que lo invoca.

---

### Opción C: Crear un Bottom Sheet Custom (In-House con Reanimated 4 + RNGH v3)

**¿Cómo funciona?** Implementar en [`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx) un componente propio utilizando:

- `<GestureDetector gesture={panGesture}>` de `react-native-gesture-handler`.
- `useAnimatedStyle`, `withSpring`, `useSharedValue` de `react-native-reanimated`.
- Medición de altura vía `onLayout`.
- Renderizado sobre el `<PortalHost />` existente de `@rn-primitives/portal`.

#### Beneficios (Pros):

- **Control absoluto**: Cero riesgo de abandono de librerías de terceros; el código fuente reside directamente en el repositorio.
- **Mismo look & feel multiplataforma**: Físicas de resorte idénticas en iOS y Android.
- **Cero dependencias externas adicionales**: No agrega ningún paquete nuevo a `package.json`.
- **Alineado con el stack moderno de `cron`**: Aprovecha que `cron` ya cuenta con Reanimated 4.7 y Gesture Handler 3.3.

#### Contras:

- **Alto costo de desarrollo y mantenimiento (Reinventar la rueda)**:
  - Físicas de inercia y velocidad: gestionar el snap point correcto según la velocidad del swipe requiere calibración fina de resortes.
  - Comportamiento de rebote (rubber-banding) al sobrepasar el límite superior.
  - Insets de área segura (`useSafeAreaInsets`) y notch/home bar.
  - Gestión del botón 'Atrás' en Android (`BackHandler`).
  - Accesibilidad (`accessibilityViewIsModal`, anuncios de VoiceOver/TalkBack).
  - Manejo de teclado: asegurar que el sheet se mueva adecuadamente cuando el teclado se despliega sin temblores ni saltos de layout.
- **Aún acoplado a Reanimated y RNGH**: Si bien eliminas a `@gorhom/bottom-sheet`, el código custom seguirá requiriendo mantenimiento cuando Reanimated o RNGH introduzcan cambios de API.

---

### Opción D: Mantener `@gorhom/bottom-sheet` (Status Quo)

#### Beneficios:

- Cero trabajo inmediato de desarrollo.
- Actualmente la versión `^5.2.14` funciona con Expo 58 y Reanimated 4.7.1.

#### Contras:

- Mantiene la deuda técnica de cara a las próximas versiones de Expo (SDK 59+).
- Requiere mantener el Provider global `<BottomSheetModalProvider>` en el árbol de render de la aplicación.
- Configuración de mocks compleja en Jest (`jest.setup.ts` requiere mocks específicos para evitar fallos).

---

### Resumen de Otras Alternativas del Ecosistema

- **`react-native-actions-sheet`**: Excelente librería para hojas de acción simples y menús con buen soporte de teclado. Sin embargo, sigue siendo una implementación en JS/Reanimated y su API está más orientada a modales de confirmación que a contenedores de controles complejos.
- **`@rn-primitives/dialog`** (Radix para React Native): `cron` ya usa `@rn-primitives` para dropdowns y switches. Es ideal para diálogos modales centrados o alertas, pero no implementa gestos de arrastre hacia abajo (drag-to-dismiss) con resortes.
- **`react-native-modalize`**: Prácticamente **obsoleta y abandonada**. No tiene soporte oficial para la New Architecture (Fabric) ni React 19; debe descartarse por completo.

---

## 3. Matriz Comparativa de Decisiones

| Criterio | `@gorhom/bottom-sheet` (Actual) | `@lodev09/react-native-true-sheet` | Native Stack (`formSheet`) | Custom (Reanimated + RNGH) |
| :-- | :-: | :-: | :-: | :-: |
| **Inmunidad a rupturas de actualización** | 🔴 Baja (frecuentes bloqueos) | 🟢 **Muy Alta** (0 dependencias con worklets) | 🟢 **Muy Alta** (incluido en el core) | 🟡 Media (depende de tu mantenimiento) |
| **Rendimiento y fluidez (FPS)** | 🟡 60 FPS (hilo UI/worklet) | 🟢 **120 FPS** (Nativo UIKit/Android) | 🟢 **120 FPS** (Nativo UIKit/Android) | 🟡 60 FPS (hilo UI/worklet) |
| **Dynamic Sizing ('auto' height)** | 🟢 Sí (`enableDynamicSizing`) | 🟢 Sí (`detents={['auto']}`) | 🟡 Parcial (inestable en Android) | 🟡 Requiere cálculo manual `onLayout` |
| **Conflictos con Teclado** | 🟡 Requiere wrappers específicos | 🟢 **Automático / Nativo** | 🟢 **Automático / Nativo** | 🔴 Complejo de afinar |
| **Modelo de Integración** | Componente / Modal Provider | Componente / Ref imperativo | Ruta en Expo Router | Componente / Portal |
| **Esfuerzo de migración en `cron`** | N/A (Actual) | 🟢 **Bajo** (~2 horas) | 🔴 Alto (reestructurar navegación) | 🔴 Medio-Alto (escribir y probar gestos) |
| **Soporte Fabric (New Arch)** | 🟡 Compatible v5 | 🟢 **Nativo TurboModule/Fabric** | 🟢 **Nativo** | 🟢 Nativo |

---

## 4. Veredicto: ¿Vale la pena migrar?

### Recomendación Estratégica: **SÍ, vale la pena migrar.**

La combinación de factores en `cron` hace que la migración sea una decisión con un retorno de inversión muy alto:

1. **La molestia es real**: En cada salto de Expo SDK, `@gorhom/bottom-sheet` es el sospechoso principal de incompatibilidades con Reanimated o React Native.
2. **El costo de cambio es extremadamente bajo**: En proyectos donde `@gorhom/bottom-sheet` se usa en decenas de pantallas con FlatLists y pagers, migrar es doloroso. En `cron`, **solamente se usa en un archivo ([`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx)) para el `NumberPickerSheet`**.
3. **La mejor alternativa técnica es `@lodev09/react-native-true-sheet`**:
   - Resuelve exactamente el dolor: **cero dependencias con Reanimated y RNGH**.
   - Provee soporte para `'auto'` detent out-of-the-box, manteniendo el comportamiento dinámico actual de `NumberPickerSheet`.
   - Se adapta de forma limpia a la API existente de `components/sheet.tsx` (`open`, `onOpenChange`, `SheetTrigger`, `SheetContent`).
   - Permite retirar `<BottomSheetModalProvider>` de [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx).

---

## 5. Plan de Migración (Blueprint de Implementación)

### Paso 1: Instalación de la dependencia

```bash
pnpm add @lodev09/react-native-true-sheet
```

### Paso 2: Adaptación de [`components/sheet.tsx`](file:///home/pk/Projects/cron/components/sheet.tsx)

Se mantiene exactamente la misma interfaz externa (`Sheet`, `SheetTrigger`, `SheetContent`, `SheetTitle`, etc.) para que ningún consumidor (`NumberPickerSheet`, `screens/settings`, etc.) tenga que modificarse.

```tsx
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Pressable,
  View,
  StyleSheet,
  type PressableProps,
  type ViewProps,
  type TextProps,
} from "react-native";

import { colors } from "@/helpers/colors";

import { Text } from "./text";

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  sheetRef: React.RefObject<TrueSheet | null>;
}

const SheetContext = createContext<SheetContextType | null>(null);

export const useSheetContext = () => {
  const context = useContext(SheetContext);
  if (!context)
    throw new Error("Sheet components must be used within a <Sheet>");
  return context;
};

export interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Sheet: React.FC<SheetProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const sheetRef = useRef<TrueSheet>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleSetOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange]
  );

  useEffect(() => {
    if (open) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen: handleSetOpen, sheetRef }),
    [open, handleSetOpen]
  );

  return (
    <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
  );
};

export const SheetContent: React.FC<{
  children: React.ReactNode;
  enableDynamicSizing?: boolean;
  onDismiss?: () => void;
}> = ({ children, enableDynamicSizing = true, onDismiss }) => {
  const { sheetRef, setOpen } = useSheetContext();

  return (
    <TrueSheet
      ref={sheetRef}
      detents={enableDynamicSizing ? ["auto"] : [0.5, 0.9]}
      cornerRadius={24}
      backgroundColor={colors.neutral[900]}
      onDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
    >
      <View style={styles.contentContainer}>{children}</View>
    </TrueSheet>
  );
};
```

### Paso 3: Limpieza en la raíz

En [`app/_layout.tsx`](file:///home/pk/Projects/cron/app/_layout.tsx):

- Eliminar la importación de `BottomSheetModalProvider`.
- Remover el `<BottomSheetModalProvider>` envolviendo la jerarquía.

### Paso 4: Desinstalación y Mocks

- Desinstalar `@gorhom/bottom-sheet`:
  ```bash
  pnpm remove @gorhom/bottom-sheet
  ```
- Actualizar [`jest.setup.ts`](file:///home/pk/Projects/cron/jest.setup.ts) reemplazando el mock de `@gorhom/bottom-sheet/mock` por un mock ligero de `TrueSheet`.

---

## 6. Referencias y Fuentes Primarias

1. **`@lodev09/react-native-true-sheet` Repository & Docs**: [GitHub - lodev09/react-native-true-sheet](https://github.com/lodev09/react-native-true-sheet)
2. **Apple UIKit Documentation**: [UISheetPresentationController](https://developer.apple.com/documentation/uikit/uisheetpresentationcontroller)
3. **Android Material Components**: [Bottom Sheet Behavior & Dialogs](https://developer.android.com/reference/com/google/android/material/bottomsheet/BottomSheetDialog)
4. **React Native Screens**: [Native Stack Sheet detents documentation](https://software-mansion.github.io/react-native-screens/)
5. **Vercel React Native Guidelines en `cron`**: [`rules/ui-native-modals.md`](file:///home/pk/Projects/cron/.agents/skills/vercel-react-native-skills/rules/ui-native-modals.md)
6. **Reporte de Dependencias del Proyecto**: [`docs/research/expo-upgrade-evaluation.md`](file:///home/pk/Projects/cron/docs/research/expo-upgrade-evaluation.md)
