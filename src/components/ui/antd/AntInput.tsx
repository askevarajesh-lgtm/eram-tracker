"use client";
import React from "react";
import { Input, InputNumber } from "antd";
import type { InputProps, TextAreaProps } from "antd/es/input";
import type { InputNumberProps } from "antd/es/input-number";
import { AntDatePicker } from "./AntDatePicker";
import { AntTimePicker } from "./AntTimePicker";

export type AntInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> &
  Omit<InputProps, "size" | "prefix"> & {
    size?: "small" | "middle" | "large" | number;
    prefix?: React.ReactNode;
    htmlSize?: number;
  };

export const AntInput = React.forwardRef<any, AntInputProps>((props, ref) => {
  const { size, htmlSize: explicitHtmlSize, type, ...rest } = props;
  if (type === "date") {
    return <AntDatePicker ref={ref} size={typeof size === "string" ? size : undefined} {...(rest as any)} />;
  }
  if (type === "time") {
    return <AntTimePicker ref={ref} size={typeof size === "string" ? size : undefined} {...(rest as any)} />;
  }
  const antdSize = typeof size === "string" ? size : undefined;
  const htmlSize = typeof size === "number" ? size : explicitHtmlSize;
  return <Input ref={ref} size={antdSize} htmlSize={htmlSize} type={type} style={{ width: "100%", ...rest.style }} {...(rest as any)} />;
});
AntInput.displayName = "AntInput";

export const AntTextArea = React.forwardRef<any, TextAreaProps>((props, ref) => {
  return <Input.TextArea ref={ref} style={{ width: "100%", ...props.style }} {...props} />;
});
AntTextArea.displayName = "AntTextArea";

export const AntPassword = React.forwardRef<any, AntInputProps>((props, ref) => {
  const { size, htmlSize: explicitHtmlSize, ...rest } = props;
  const antdSize = typeof size === "string" ? size : undefined;
  const htmlSize = typeof size === "number" ? size : explicitHtmlSize;
  return <Input.Password ref={ref} size={antdSize} htmlSize={htmlSize} style={{ width: "100%", ...rest.style }} {...(rest as any)} />;
});
AntPassword.displayName = "AntPassword";

export const AntSearch = React.forwardRef<any, InputProps>((props, ref) => {
  return <Input.Search ref={ref} style={{ width: "100%", ...props.style }} {...props} />;
});
AntSearch.displayName = "AntSearch";

export type AntInputNumberProps = Omit<InputNumberProps, "onChange"> & {
  onChange?: (e: { target: { value: any; name?: string } }) => void;
  onChangeValue?: (val: number | null) => void;
};

export function AntInputNumber({ onChange, onChangeValue, name, id, ...rest }: AntInputNumberProps) {
  return (
    <InputNumber
      id={id}
      name={name}
      style={{ width: "100%", ...rest.style }}
      {...rest}
      onChange={(val) => {
        const numVal = val === null || val === undefined || val === "" ? null : Number(val);
        if (onChangeValue) onChangeValue(numVal);
        if (onChange) {
          onChange({
            target: { value: numVal, name: name || id || "" },
          });
        }
      }}
    />
  );
}
