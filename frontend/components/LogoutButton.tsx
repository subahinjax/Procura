"use client";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LogoutButton() {
  const router = useRouter();
  const { setUser } = useAuth();

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();

      // ✅ FIX: window.location.replace clears history stack
      // router.replace() does NOT clear bfcache — Back button still works
      // window.location.replace() forces full page reload AND removes
      // current entry from history so Back can't return to authenticated pages
      window.location.replace("/login");

    } catch (error) {
      console.error("Logout failed:", error);
      window.location.replace("/login"); // ✅ redirect even on error
    }
  };

  return (
    <button
      onClick={handleLogout}
      title="Logout"
      aria-label="Logout"
      className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white hover:opacity-90 transition flex items-center justify-center"
    >
      <Power className="w-5 h-5" />
    </button>
  );
}
