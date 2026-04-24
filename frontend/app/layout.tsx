"use client";
import "./globals.css";
import ClientProviders from "@/components/ui/ClientProviders";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useRef, useEffect } from "react";

const PUBLIC_PATHS = ["/login", "/forgot", "/session-expired"];

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname          = usePathname();
  const router            = useRouter();
  const hasLoaded         = useRef(false);   // ← NEW: true after first successful auth

  const isPublic = PUBLIC_PATHS.some((route) => pathname?.startsWith(route));

  // ── Mark as loaded once user is confirmed and loading is done ────────────
  if (!hasLoaded.current && !loading && user) {
    hasLoaded.current = true;
  }
  // ────────────────────────────────────────────────────────────────────────

  // ── Redirect on session expiry AFTER first load ──────────────────────────
  // Use useEffect so we redirect without unmounting children first
  useEffect(() => {
    if (hasLoaded.current && !loading && !user && !isPublic) {
      // Session expired after being logged in — redirect but don't unmount
      router.replace("/session-expired");
    }
  }, [user, loading, isPublic, router]);
  // ────────────────────────────────────────────────────────────────────────

  // ── First load only — block render until auth is resolved ────────────────
  // hasLoaded.current is false only before the very first check completes
  if (!hasLoaded.current) {
    if (loading) return null;                           // waiting for first check
    if (!user && !isPublic) return null;               // not authenticated, never loaded
  }
  // ── After first load — ALWAYS render children ────────────────────────────
  // Even if loading or user briefly null (background recheck or redirect in progress)
  // Children stay mounted — form state preserved — redirect handles navigation
  // ────────────────────────────────────────────────────────────────────────

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ClientProviders />
          <ProtectedContent>
            {children}
          </ProtectedContent>
        </AuthProvider>
      </body>
    </html>
  );
}
