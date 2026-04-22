"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "app_was_logged_in";

export default function RedirectToLogin() {
  const router = useRouter();

  useEffect(() => {
    // ✅ If user had an active session → session-expired page
    // ✅ If user was never logged in → login page
    const wasLoggedIn = sessionStorage.getItem(SESSION_KEY) === "true";
    if (wasLoggedIn) {
      sessionStorage.removeItem(SESSION_KEY);
      router.replace("/session-expired");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
