import { SAMPLE_LISTINGS } from "./data.js";

const LISTINGS_KEY = "campusswap_listings";
const PROFILE_KEY = "campusswap_profile";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getListings() {
  const stored = read(LISTINGS_KEY, null);
  if (!stored) {
    write(LISTINGS_KEY, SAMPLE_LISTINGS);
    return [...SAMPLE_LISTINGS];
  }
  return stored;
}

export function getListing(id) {
  return getListings().find((l) => l.id === id) ?? null;
}

export function saveListing(listing) {
  const listings = getListings();
  listings.unshift(listing);
  write(LISTINGS_KEY, listings);
  return listing;
}

export function deleteListing(id) {
  const listings = getListings().filter((l) => l.id !== id);
  write(LISTINGS_KEY, listings);
}

export function getProfile() {
  return read(PROFILE_KEY, {
    name: "",
    email: "",
    campus: "JKLU Campus",
  });
}

export function saveProfile(profile) {
  write(PROFILE_KEY, profile);
  return profile;
}

export function getMyListings(profile) {
  if (!profile.email) return [];
  return getListings().filter(
    (l) => l.sellerEmail.toLowerCase() === profile.email.toLowerCase()
  );
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
