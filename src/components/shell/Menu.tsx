"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Small header dropdown: a trigger button plus a floating panel.
 * Closes on outside click, Escape, or when a link / [data-close] element inside is clicked.
 */
export function Menu({
  trigger,
  label,
  className = "",
  btnClass = "",
  popClass = "",
  popStyle,
  align = "right",
  children,
}: {
  trigger: React.ReactNode;
  label: string;
  className?: string;
  btnClass?: string;
  popClass?: string;
  popStyle?: React.CSSProperties;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className={"tmenu " + className} ref={ref}>
      <button
        type="button"
        className={btnClass}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`tpop ${align} ${popClass}`.trim()}
          style={popStyle}
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a,[data-close]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
