import * as localApi from "./local-api.js";

const API_BASE = (() => {
  const { hostname, port } = window.location;
  if (port === "5001" || port === "5000") return "";
  if (hostname.endsWith(".github.io") || hostname.endsWith(".github.dev")) return null;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return "";
  return "http://localhost:5001";
})();

const FORCE_LOCAL = API_BASE === null;
let backendAvailable = FORCE_LOCAL ? false : null;

function getToken() {
  return localStorage.getItem("campusswap_token");
}

function setToken(token) {
  if (token) localStorage.setItem("campusswap_token", token);
  else localStorage.removeItem("campusswap_token");
}

function friendlyError(err) {
  const msg = err?.message || "";
  if (msg === "Failed to fetch" || err?.name === "TypeError") {
    return "Cannot reach the server. Check your connection or try again later.";
  }
  return msg || "Something went wrong.";
}

async function checkBackend() {
  if (FORCE_LOCAL) return false;
  if (backendAvailable !== null) return backendAvailable;
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    backendAvailable = res.ok;
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
}

async function request(path, options = {}) {
  const useLocal = FORCE_LOCAL || !(await checkBackend());

  if (useLocal) {
    try {
      return await localApi.handle(path, options);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }

  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
  } catch (err) {
    backendAvailable = false;
    try {
      return await localApi.handle(path, options);
    } catch (localErr) {
      throw new Error(friendlyError(err) || friendlyError(localErr));
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export const api = {
  getToken,
  setToken,

  health: () => request("/api/health"),

  signup: (formData) =>
    request("/api/auth/signup", { method: "POST", body: formData }),

  sendOtp: (collegeEmail) =>
    request("/api/auth/send-otp", { method: "POST", body: { collegeEmail } }),

  verifyEmail: (collegeEmail, code) =>
    request("/api/auth/verify-email", {
      method: "POST",
      body: { collegeEmail, code },
    }),

  login: (collegeEmail, rollNumber) =>
    request("/api/auth/login", {
      method: "POST",
      body: { collegeEmail, rollNumber },
    }),

  me: () => request("/api/auth/me"),

  logout: () => request("/api/auth/logout", { method: "POST" }),

  getListings: () => request("/api/listings"),

  getMyListings: () => request("/api/my-listings"),

  getListing: (id) => request(`/api/listings/${id}`),

  createListing: (listing) =>
    request("/api/listings", { method: "POST", body: listing }),

  markListingSold: (id) =>
    request(`/api/listings/${id}/mark-sold`, { method: "POST" }),

  deleteListing: (id) =>
    request(`/api/listings/${id}`, { method: "DELETE" }),

  getConversations: () => request("/api/conversations"),

  startConversation: (listingId) =>
    request("/api/conversations", {
      method: "POST",
      body: { listingId },
    }),

  getMessages: (conversationId) =>
    request(`/api/conversations/${conversationId}/messages`),

  sendMessage: (conversationId, body) =>
    request(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body },
    }),

  createPayment: (listingId) =>
    request("/api/payments", { method: "POST", body: { listingId } }),
};

export { API_BASE };
