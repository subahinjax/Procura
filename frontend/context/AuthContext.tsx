"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

interface User {
  username: string;
  user_type: string;
  dept_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_PATHS = ["/login", "/forgot", "/session-expired"];
const SESSION_KEY  = "app_was_logged_in";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);   // true ONLY for first check

  const router      = useRouter();
  const pathname    = usePathname();

  const pathnameRef      = useRef(pathname);
  const isCheckingRef    = useRef(false);
  const hasCheckedOnce   = useRef(false);   // ← NEW: tracks first check done

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refreshUser = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    // ── Only set loading=true on the VERY FIRST check ──────────────────────
    // Background rechecks (visibilitychange, pageshow) must NOT set
    // loading=true — that would unmount children and reset forms
    if (!hasCheckedOnce.current) {
      setLoading(true);
    }
    // ────────────────────────────────────────────────────────────────────────

try {
  const res = await fetch(`/api/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });

  let data: any = null;

  try {
    data = await res.json(); // ✅ always try to parse
  } catch {
    console.warn("Auth response not JSON");
  }

  // ✅ Only logout if explicitly NOT logged in
  if (!res.ok || !data?.loggedIn) {
    console.warn("Auth failed:", res.status, data);

    const wasLoggedIn = sessionStorage.getItem(SESSION_KEY) === "true";
    const currentPath = pathnameRef.current;
    const isPublic = PUBLIC_PATHS.some((p) =>
      currentPath?.startsWith(p)
    );

    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);

    // ✅ avoid unnecessary redirect loops
    if (!isPublic) {
      if (wasLoggedIn) {
        router.replace("/session-expired");
      } else {
        router.replace("/login");
      }
    }

    return;
  }

  // ✅ SUCCESS → session valid
  sessionStorage.setItem(SESSION_KEY, "true");

  setUser({
    username: data.username,
    user_type: data.user_type,
    dept_id: data.dept_id,
  });

} catch (err) {
  console.error("❌ Auth refresh failed:", err);

  const wasLoggedIn = sessionStorage.getItem(SESSION_KEY) === "true";
  const currentPath = pathnameRef.current;
  const isPublic = PUBLIC_PATHS.some((p) =>
    currentPath?.startsWith(p)
  );

  setUser(null);
  sessionStorage.removeItem(SESSION_KEY);

  if (!isPublic) {
    if (wasLoggedIn) {
      router.replace("/session-expired");
    } else {
      router.replace("/login");
    }
  }

} finally {
  // ✅ Always stop loading
  setLoading(false);
  hasCheckedOnce.current = true;
  isCheckingRef.current = false;
}
  }, [router]);

  // Initial load
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Tab switch / Alt+Tab back from any app — recheck session silently
  // loading stays false because hasCheckedOnce is already true
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        isCheckingRef.current = false; // reset lock before check
        refreshUser();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshUser]);

  // Browser Back/Forward bfcache restore ONLY
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        isCheckingRef.current = false;
        refreshUser();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
