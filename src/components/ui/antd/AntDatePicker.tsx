"use client";
import React, { useMemo } from "react";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";

export type AntDatePickerProps = {
  id?: string;
  name?: string;
  value?: string | null;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  onChangeStr?: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  allowClear?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  autoFocus?: boolean;
  required?: boolean;
  format?: string;
};

export function AntDatePicker({
  id,
  name,
  value,
  onChange,
  onChangeStr,
  placeholder = "Select date",
  disabled,
  min,
  max,
  allowClear = true,
  className,
  style,
  "aria-label": ariaLabel,
  autoFocus,
  format = "YYYY-MM-DD",
}: AntDatePickerProps) {
  const dayValue = useMemo(() => {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }, [value]);

  const disabledDate = useMemo(() => {
    if (!min && !max) return undefined;
    return (current: Dayjs) => {
      if (!current) return false;
      const curStr = current.format("YYYY-MM-DD");
      if (min && curStr < min) return true;
      if (max && curStr > max) return true;
      return false;
    };
  }, [min, max]);

  const handleChange = (_date: Dayjs | null, dateString: any) => {
    const strVal = typeof dateString === "string" ? dateString : (_date && _date.isValid() ? _date.format("YYYY-MM-DD") : "");
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
    <DatePicker
      id={id}
      name={name}
      value={dayValue}
      onChange={handleChange as any}
      placeholder={placeholder}
      disabled={disabled}
      disabledDate={disabledDate}
      allowClear={allowClear}
      className={className}
      style={{ width: "100%", ...style }}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      format={format}
    />
  );
}
