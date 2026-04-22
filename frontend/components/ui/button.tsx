"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  outline: "border border-gray-300 text-gray-900 hover:bg-gray-100 focus:ring-gray-400",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-2 py-1 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          buttonVariants[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
