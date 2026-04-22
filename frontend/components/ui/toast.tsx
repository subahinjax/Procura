"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toastVariants = cva(
  "flex w-auto max-w-sm items-start justify-between space-x-2 rounded-md border border-gray-200 bg-white p-4 shadow-lg transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900",
  {
    variants: {
      variant: {
        default: "",
        destructive:
          "border-red-500 text-red-900 dark:border-red-500 dark:text-red-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: React.ReactNode;
  duration?: number | null;
  onClose?: () => void; // 👈 NEW: optional callback
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, title, description, variant, duration = 5000, onClose, ...props }, ref) => {
    const [visible, setVisible] = React.useState(true);

    const close = React.useCallback(() => {
      setVisible(false);
      onClose?.(); // 🔔 call the callback if provided
    }, [onClose]);

    React.useEffect(() => {
      if (typeof duration === "number") {
        const timer = setTimeout(close, duration);
        return () => clearTimeout(timer);
      }
    }, [duration, close]);

    if (!visible) return null;

    return (
      <div
        ref={ref}
        className={cn(
          toastVariants({ variant }),
          className,
          "animate-in fade-in slide-in-from-top-2"
        )}
        {...props}
      >
        <div className="flex flex-col">
          {title && <div className="font-semibold mb-1">{title}</div>}
          {description && (
            <div className="text-sm opacity-90">{description}</div>
          )}
        </div>

        {/* Optional close ✕ button */}
        <button
          onClick={close}
          className="ml-3 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    );
  }
);

Toast.displayName = "Toast";
