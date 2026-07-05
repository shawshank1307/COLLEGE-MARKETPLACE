const API_BASE =
  window.location.port === "5001" || window.location.port === "5000"
    ? ""
    : "http://localhost:5001";

function getToken() {
  return localStorage.getItem("campusswap_token");
}

function setToken(token) {
  if (token) localStorage.setItem("campusswap_token", token);
  else localStorage.removeItem("campusswap_token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, body });
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
