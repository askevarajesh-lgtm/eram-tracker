"use client";
import React from "react";
import { Checkbox, Slider, Switch, Radio } from "antd";
import type { CheckboxProps } from "antd/es/checkbox";
import type { SliderSingleProps } from "antd/es/slider";

export type AntCheckboxProps = Omit<CheckboxProps, "onChange"> & {
  onChange?: (e: { target: { checked: boolean; name?: string } }) => void;
  children?: React.ReactNode;
};

export function AntCheckbox({ onChange, children, ...rest }: AntCheckboxProps) {
  return (
    <Checkbox
      {...rest}
      onChange={(e) => {
        if (onChange) {
          onChange({
            target: { checked: e.target.checked, name: rest.name || rest.id || "" },
          });
        }
      }}
    >
      {children}
    </Checkbox>
  );
}

export type AntSliderProps = Omit<SliderSingleProps, "onChange"> & {
  value?: number;
  onChange?: (e: { target: { value: number; name?: string } }) => void;
  onChangeValue?: (val: number) => void;
  name?: string;
  id?: string;
};

export function AntSlider({ value, onChange, onChangeValue, name, id, ...rest }: AntSliderProps) {
  return (
    <Slider
      id={id}
      value={value}
      onChange={(val) => {
        if (onChangeValue) onChangeValue(val);
        if (onChange) {
          onChange({
            target: { value: val, name: name || id || "" },
          });
        }
      }}
      {...rest}
    />
  );
}

export { Switch as AntSwitch, Radio as AntRadio };
