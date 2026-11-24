"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

const CONFIRM_EVENT = "dev360:confirm";

export type ConfirmCloseModalProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export type ConfirmActionOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmEventDetail = ConfirmActionOptions & {
  resolve: (value: boolean) => void;
};

/**
 * Promise-based custom confirmation dialog replacing native window.confirm() or alert().
 * Uses the exact same design, backdrop blur, header, and animation as the form close confirmation.
 */
export function confirmAction(options: string | ConfirmActionOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const opts: ConfirmActionOptions =
      typeof options === "string"
        ? {
            title: options.includes("?") ? options.split("?")[0] + "?" : "Confirmation",
            message: options,
            confirmLabel: "Confirm",
            cancelLabel: "Cancel",
            danger: options.toLowerCase().includes("delete") || options.toLowerCase().includes("remove"),
          }
        : options;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<ConfirmEventDetail>(CONFIRM_EVENT, {
          detail: { ...opts, resolve },
        })
      );
    } else {
      resolve(false);
    }
  });
}

/**
 * Common reusable confirmation popup displayed when a user attempts to close
 * a form with unsaved changes or perform an action requiring user confirmation.
 */
export function ConfirmCloseModal({
  open,
  title = "Do you really want to cancel or close this form?",
  message = "You have unsaved changes. If you close now without saving, your progress will be lost.",
  confirmLabel = "Yes, close form",
  cancelLabel = "Keep editing",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmCloseModalProps) {
  const [mounted, setMounted] = useState(false);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Focus the safe cancel button by default
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="confirm-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        className="confirm-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-msg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-head">
          <div className="confirm-icon-badge" aria-hidden="true">
            <Icon name="alert" />
          </div>
          <div className="confirm-head-text">
            <h3 id="confirm-dialog-title">{title}</h3>
            {message && <p id="confirm-dialog-msg">{message}</p>}
          </div>
          <button
            type="button"
            className="pclose"
            onClick={onCancel}
            aria-label="Dismiss confirmation"
            title="Cancel (Esc)"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="confirm-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"btn " + (danger ? "danger" : "primary")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Global host that renders programmatically invoked confirmAction() popups */
export function ConfirmModalHost() {
  const [active, setActive] = useState<ConfirmEventDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmEventDetail>).detail;
      setActive(detail);
    };

    window.addEventListener(CONFIRM_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_EVENT, handler);
  }, []);

  if (!active) return null;

  return (
    <ConfirmCloseModal
      open={true}
      title={active.title ?? "Confirmation"}
      message={active.message}
      confirmLabel={active.confirmLabel ?? "Confirm"}
      cancelLabel={active.cancelLabel ?? "Cancel"}
      danger={active.danger !== false}
      onConfirm={() => {
        const res = active.resolve;
        setActive(null);
        res(true);
      }}
      onCancel={() => {
        const res = active.resolve;
        setActive(null);
        res(false);
      }}
    />
  );
}
