"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SessionExpired() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  // Auto-redirect to login after countdown
  useEffect(() => {
    if (countdown <= 0) {
      router.replace("/login");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Red top bar */}
        <div className="h-2 bg-gradient-to-r from-red-500 to-red-600" />

        <div className="p-8 text-center">

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center border-4 border-red-100">
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Session Expired
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            Your session has ended. Please log in again to continue using the
            Purchase Order system.
          </p>

          {/* Reasons */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Possible reasons
            </p>
            <ul className="space-y-2">
              {[
                { icon: "⏱", text: "Your session timed out due to inactivity" },
                { icon: "🔀", text: "You navigated away and returned to the app" },
                { icon: "🔐", text: "Logged in from another browser or device" },
                { icon: "🛡", text: "Security policy triggered a timeout" },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-0.5">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Auto-redirect notice */}
          <p className="text-xs text-slate-400 mb-4">
            Redirecting to login in{" "}
            <span className="font-semibold text-red-500">{countdown}s</span>
          </p>

          {/* Login button */}
          <button
            onClick={() => router.replace("/login")}
            className="w-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white font-semibold py-3 px-6 rounded-xl shadow-sm"
          >
            Log In Again
          </button>

        </div>
      </div>
    </div>
  );
}
