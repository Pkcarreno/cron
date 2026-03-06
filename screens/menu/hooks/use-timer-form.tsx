import type { FormTabOption } from '@/screens/menu/components/form-pager/types';
import { EmomForm } from '@/screens/menu/components/forms/emom-form';
import { OnOffForm } from '@/screens/menu/components/forms/on-off-form';
import { TabataForm } from '@/screens/menu/components/forms/tabata-form';
import { AmrapForm } from '@/screens/menu/components/forms/amrap-form';
import { EveryForm } from '@/screens/menu/components/forms/every-form';
import { ForTimeForm } from '@/screens/menu/components/forms/for-time-form';
import type { TimerConfig } from '@/helpers/timer/factory';
import { TimerMode } from '@/helpers/timer/factory';
import { useRouter } from 'expo-router';
import { createRef, useCallback, useMemo, useRef } from 'react';
import type { FormHandle } from '@/screens/menu/schema';
import { TIMER_MODES } from '@/screens/menu/schema';
import { serializeTimerConfig } from '@/helpers/timer/utils/config-serializer';

const FORM_COMPONENTS = {
  [TimerMode.EMOM]: EmomForm,
  [TimerMode.TABATA]: TabataForm,
  [TimerMode.AMRAP]: AmrapForm,
  [TimerMode.ON_OFF]: OnOffForm,
  [TimerMode.EVERY]: EveryForm,
  [TimerMode.FOR_TIME]: ForTimeForm,
};

export const useTimerForms = (inspectMode: boolean) => {
  const router = useRouter();

  const formRefs = useRef(
    new Map(TIMER_MODES.map((mode) => [mode, createRef<FormHandle>()]))
  );

  const handleSubmitConfig = useCallback(
    (config: TimerConfig) => {
      router.push({
        params: serializeTimerConfig(config),
        pathname: inspectMode ? '/timer/inspector' : '/timer',
      });
    },
    [inspectMode, router]
  );

  const pages = useMemo<FormTabOption<Exclude<TimerMode, 'STOP_WATCH'>>[]>(
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

  const startTimer = useCallback((mode: Exclude<TimerMode, 'STOP_WATCH'>) => {
    formRefs.current.get(mode)?.current?.submit();
  }, []);

  return { pages, startTimer };
};
