import { cookies } from "next/headers";

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

    const res = await fetch("http://10.1.24.102:5001/api/auth/me", {
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