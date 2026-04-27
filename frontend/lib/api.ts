export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const proxyFetch = (path: string, options: RequestInit = {}) =>
  fetch(`/api/proxy${path}`, options);