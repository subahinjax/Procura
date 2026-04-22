"use client";

import { useToast } from "@/components/ui/use-toast";

export default function ClientProviders() {
  const { ToastContainer } = useToast();
  return <ToastContainer />;
}