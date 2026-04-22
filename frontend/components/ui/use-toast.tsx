"use client";

import { Toast, type ToastProps } from "./toast";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

interface ToastItem extends ToastProps {
  id: string;
}

let showToast: ((props: ToastProps) => string) | null = null;
let dismissToastById: ((id: string) => void) | null = null;
let clearAllToastsFn: (() => void) | null = null; // 👈 new global reference
let pendingToasts: ToastProps[] = [];

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);

  showToast = (props: ToastProps) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, ...props }]);
    return id;
  };

  dismissToastById = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  clearAllToastsFn = () => {
    setToasts([]);
  };

  // 🔥 flush queued toasts
  if (pendingToasts.length) {
    pendingToasts.forEach((t) => showToast?.(t));
    pendingToasts = [];
  }
}, []);

  const ToastContainer = () =>
    mounted
      ? createPortal(
          <div
            className="fixed top-[44%] left-[50vw] z-50 flex flex-col gap-3 
                       -translate-x-1/2 -translate-y-1/2 
                       items-center justify-center pointer-events-auto toast-animate"
            style={{
              margin: 0,
              padding: 0,
              textAlign: "center",
            }}
          >
            {toasts.map((t) => (
              <Toast
                key={t.id}
                {...t}
                onClose={() => dismissToastById?.(t.id)}
              />
            ))}
          </div>,
          document.body
        )
      : null;

  // 👇 expose all helpers
  return { ToastContainer, clearAllToasts: clearAllToastsFn };
}

// === External API functions ===

export function toast(props: ToastProps) {
  if (showToast) return showToast(props);

  // 🧠 queue instead of warning
  pendingToasts.push(props);
  return null;
}


export function dismissToast(id: string) {
  if (dismissToastById) dismissToastById(id);
}

export function clearAllToasts() {
  if (clearAllToastsFn) clearAllToastsFn();
}
