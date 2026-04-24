"use client";

import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const { setUser } = useAuth();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // ✅ FIX: moved inside component — prevents Back button returning to authenticated pages
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!hydrated) return null;


const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (loading) return;

  setLoading(true);
  console.log("🚀 Submitting login...");
  console.log("🔗 API_BASE_URL:", API_BASE_URL);


  try {
    const response = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    console.log("📡 Response status:", response.status);
    console.log("📡 Response URL:", response.url);


    let data: any = {};

    try {
      data = await response.json();
      console.log("📦 Response data:", data);
    } catch {
      console.error("❌ Response was not JSON:", response.status, response.url);
      alert("Server error. Please try again later.");
      return;
    }

    if (!response.ok || !data.success) {
      alert(data.message || "Invalid username or password");
      return;
    }
   
    console.log("✅ Login success:", data);
    setUser({
      username: data.username,
      user_type: data.user_type,
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    sessionStorage.setItem("app_was_logged_in", "true"); // ✅ match SESSION_KEY in AuthContext

    router.replace("/");
  } catch (error) {
    console.error("❌ Login error:", error);
    alert("Server error. Please try again later.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Left Side - Image */}
      <div className="w-2/3 min-h-screen flex justify-center">
        <div className="relative w-[95%] h-[96%] mt-3 rounded-3xl overflow-hidden shadow-xl">
          <Image
            src="/images/Library.JPG"
            alt="Login Image"
            fill
            priority
            className="object-contain md:object-cover"
          />
        </div>
      </div>

      {/* Right Side - Login */}
      <div className="w-1/3 bg-white mt-3 mb-4 mr-4 flex flex-col items-center justify-center px-6 rounded-3xl shadow-lg">
        <div className="text-center -mt-10 mb-6">
          <Image
            src="/images/HITS_Logo.JPG"
            alt="Hindustan Logo"
            width={230}
            height={80}
            priority
            className="mx-auto mb-1"
          />
          <div className="text-xs text-gray-500 leading-snug mt-1 mb-2">
            <p>1, Rajiv Gandhi Salai (OMR), Padur,</p>
            <p>Kelambakkam, Chennai - 603 103</p>
          </div>
	      <h2 className="text-xl font-semibold mt-16 bg-gradient-to-r from-blue-800 via-purple-800 to-pink-800 bg-clip-text text-transparent">
	          Login to Procura HITS Pilot
	      </h2>
          </div>

        <form className="w-full" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mt-4">
              Username
            </label>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mt-4">
              Password
            </label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={!hydrated || loading}
            className={`w-full py-3 rounded-md mt-10 text-white
              ${!hydrated || loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {!hydrated ? "Loading..." : loading ? "Logging in..." : "Login"}
          </button>
          <button
            type="button"
            onClick={() => window.location.href = "/forgot"}
            className="text-blue-500 underline mt-4 w-full text-center"
          >
            Forgot Password?
          </button>
        </form>
      </div>
    </div>
  );
}
