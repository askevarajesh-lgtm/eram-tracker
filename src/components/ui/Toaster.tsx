"use client";
import { useEffect, useState } from "react";

const EVENT = "dev360:toast";

/** Show a short message at the bottom of the screen. Call from any client component. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg({ text: (e as CustomEvent<string>).detail, key: Date.now() });
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 3200);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(t); };
  }, []);
  return msg ? <div className="toast" role="status" key={msg.key}>{msg.text}</div> : null;
}
