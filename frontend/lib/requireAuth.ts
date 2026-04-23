import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export async function requireAuth() {
  try {
    const cookieStore = await cookies();

    // 🔥 convert cookies to header
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    console.log("Forwarding cookies:", cookieHeader); // 👈 debug

    if (!cookieHeader) return null;

    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        cookie: cookieHeader, // 🔥 CRITICAL FIX
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();

    if (!data.loggedIn) return null;

    return {
      user: {
	id: data.id,
        username: data.username,
        user_type: data.user_type,
      },
    };

  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}