import type { FormTabOption } from '@/screens/menu/components/form-pager/types';
import { ForTimeForm } from '@/screens/menu/components/forms/for-time-form';
import { AmrapForm } from '@/screens/menu/components/forms/amrap-form';
import { EmomForm } from '@/screens/menu/components/forms/emom-form';
import { IntervalForm } from '@/screens/menu/components/forms/interval-form';
import { StopWatchForm } from '@/screens/menu/components/forms/stopwatch-form';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { useRouter } from 'expo-router';
import { createRef, useCallback, useMemo, useRef } from 'react';
import type { FormHandle } from '@/screens/menu/schema';
import { TIMER_MODES } from '@/screens/menu/schema';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';
import { useAtom } from 'jotai/react';
import { isRawTimerEnabledAtom } from '@/stores/settings';

const FORM_COMPONENTS = {
  [TimerMode.FOR_TIME]: ForTimeForm,
  [TimerMode.AMRAP]: AmrapForm,
  [TimerMode.INTERVAL]: IntervalForm,
  [TimerMode.EMOM]: EmomForm,
  [TimerMode.STOP_WATCH]: StopWatchForm,
};

export const useTimerForms = () => {
  const router = useRouter();
  const [isRawTimerEnabled] = useAtom(isRawTimerEnabledAtom);

  const formRefs = useRef(
    new Map(TIMER_MODES.map((mode) => [mode, createRef<FormHandle>()]))
  );

  const handleSubmitConfig = useCallback(
    (config: TimerConfig) => {
      router.push({
        params: serializeTimerConfig(config),
        pathname: isRawTimerEnabled ? '/timer/inspector' : '/timer',
      });
    },
    [isRawTimerEnabled, router]
  );

  const pages = useMemo<FormTabOption<TimerMode>[]>(
    () =>
      TIMER_MODES.map((mode) => {
        const FormComponent = FORM_COMPONENTS[mode];
        return {
          content: (
            <FormComponent
              ref={formRefs.current.get(mode)}
              onSubmit={handleSubmitConfig}
            />
          ),
          label: mode,
          value: mode,
        };
      }),
    [handleSubmitConfig]
  );

  const startTimer = useCallback((mode: TimerMode) => {
    formRefs.current.get(mode)?.current?.submit();
  }, []);

  return { pages, startTimer };
};
