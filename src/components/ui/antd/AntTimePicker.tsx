"use client";
import React, { useMemo } from "react";
import { TimePicker } from "antd";
import type { TimePickerProps } from "antd";
import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export type AntTimePickerProps = {
  id?: string;
  name?: string;
  value?: string | null;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  onChangeStr?: (timeStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  autoFocus?: boolean;
  required?: boolean;
  format?: string;
  use12Hours?: boolean;
  minuteStep?: TimePickerProps["minuteStep"];
  hourStep?: TimePickerProps["hourStep"];
  outputFormat?: string;
  popupClassName?: string;
  size?: "small" | "middle" | "large";
  needConfirm?: boolean;
};

function parseTimeString(val: string): Dayjs | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const formats = [
    "hh:mm A",
    "h:mm A",
    "hh:mm:ss A",
    "h:mm:ss A",
    "HH:mm",
    "H:m",
    "HH:mm:ss",
  ];
  for (const fmt of formats) {
    const d = dayjs(upper, fmt, true);
    if (d.isValid()) return d;
  }
  const fallback = dayjs(trimmed);
  return fallback.isValid() ? fallback : null;
}

export const AntTimePicker = React.forwardRef<any, AntTimePickerProps>(
  function AntTimePicker(
    {
      id,
      name,
      value,
      onChange,
      onChangeStr,
      placeholder = "Select time",
      disabled,
      allowClear = true,
      className,
      style,
      "aria-label": ariaLabel,
      autoFocus,
      format,
      use12Hours = true,
      minuteStep,
      hourStep,
      outputFormat = "HH:mm",
      popupClassName,
      size,
      needConfirm = false,
    },
    ref
  ) {
    const displayFormat = format ?? (use12Hours ? "hh:mm A" : "HH:mm");

    const dayValue = useMemo(() => {
      if (!value) return null;
      return parseTimeString(value);
    }, [value]);

    const handleChange = (_time: Dayjs | null) => {
      const strVal = _time && _time.isValid() ? _time.format(outputFormat) : "";
      if (onChangeStr) {
        onChangeStr(strVal);
      }
      if (onChange) {
        onChange({
          target: { value: strVal, name: name || id || "" },
        });
      }
    };

    return (
      <TimePicker
        ref={ref}
        id={id}
        name={name}
        value={dayValue}
        onChange={handleChange as any}
        placeholder={placeholder}
        disabled={disabled}
        allowClear={allowClear}
        className={className}
        style={{ width: "100%", ...style }}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        format={displayFormat}
        use12Hours={use12Hours}
        minuteStep={minuteStep}
        hourStep={hourStep}
        popupClassName={popupClassName}
        size={size}
        needConfirm={needConfirm}
      />
    );
  }
);
AntTimePicker.displayName = "AntTimePicker";
