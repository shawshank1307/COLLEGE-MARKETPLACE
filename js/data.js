import { JKLU, CAMPUSES } from "./config.js";

export const CATEGORIES = [
  { id: "all", label: "All", emoji: "🏷️" },
  { id: "textbooks", label: "Textbooks", emoji: "📚" },
  { id: "electronics", label: "Electronics", emoji: "💻" },
  { id: "furniture", label: "Furniture", emoji: "🛋️" },
  { id: "clothing", label: "Clothing", emoji: "👕" },
  { id: "services", label: "Services", emoji: "🛠️" },
  { id: "other", label: "Other", emoji: "📦" },
];

export { CAMPUSES };

export const CONDITIONS = ["Like New", "Good", "Fair", "Used"];

export const SAMPLE_LISTINGS = [
  {
    id: "1",
    title: "Engineering Mathematics — Grewal",
    description:
      "Used for B.Tech Sem 1. Minimal highlighting. Pick up near IET block at JKLU campus.",
    price: 350,
    category: "textbooks",
    condition: "Good",
    campus: JKLU.campus,
    sellerName: "Priya S.",
    sellerEmail: "priya@jklu.edu.in",
    emoji: "📚",
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: "2",
    title: "MacBook Air M1 — Perfect for CSE Students",
    description:
      "Battery health 92%. Comes with charger. Can demo at JKLU library before purchase.",
    price: 45000,
    category: "electronics",
    condition: "Like New",
    campus: JKLU.campus,
    sellerName: "Arjun M.",
    sellerEmail: "arjun@jklu.edu.in",
    emoji: "💻",
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: "3",
    title: "Study Desk + Chair — Hostel Ready",
    description:
      "Compact desk with chair. Easy to disassemble. Pickup from boys hostel, JKLU.",
    price: 2500,
    category: "furniture",
    condition: "Good",
    campus: JKLU.campus,
    sellerName: "Karan K.",
    sellerEmail: "karan@jklu.edu.in",
    emoji: "🛋️",
    createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: "4",
    title: "DSA & OS Tutoring — ₹300/hr",
    description:
      "CSE 3rd year. Available evenings at JKLU campus or online. First session free.",
    price: 300,
    category: "services",
    condition: "Like New",
    campus: JKLU.campus,
    sellerName: "Sam R.",
    sellerEmail: "sam@jklu.edu.in",
    emoji: "🛠️",
    createdAt: Date.now() - 86400000 * 0.5,
  },
  {
    id: "5",
    title: "JKLU Hoodie — Size M",
    description:
      "Official JKLU merch, worn twice. Smoke-free hostel room.",
    price: 800,
    category: "clothing",
    condition: "Like New",
    campus: JKLU.campus,
    sellerName: "Neha L.",
    sellerEmail: "neha@jklu.edu.in",
    emoji: "👕",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "6",
    title: "Mini Fridge for Hostel Room",
    description:
      "Works perfectly. Quiet compressor. Pick up from JKLU girls hostel block.",
    price: 3500,
    category: "other",
    condition: "Good",
    campus: JKLU.campus,
    sellerName: "Chris P.",
    sellerEmail: "chris@jklu.edu.in",
    emoji: "📦",
    createdAt: Date.now() - 86400000 * 5,
  },
];

export function getCategoryLabel(id) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function getCategoryEmoji(id) {
  return CATEGORIES.find((c) => c.id === id)?.emoji ?? "📦";
}

export function formatPrice(price) {
  const formatted = price % 1 === 0 ? price.toLocaleString("en-IN") : price.toFixed(2);
  return `₹${formatted}`;
}

export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
