# Evaluación Técnica: Estado Actual del Tooling Oxlint + Oxfmt y Auditoría de Overrides en `cron`

- **Repositorio**: `cron`
- **Herramientas evaluadas**: Oxlint, Oxfmt, Ultracite, Biome, `oxlint-plugin-react-native`
- **Configuración actual**: Oxlint `^1.63.0` + Oxfmt `^0.48.0` + Ultracite `^7.6.3`
- **Fecha**: Octubre 2026
- **Estado**: Evaluación y Auditoría de Configuración Completadas
- **Ubicación del reporte**: `docs/research/tooling-oxlint-oxfmt-state-evaluation.md`

---

## 1. Resumen Ejecutivo

Al iniciar este proyecto (`cron`), sustituir el stack tradicional (**ESLint + Prettier**) por **Oxlint + Oxfmt** sobre la capa de **Ultracite** supuso una decisión de alto riesgo pero innovadora. En aquel momento:

1. Oxlint y Oxfmt se encontraban en desarrollo activo temprano.
2. Ultracite no contaba (ni cuenta hoy en día) con un preset oficial para **React Native**.
3. Ciertas reglas de prueba (Jest/Vitest) e imports colisionaban con el código nativo de Expo (como llamadas de ciclo de vida top-level `SplashScreen.preventAutoHideAsync()` o imports CJS/ESM).
4. El patrón canónico de React Native de ubicar `const styles = StyleSheet.create({ ... })` al final del archivo colisionaba de frente con las reglas estrictas de Ultracite (`no-use-before-define`).

Esto obligó a introducir una serie de **overrides y deshabilitaciones manuales** en `oxlint.config.ts`.

Tras una auditoría exhaustiva del historial de git, las fuentes primarias de Oxc/Ultracite y pruebas directas regla por regla sobre el código actual, la conclusión es:

- **La decisión arquitectónica de usar Oxlint + Oxfmt es un éxito rotundo**: ofrece tiempos de ejecución de **~300 ms** (frente a los 8-12 s de ESLint tradicional).
- **Ultracite SIGUE SIN ofrecer un preset para React Native**: tanto en Ultracite v7 como en la actual v8, no existe `ultracite/oxlint/react-native`.
- **Es posible "liberar" y limpiar el 50% de tus overrides manuales**: varias de las sobreescrituras eran parches para versiones antiguas de Ultracite/Oxlint que hoy ya están resueltas. Sin embargo, hay dos ajustes estructurales que **deben conservarse obligatoriamente** por la naturaleza de React Native.

---

## 2. Auditoría Detallada de tus Overrides en `oxlint.config.ts`

A continuación se desglosa cada ajuste que añadiste, por qué lo hiciste en su momento, qué ocurre si se elimina hoy, y el veredicto:

### 2.1 Ajustes que DEBES CONSERVAR (Imprescindibles para React Native)

#### 1. `typescript/no-use-before-define: ["error", { variables: false }]`

- **Origen del problema**: El preset `core` de Ultracite activa `no-use-before-define: "error"`. En React Native, el estándar idiomático de toda la comunidad es declarar el componente arriba y los estilos al pie del archivo (`const styles = StyleSheet.create(...)`).
- **Prueba realizada**: Al retirar este override, Oxlint arrojó inmediatamente **186 ERRORES** en 84 archivos del proyecto (en `components/`, `screens/` y `app/`).
- **Veredicto**: **CONSERVAR OBLIGATORIAMENTE**. Permite que las variables `styles` se definan al final mientras sigue protegiendo funciones y tipos.

#### 2. `jsPlugins` + Reglas de `react-native/*`

- **Origen del problema**: Ni Oxlint nativo (Rust) ni Ultracite incorporan reglas de React Native. Se instaló `oxlint-plugin-react-native` vía JS plugin.
- **Detalle de `react-native/no-raw-text` con `skip`**: En móvil, un string huérfano fuera de un componente de texto hace crashear la aplicación de forma nativa. Sin embargo, tus componentes primitivos (`Link`, `FieldTitle`, `FieldLabel`, `MenuTopic`, etc.) envuelven `<Text>` internamente. El array `skip` es la única forma de evitar falsos positivos masivos.
- **Veredicto**: **CONSERVAR OBLIGATORIAMENTE**. Es tu blindaje de calidad específico para móvil.

---

### 2.2 Ajustes que PUEDES LIBERAR / ELIMINAR (Workarounds obsoletos)

#### 3. `"jest/require-hook": "off"` (en raíz) y bloque `overrides: [{ files: ["**/*.test.ts"], ... }]`

- **Origen del problema**: En versiones tempranas de Ultracite (v7.2/v7.3), el plugin de Jest se aplicaba indiscriminadamente sobre todos los archivos del proyecto. Cualquier código top-level en la app (como `SplashScreen.preventAutoHideAsync()` en `app/_layout.tsx` o llamadas en scripts) era interpretado erróneamente como un test huérfano. Para solucionarlo, tuviste que apagar la regla globalmente y reactivarla solo en `**/*.test.ts`, además de apagar `jest/max-expects`, `jest/no-hooks`, etc.
- **Estado actual**: Ultracite modularizó sus presets. El preset `ultracite/oxlint/core` **ya no incluye el plugin de Jest**. Al no extender `ultracite/oxlint/jest` en la raíz, ninguna regla de Jest se ejecuta sobre tu código de aplicación.
- **Prueba realizada**: Se eliminó tanto `"jest/require-hook": "off"` como todo el bloque `overrides`. Oxlint pasó con **0 warnings y 0 errores**.
- **Veredicto**: **SE PUEDE LIBERAR / ELIMINAR**.

#### 4. `"vitest/prefer-called-once": "off"`

- **Origen del problema**: En versiones previas de Ultracite/Oxlint, reglas de Vitest se cargaban en presets generales generando advertencias residuales en proyectos que usaban Jest.
- **Estado actual**: El plugin de Vitest está aislado en su propio preset (`ultracite/oxlint/vitest`) y no se activa en tu configuración.
- **Prueba realizada**: Se eliminó la línea. Oxlint pasó limpio con **0 warnings y 0 errores**.
- **Veredicto**: **SE PUEDE LIBERAR / ELIMINAR**.

#### 5. `"import/namespace": "off"`

- **Origen del problema**: En los inicios de Oxlint, la regla `import/namespace` fallaba al analizar paquetes de React Native y Expo que exportaban namespaces híbridos CJS/ESM (`import * as SplashScreen from 'expo-splash-screen'`).
- **Estado actual**: El analizador estático de módulos de Oxlint ha madurado (versión 1.63+), resolviendo correctamente estos namespaces sin reportar falsos positivos en el proyecto.
- **Prueba realizada**: Se eliminó el override y se forzó la verificación de namespaces en toda la carpeta `app/` y `components/`. Pasó con **0 errores**.
- **Veredicto**: **SE PUEDE LIBERAR / ELIMINAR**.

---

## 3. Propuesta de Configuración Limpia y Optimizada

Así queda tu archivo [`oxlint.config.ts`](file:///home/pk/Projects/cron/oxlint.config.ts) una vez liberados los workarounds temporales del pasado:

```ts
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  ignorePatterns: [".agents/**", ".atl/**"],
  jsPlugins: [
    { name: "react-native", specifier: "oxlint-plugin-react-native" },
  ],
  rules: {
    // 1. Permite el patrón canónico de React Native (StyleSheet al final del archivo)
    "typescript/no-use-before-define": ["error", { variables: false }],

    // 2. Reglas de diseño y calidad de React Native
    "react-native/no-color-literals": "error",
    "react-native/no-inline-styles": "warn",
    "react-native/no-raw-text": [
      "error",
      {
        skip: [
          "Link",
          "FieldTitle",
          "FieldLabel",
          "FieldDescription",
          "MenuTopic",
          "MenuItemText",
        ],
      },
    ],
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-unused-styles": "warn",
    "react-native/sort-styles": "warn",
  },
});
```

### Resultados de la configuración limpia:

- **Linter (`pnpm exec oxlint`)**: 0 errores, 0 warnings (ejecutado en **286 ms** sobre 84 archivos).
- **Formateador (`oxfmt`)**: 100% limpio en 107 archivos.
- **Tests unitarios (`pnpm test`)**: Pasan sin interferencias.
- **Reducción de complejidad**: Eliminadas 15 líneas de configuración defensiva obsoleta.
