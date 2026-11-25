"use client";
import React, { useMemo } from "react";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

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
  showTime?: boolean | object;
  size?: "small" | "middle" | "large";
};

export const AntDatePicker = React.forwardRef<any, AntDatePickerProps>(
  function AntDatePicker(
    {
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
      showTime,
      size,
    },
    ref
  ) {
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
        ref={ref}
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
        showTime={showTime}
        size={size}
      />
    );
  }
);
AntDatePicker.displayName = "AntDatePicker";

export type AntRangePickerProps = {
  id?: string;
  name?: string;
  value?: [string | null, string | null] | null;
  onChange?: (dates: [string, string] | null) => void;
  onChangeStr?: (dates: [string, string] | null) => void;
  placeholder?: [string, string];
  disabled?: boolean | [boolean, boolean];
  allowClear?: boolean;
  className?: string;
  style?: React.CSSProperties;
  format?: string;
  showTime?: boolean | object;
  size?: "small" | "middle" | "large";
};

export const AntRangePicker = React.forwardRef<any, AntRangePickerProps>(
  function AntRangePicker(
    {
      id,
      name,
      value,
      onChange,
      onChangeStr,
      placeholder,
      disabled,
      allowClear = true,
      className,
      style,
      format = "YYYY-MM-DD",
      showTime,
      size,
    },
    ref
  ) {
    const rangeValue = useMemo((): [Dayjs | null, Dayjs | null] | null => {
      if (!value) return null;
      const start = value[0] ? dayjs(value[0]) : null;
      const end = value[1] ? dayjs(value[1]) : null;
      return [start && start.isValid() ? start : null, end && end.isValid() ? end : null];
    }, [value]);

    const handleChange = (dates: any, dateStrings: [string, string]) => {
      const res: [string, string] | null = dates && dates[0] && dates[1] ? dateStrings : null;
      if (onChangeStr) onChangeStr(res);
      if (onChange) onChange(res);
    };

    return (
      <RangePicker
        ref={ref}
        id={id}
        name={name}
        value={rangeValue as any}
        onChange={handleChange as any}
        placeholder={placeholder}
        disabled={disabled}
        allowClear={allowClear}
        className={className}
        style={{ width: "100%", ...style }}
        format={format}
        showTime={showTime}
        size={size}
      />
    );
  }
);
AntRangePicker.displayName = "AntRangePicker";
