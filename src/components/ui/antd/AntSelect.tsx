"use client";
import React, { useMemo, useState } from "react";
import { Select } from "antd";

export type SelectOption = {
  value: string;
  label: React.ReactNode;
};

export type AntSelectProps = {
  id?: string;
  name?: string;
  value?: string | number | string[] | number[];
  onChange?: (e: { target: { value: any; name?: string } }) => void;
  onChangeValue?: (val: any) => void;
  options?: ([value: string, label: React.ReactNode] | SelectOption | string)[];
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  mode?: "multiple" | "tags";
  filterOption?: boolean | ((input: string, option?: any) => boolean);
  dropdownMatchSelectWidth?: boolean;
  empty?: string;
  allowCreate?: boolean;
};

export function AntSelect({
  id,
  name,
  value,
  onChange,
  onChangeValue,
  options,
  children,
  placeholder,
  disabled,
  allowClear,
  showSearch = true,
  className,
  style,
  "aria-label": ariaLabel,
  mode,
  filterOption,
  empty,
  allowCreate,
}: AntSelectProps) {
  const [searchValue, setSearchValue] = useState("");

  const parsedOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [];
    if (empty !== undefined) {
      list.push({ value: "", label: empty });
    }

    if (options && options.length > 0) {
      options.forEach(opt => {
        if (typeof opt === "string") {
          list.push({ value: opt, label: opt });
        } else if (Array.isArray(opt)) {
          list.push({ value: String(opt[0]), label: opt[1] });
        } else if (opt && typeof opt === "object") {
          list.push({ value: String(opt.value), label: opt.label });
        }
      });
    }

    if (children) {
      React.Children.forEach(children, child => {
        if (React.isValidElement(child)) {
          const childProps = child.props as any;
          const val = childProps.value ?? "";
          const lbl = childProps.children ?? val;
          list.push({ value: String(val), label: lbl });
        }
      });
    }

    // Ensure the current value is always present in the options list
    if (value && typeof value === "string" && value.trim()) {
      const valStr = value.trim();
      if (!list.some(opt => opt.value === valStr)) {
        list.push({ value: valStr, label: valStr });
      }
    }

    return list;
  }, [options, children, empty, value]);

  const finalOptions = useMemo(() => {
    if (!allowCreate || !searchValue.trim()) return parsedOptions;
    const trimmed = searchValue.trim();
    const exists = parsedOptions.some(
      opt => opt.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      return [{ value: trimmed, label: `+ Use "${trimmed}"` }, ...parsedOptions];
    }
    return parsedOptions;
  }, [parsedOptions, allowCreate, searchValue]);

  const handleChange = (selectedVal: any) => {
    const val = selectedVal === undefined || selectedVal === null ? "" : selectedVal;
    setSearchValue("");
    if (onChangeValue) {
      onChangeValue(val);
    }
    if (onChange) {
      onChange({
        target: { value: val, name: name || id || "" },
      });
    }
  };

  const defaultFilter = (input: string, option?: any) => {
    if (!option || !option.label) return false;
    if (allowCreate && option.value === input.trim()) return true;
    const labelText = typeof option.label === "string" ? option.label : String(option.value || "");
    return labelText.toLowerCase().includes(input.toLowerCase());
  };

  const strValue = useMemo(() => {
    if (mode === "multiple" || mode === "tags") {
      if (!Array.isArray(value)) return [];
      return value.map(v => String(v));
    }
    if (value === undefined || value === null) return undefined;
    return String(value);
  }, [value, mode]);

  return (
    <Select
      id={id}
      value={strValue}
      onChange={handleChange}
      onSearch={allowCreate ? setSearchValue : undefined}
      options={finalOptions}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      showSearch={showSearch}
      filterOption={filterOption ?? defaultFilter}
      className={className}
      style={{ width: "100%", minWidth: 120, ...style }}
      aria-label={ariaLabel}
      mode={mode}
    />
  );
}
