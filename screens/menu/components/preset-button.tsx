import type { ButtonProps } from '@/components/button';
import Button from '@/components/button';
import type { EmomFormValues, IntervalFormValues } from '@/screens/menu/schema';
import { useCallback } from 'react';

interface IntervalPresetButtonProps
  extends Partial<IntervalFormValues>, Pick<ButtonProps, 'disabled'> {
  title: string;
  setValue: (field: keyof IntervalFormValues, value: number) => void;
}

export const IntervalPresetButton: React.FC<IntervalPresetButtonProps> = ({
  title,
  setValue,
  restMs,
  workMs,
  totalRounds,
  disabled,
}) => {
  const handleOnPress = useCallback(() => {
    if (restMs) {
      setValue('restMs', restMs);
    }
    if (workMs) {
      setValue('workMs', workMs);
    }
    if (totalRounds) {
      setValue('totalRounds', totalRounds);
    }
  }, [setValue, restMs, workMs, totalRounds]);

  return (
    <Button
      title={title}
      size="sm"
      variant="secondary"
      disabled={disabled}
      onPress={handleOnPress}
    />
  );
};

interface EmomPresetButtonProps
  extends Partial<EmomFormValues>, Pick<ButtonProps, 'disabled'> {
  title: string;
  setValue: (field: keyof EmomFormValues, value: number) => void;
}

export const EmomPresetButton: React.FC<EmomPresetButtonProps> = ({
  title,
  setValue,
  roundDurationMs,
  totalRounds,
  disabled,
}) => {
  const handleOnPress = useCallback(() => {
    if (totalRounds) {
      setValue('totalRounds', totalRounds);
    }
    if (roundDurationMs) {
      setValue('roundDurationMs', roundDurationMs);
    }
  }, [setValue, roundDurationMs, totalRounds]);

  return (
    <Button
      title={title}
      size="sm"
      variant="secondary"
      disabled={disabled}
      onPress={handleOnPress}
    />
  );
};
