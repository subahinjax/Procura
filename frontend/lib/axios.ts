import axios from "axios";

const instance = axios.create({
  withCredentials: true,
});

// 🔐 GLOBAL 401 HANDLER
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("🚨 Global 401 → Redirecting to session-expired");

      // ✅ FIX 1: redirect to session-expired, not login
      // ✅ FIX 2: only redirect if not already on a public page
      const currentPath = window.location.pathname;
      const PUBLIC_PATHS = ["/login", "/forgot", "/session-expired"];
      const isPublic = PUBLIC_PATHS.some((p) => currentPath.startsWith(p));

      if (!isPublic) {
        // ✅ FIX 3: set sessionStorage so AuthContext knows session was active
        sessionStorage.setItem("app_was_logged_in", "true");
        window.location.href = "/session-expired";
      }
    }
    return Promise.reject(error);
  }
);

console.log("AXIOS INTERCEPTOR ACTIVE");
export default instance;
