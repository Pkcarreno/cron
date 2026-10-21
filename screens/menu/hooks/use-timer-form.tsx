import { useRouter } from "expo-router";
import { useAtom } from "jotai/react";
import { useCallback, useMemo } from "react";

import type { TimerConfig } from "@/helpers/timer/factory";
import { TimerMode } from "@/helpers/timer/factory";
import { serializeTimerConfig } from "@/helpers/timer/utils/config-serializer";
import type { FormTabOption } from "@/screens/menu/components/form-pager/types";
import { AmrapForm } from "@/screens/menu/components/forms/amrap-form";
import { EmomForm } from "@/screens/menu/components/forms/emom-form";
import { ForTimeForm } from "@/screens/menu/components/forms/for-time-form";
import { IntervalForm } from "@/screens/menu/components/forms/interval-form";
import { StopWatchForm } from "@/screens/menu/components/forms/stopwatch-form";
import { TIMER_MODES, schemasByMode } from "@/screens/menu/schema";
import { isRawTimerEnabledAtom } from "@/stores/settings";
import {
  amrapWorkoutAtom,
  emomWorkoutAtom,
  forTimeWorkoutAtom,
  intervalWorkoutAtom,
  stopWatchWorkoutAtom,
} from "@/stores/workout";

const FORM_COMPONENTS = {
  [TimerMode.FOR_TIME]: ForTimeForm,
  [TimerMode.AMRAP]: AmrapForm,
  [TimerMode.INTERVAL]: IntervalForm,
  [TimerMode.EMOM]: EmomForm,
  [TimerMode.STOP_WATCH]: StopWatchForm,
};

export const useTimerForms = (currentMode: TimerMode) => {
  const router = useRouter();
  const [isRawTimerEnabled] = useAtom(isRawTimerEnabledAtom);

  const [forTime] = useAtom(forTimeWorkoutAtom);
  const [amrap] = useAtom(amrapWorkoutAtom);
  const [emom] = useAtom(emomWorkoutAtom);
  const [interval] = useAtom(intervalWorkoutAtom);
  const [stopWatch] = useAtom(stopWatchWorkoutAtom);

  const configs: Record<TimerMode, TimerConfig> = useMemo(
    () => ({
      [TimerMode.FOR_TIME]: { mode: TimerMode.FOR_TIME, ...forTime },
      [TimerMode.AMRAP]: { mode: TimerMode.AMRAP, ...amrap },
      [TimerMode.EMOM]: { mode: TimerMode.EMOM, ...emom },
      [TimerMode.INTERVAL]: { mode: TimerMode.INTERVAL, ...interval },
      [TimerMode.STOP_WATCH]: { mode: TimerMode.STOP_WATCH, ...stopWatch },
    }),
    [forTime, amrap, emom, interval, stopWatch]
  );

  const activeConfig = configs[currentMode];

  const isValid = useMemo(() => {
    const schema = schemasByMode[currentMode];
    return schema.safeParse(activeConfig).success;
  }, [currentMode, activeConfig]);

  const startTimer = useCallback(
    (mode: TimerMode) => {
      const config = configs[mode];
      const schema = schemasByMode[mode];
      if (!schema.safeParse(config).success) {
        return;
      }
      router.push({
        params: serializeTimerConfig(config),
        pathname: isRawTimerEnabled ? "/timer/inspector" : "/timer",
      });
    },
    [configs, isRawTimerEnabled, router]
  );

  const pages = useMemo<FormTabOption<TimerMode>[]>(
    () =>
      TIMER_MODES.map((mode) => {
        const FormComponent = FORM_COMPONENTS[mode];
        return {
          content: (inset) => <FormComponent paddingBottom={inset.bottom} />,
          label: mode,
          value: mode,
        };
      }),
    []
  );

  return { activeConfig, isValid, pages, startTimer };
};
