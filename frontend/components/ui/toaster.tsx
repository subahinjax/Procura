"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Toast, type ToastProps } from "./toast";

interface ToastItem extends ToastProps {
  id: string;
}

export function Toaster() {
  const [mounted, setMounted] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    setMounted(true);

    // Optional: global toast for convenience
    (window as any).toast = (props: ToastProps) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, ...props }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), props.duration ?? 5000);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>,
    document.body
  );
}
