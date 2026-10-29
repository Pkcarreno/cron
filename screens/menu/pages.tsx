import { TimerMode } from "@/helpers/timer/factory";
import { TIMER_MODES } from "@/helpers/timer/schemas";
import type { FormTabOption } from "@/screens/menu/components/form-pager/types";
import { AmrapForm } from "@/screens/menu/components/forms/amrap-form";
import { EmomForm } from "@/screens/menu/components/forms/emom-form";
import { ForTimeForm } from "@/screens/menu/components/forms/for-time-form";
import { IntervalForm } from "@/screens/menu/components/forms/interval-form";
import { StopWatchForm } from "@/screens/menu/components/forms/stopwatch-form";

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
