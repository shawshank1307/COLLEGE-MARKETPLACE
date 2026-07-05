import { api } from "./api.js";

let currentUser = null;

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!currentUser;
}

export function isVerified() {
  return currentUser?.emailVerified === true;
}

export async function loadSession() {
  try {
    const data = await api.me();
    currentUser = data.user;
  } catch {
    currentUser = null;
  }
  return currentUser;
}

export async function login(collegeEmail, rollNumber) {
  const data = await api.login(collegeEmail, rollNumber);
  api.setToken(data.token);
  currentUser = data.user;
  return data;
}

export async function logout() {
  try {
    await api.logout();
  } catch {
    /* ignore */
  }
  api.setToken(null);
  currentUser = null;
}

export function setUser(user) {
  currentUser = user;
}

export function requireAuth(onFail) {
  if (!currentUser) {
    onFail?.("login");
    return false;
  }
  if (!currentUser.emailVerified) {
    onFail?.("verify");
    return false;
  }
  return true;
}
