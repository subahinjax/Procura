'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthGuard from "@/hooks/useAuthGuard"; // ✅ FIX 1: add guard

type UserProfile = {
  username: string;
  user_type: string;
  email: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ✅ FIX 1: handles home/back navigation session check
  useAuthGuard();

  // ✅ FIX 2: removed manual session check useEffect — AuthContext + useAuthGuard handles this
  // The old code had 3x router.replace("/login") — all removed


// ---------------- Fetch profile ----------------
useEffect(() => {
  const fetchProfile = async () => {
    try {
   const res = await fetch("/api/users", {
  credentials: "include",
  cache: "no-store",
});

      if (!res.ok) {
        router.replace("/login");
        return;
      }

      const data = await res.json();

      setUser({
        username: data.username,
        user_type: data.user_type,
        email: data.email,
      });

    } catch (err) {
      console.error("Profile fetch error:", err);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  fetchProfile();
}, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500 text-lg">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-500 text-lg">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-start pt-16">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-lg border border-gray-200 p-8">
        <div className="mb-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl font-semibold shadow">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-semibold mt-4 text-gray-800">User Profile</h2>
        </div>
        <div className="space-y-6">
          <ProfileItem label="Username" value={user.username} />
          <ProfileItem label="User Type" value={user.user_type} />
          <ProfileItem label="Email" value={user.email} />
        </div>
      </div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-base font-medium text-gray-800 mt-1">{value}</span>
    </div>
  );
}
