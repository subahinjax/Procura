"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useToast, clearAllToasts } from "./use-toast";

export function ToasterClient() {
  const { ToastContainer } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    clearAllToasts();
  }, [pathname]);

  return <ToastContainer />;
}
