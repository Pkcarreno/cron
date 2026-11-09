import { TimerMode } from "@/helpers/timer/factory";

export const convertTimeToMs = (minutes: number, seconds = 0): number =>
  minutes * 60 * 1000 + seconds * 1000;

const pad = (num: number) => num.toString().padStart(2, "0");

export interface FormatTimeOptions {
  includeHours?: boolean;
  isCountDown?: boolean;
}

export const formatTimeForDisplay = (
  totalMs: number,
  optionsOrIncludeHours: boolean | FormatTimeOptions = false
): {
  hours?: string;
  minutes: string;
  seconds: string;
} => {
  const options: FormatTimeOptions =
    typeof optionsOrIncludeHours === "boolean"
      ? { includeHours: optionsOrIncludeHours, isCountDown: true }
      : { isCountDown: true, ...optionsOrIncludeHours };

  const isCountDown = options.isCountDown ?? true;
  const includeHours = options.includeHours ?? false;

  const totalSeconds = isCountDown
    ? Math.ceil(totalMs / 1000)
    : Math.floor(totalMs / 1000);

  if (includeHours) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours: hours === 0 ? undefined : pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
    };
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
};

export const formatFullTimeToString = (totalMs: number) => {
  const totalSeconds = Math.trunc(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export interface FormatDurationOptions {
  fixedDecimals?: boolean;
  showSign?: boolean;
}

// oxlint-disable eslint/max-statements
export const formatDuration = (
  ms: number,
  optionsOrShowSign: boolean | FormatDurationOptions = false
): string => {
  const options: FormatDurationOptions =
    typeof optionsOrShowSign === "boolean"
      ? { showSign: optionsOrShowSign }
      : optionsOrShowSign;

  const showSign = options.showSign ?? false;
  const fixedDecimals = options.fixedDecimals ?? false;

  const isNegative = ms < 0;
  const absMs = Math.abs(ms);

  let sign = "";
  if (showSign) {
    sign = isNegative ? "-" : "+";
  } else if (isNegative) {
    sign = "-";
  }

  if (!fixedDecimals && absMs < 1000) {
    return `${sign}${Math.round(absMs)}ms`;
  }

  const totalSeconds = absMs / 1000;

  if (totalSeconds < 60) {
    if (fixedDecimals) {
      return `${sign}${totalSeconds.toFixed(2)}s`;
    }
    return `${sign}${Number(totalSeconds.toFixed(3))}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  const formattedSeconds =
    (remainingSeconds < 10 ? "0" : "") + remainingSeconds.toFixed(2);

  if (totalMinutes < 60) {
    return `${sign}${totalMinutes}:${formattedSeconds}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, "0");

  return `${sign}${hours}:${remainingMinutes}:${formattedSeconds}`;
};

/**
 * Formats a delta duration with explicit sign, strict 2-decimal precision (centiseconds),
 * and standard tabular alignment across all scales (including sub-second values in seconds).
 *
 * Examples:
 * - 0 ms        -> "+0.00s"
 * - 412.4 ms    -> "+0.41s"
 * - -200 ms     -> "-0.20s"
 * - 4300 ms     -> "+4.30s"
 * - 65500 ms    -> "+1:05.50"
 */
export const formatDelta = (deltaMs: number): string => {
  // In centiseconds (0.01s = 10ms), values strictly within (-5ms, 5ms) round to zero.
  // We represent zero delta with canonical positive neutral sign (+0.00s).
  if (Math.abs(deltaMs) < 5) {
    return "+0.00s";
  }

  return formatDuration(deltaMs, {
    fixedDecimals: true,
    showSign: true,
  });
};

export const getModeAbbreviation = (mode: TimerMode): string => {
  switch (mode) {
    case TimerMode.AMRAP: {
      return "AMR";
    }
    case TimerMode.FOR_TIME: {
      return "FOR";
    }
    case TimerMode.EMOM: {
      return "EMO";
    }
    case TimerMode.INTERVAL: {
      return "INT";
    }
    case TimerMode.STOP_WATCH: {
      return "STP";
    }
    default: {
      return "---";
    }
  }
};
