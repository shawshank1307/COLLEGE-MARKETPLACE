export const CATEGORIES = [
  { id: "all", label: "All", emoji: "🏷️" },
  { id: "textbooks", label: "Textbooks", emoji: "📚" },
  { id: "electronics", label: "Electronics", emoji: "💻" },
  { id: "furniture", label: "Furniture", emoji: "🛋️" },
  { id: "clothing", label: "Clothing", emoji: "👕" },
  { id: "services", label: "Services", emoji: "🛠️" },
  { id: "other", label: "Other", emoji: "📦" },
];

export const CAMPUSES = [
  "All Campuses",
  "North Campus",
  "South Campus",
  "East Campus",
  "West Campus",
  "Central Campus",
];

export const CONDITIONS = ["Like New", "Good", "Fair", "Used"];

export const SAMPLE_LISTINGS = [
  {
    id: "1",
    title: "Calculus Early Transcendentals — 8th Edition",
    description:
      "Used for MATH 101. Minimal highlighting, no torn pages. Includes solution manual PDF on request. Pick up at North Campus library.",
    price: 45,
    category: "textbooks",
    condition: "Good",
    campus: "North Campus",
    sellerName: "Priya S.",
    sellerEmail: "priya@university.edu",
    emoji: "📚",
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: "2",
    title: "MacBook Air M1 — 256GB, Perfect for CS Students",
    description:
      "Selling because I upgraded. Battery health 92%. Comes with charger and laptop sleeve. Can demo before purchase.",
    price: 650,
    category: "electronics",
    condition: "Like New",
    campus: "Central Campus",
    sellerName: "Alex M.",
    sellerEmail: "alex@university.edu",
    emoji: "💻",
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: "3",
    title: "IKEA Desk + Chair Set — Dorm Ready",
    description:
      "Compact desk (120cm) with adjustable chair. Easy to disassemble for move-out. Must pick up from South dorm block B.",
    price: 80,
    category: "furniture",
    condition: "Good",
    campus: "South Campus",
    sellerName: "Jordan K.",
    sellerEmail: "jordan@university.edu",
    emoji: "🛋️",
    createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: "4",
    title: "Organic Chemistry Tutoring — ₹25/hr",
    description:
      "A+ in OChem I & II. Available evenings and weekends. First 30-min session free. Zoom or in-person at East Campus study hall.",
    price: 25,
    category: "services",
    condition: "Like New",
    campus: "East Campus",
    sellerName: "Sam R.",
    sellerEmail: "sam@university.edu",
    emoji: "🛠️",
    createdAt: Date.now() - 86400000 * 0.5,
  },
  {
    id: "5",
    title: "University Hoodie — Size M, Navy",
    description:
      "Official campus merch, worn twice. Too small for me now. Smoke-free dorm.",
    price: 35,
    category: "clothing",
    condition: "Like New",
    campus: "West Campus",
    sellerName: "Taylor L.",
    sellerEmail: "taylor@university.edu",
    emoji: "👕",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "6",
    title: "Mini Fridge — Great for Dorms",
    description:
      "Works perfectly. Quiet compressor. Cleaned and sanitized. You haul from 3rd floor, I'll help carry down.",
    price: 60,
    category: "other",
    condition: "Good",
    campus: "North Campus",
    sellerName: "Chris P.",
    sellerEmail: "chris@university.edu",
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
  const formatted = price % 1 === 0 ? price : price.toFixed(2);
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
