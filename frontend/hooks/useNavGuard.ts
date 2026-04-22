"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const NAV_KEY = "app_internal_nav";

/**
 * useNavGuard
 * 
 * Blocks direct URL access (paste/new tab) to protected pages.
 * Only allows access if user navigated from within the app.
 * 
 * Usage: call useNavGuard("/po_accounts") in pages that need this protection.
 * The fallback is where to redirect if direct access is detected.
 */
export default function useNavGuard(fallback: string = "/") {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const cameFromApp = sessionStorage.getItem(NAV_KEY) === "true";
    const referrer = document.referrer;
    const appOrigin = window.location.origin;

    // ✅ Allow if:
    // 1. sessionStorage flag is set (user navigated within app), OR
    // 2. referrer is from same origin (clicked link within app)
    const isInternalNav =
      cameFromApp || (referrer && referrer.startsWith(appOrigin));

    if (!isInternalNav) {
      console.log("🚫 Direct URL access blocked:", pathname);
      router.replace(fallback);
    }
  }, [router, pathname, fallback]);
}

/**
 * Call this when navigating TO a guarded page.
 * Sets the sessionStorage flag so useNavGuard allows it.
 */
export function markInternalNav() {
  sessionStorage.setItem(NAV_KEY, "true");
}
