import { useAtomValue } from "jotai";

import { TimerMode } from "@/helpers/timer/factory";
import type { FormTabOption } from "@/screens/menu/components/form-pager/types";
import { AmrapForm } from "@/screens/menu/components/forms/amrap-form";
import { EmomForm } from "@/screens/menu/components/forms/emom-form";
import { ForTimeForm } from "@/screens/menu/components/forms/for-time-form";
import { IntervalForm } from "@/screens/menu/components/forms/interval-form";
import { StopWatchForm } from "@/screens/menu/components/forms/stopwatch-form";
import { TIMER_MODES } from "@/screens/menu/schema";
import {
  activeTimerConfigAtom,
  isCurrentTimerValidAtom,
} from "@/stores/workout";

import { useStartTimer } from "./use-start-timer";

const FORM_COMPONENTS = {
  [TimerMode.FOR_TIME]: ForTimeForm,
  [TimerMode.AMRAP]: AmrapForm,
  [TimerMode.INTERVAL]: IntervalForm,
  [TimerMode.EMOM]: EmomForm,
  [TimerMode.STOP_WATCH]: StopWatchForm,
};

export const MENU_PAGES: FormTabOption<TimerMode>[] = TIMER_MODES.map(
  (mode) => {
    const FormComponent = FORM_COMPONENTS[mode];
    return {
      content: (inset) => <FormComponent paddingBottom={inset.bottom} />,
      label: mode,
      value: mode,
    };
  }
);

export const useTimerForms = (_currentMode?: TimerMode) => {
  const isValid = useAtomValue(isCurrentTimerValidAtom);
  const activeConfig = useAtomValue(activeTimerConfigAtom);
  const startTimer = useStartTimer();

  return { activeConfig, isValid, pages: MENU_PAGES, startTimer };
};
