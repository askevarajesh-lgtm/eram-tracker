"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { ConfirmCloseModal } from "./ConfirmCloseModal";

export type PanelContextValue = {
  requestClose: () => void;
};

export const PanelContext = createContext<PanelContextValue>({
  requestClose: () => {},
});

/** Hook to request closing the current panel, triggering the confirmation popup if dirty */
export const usePanelClose = () => useContext(PanelContext).requestClose;

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  wide?: boolean;
  /** true when the form has unsaved changes: closing then asks first */
  dirty?: boolean;
  /** force confirmation popup on close even without dirty flag */
  confirmClose?: boolean;
  closeConfirmTitle?: string;
  closeConfirmMessage?: string;
  closeConfirmOkLabel?: string;
  closeConfirmCancelLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode | ((helpers: { requestClose: () => void }) => React.ReactNode);
  panelClassName?: string;
  customHead?: React.ReactNode | ((helpers: { requestClose: () => void }) => React.ReactNode);
};

/** Centered modal dialog with fixed height and internal scrolling used for every create/edit form and search/import overlay. */
export function Panel({
  title,
  subtitle,
  wide,
  dirty,
  confirmClose,
  closeConfirmTitle,
  closeConfirmMessage,
  closeConfirmOkLabel,
  closeConfirmCancelLabel,
  onClose,
  children,
  footer,
  panelClassName,
  customHead,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const confirmCloseRef = useRef(confirmClose);
  confirmCloseRef.current = confirmClose;

  const requestClose = useCallback(() => {
    if (dirtyRef.current || confirmCloseRef.current) {
      setConfirmingClose(true);
      return;
    }
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmingClose) {
        requestClose();
      }
    };
    // warn before leaving the page with unsaved edits
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [requestClose, confirmingClose]);

  if (!mounted) return null;

  return createPortal(
    <PanelContext.Provider value={{ requestClose }}>
      <div
        className="scrim"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div
          className={["panel", wide ? "wide" : "", panelClassName].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {customHead ? (
            typeof customHead === "function" ? customHead({ requestClose }) : customHead
          ) : (
            <div className="panel-head">
              <div className="panel-title-wrap">
                <h2>{title}</h2>
                {subtitle && (
                  <div className="mono muted" style={{ marginTop: 4 }}>
                    {subtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="pclose"
                onClick={requestClose}
                aria-label="Close"
                title="Close (Esc)"
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          <div className="panel-body">{children}</div>
          {footer && (
            <div className="foot">
              {typeof footer === "function" ? footer({ requestClose }) : footer}
            </div>
          )}
        </div>
      </div>

      <ConfirmCloseModal
        open={confirmingClose}
        title={closeConfirmTitle}
        message={closeConfirmMessage}
        confirmLabel={closeConfirmOkLabel}
        cancelLabel={closeConfirmCancelLabel}
        onConfirm={() => {
          setConfirmingClose(false);
          onClose();
        }}
        onCancel={() => {
          setConfirmingClose(false);
        }}
      />
    </PanelContext.Provider>,
    document.body
  );
}
