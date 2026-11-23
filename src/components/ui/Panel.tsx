"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  wide?: boolean;
  /** true when the form has unsaved changes: closing then asks first */
  dirty?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Centered modal dialog with fixed height and internal scrolling used for every create/edit form and search/import overlay. */
export function Panel({ title, subtitle, wide, dirty, onClose, children, footer }: Props) {
  const [mounted, setMounted] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const tryClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") tryClose(); };
    // warn before leaving the page with unsaved edits
    const onUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [tryClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) tryClose(); }}>
      <div className={"panel" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-head">
          <div className="panel-title-wrap">
            <h2>{title}</h2>
            {subtitle && <div className="mono muted" style={{ marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button
            type="button"
            className="pclose"
            onClick={tryClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="panel-body">
          {children}
        </div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

