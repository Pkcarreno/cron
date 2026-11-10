import React, { use } from "react";

import type { FormPagerContextValue } from "./types";

export const FormPagerContext =
  React.createContext<FormPagerContextValue<string> | null>(null);

/**
 * Access the active FormPager context using React 19's use() API.
 * Throws a descriptive invariant error if accessed outside a <FormPager> provider.
 */
export const useFormPagerContext = <
  T extends string = string,
>(): FormPagerContextValue<T> => {
  const context = use(FormPagerContext);
  if (!context) {
    throw new Error(
      "FormPager compound components must be rendered within a <FormPager> provider"
    );
  }
  return context as unknown as FormPagerContextValue<T>;
};
