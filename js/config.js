export const JKLU = {
  name: "JK Lakshmipat University",
  shortName: "JKLU",
  campus: "JKLU Campus",
  location: "Mahapura, Jaipur, Rajasthan",
  emailDomain: "jklu.edu.in",
  tagline: "Buy & sell within the JKLU student community",
};

export const LOGO = {
  header: "assets/jklu/logo-header.png",
  large: "assets/jklu/logo-large.png",
  full: "assets/jklu/logo.png",
  favicon: "assets/jklu/favicon.png",
};

export const CAMPUS_PHOTOS = [
  {
    src: "assets/jklu/campus-1.jpg",
    srcMd: "assets/jklu/campus-1-md.jpg",
    caption: "JKLU Academic Block — Mahapura Campus",
  },
  {
    src: "assets/jklu/campus-2.jpg",
    srcMd: "assets/jklu/campus-2-md.jpg",
    caption: "Jaipur skyline from JKLU",
  },
  {
    src: "assets/jklu/campus-3.jpg",
    srcMd: "assets/jklu/campus-3-md.jpg",
    caption: "Terracotta architecture at JKLU",
  },
  {
    src: "assets/jklu/campus-5.jpg",
    srcMd: "assets/jklu/campus-5-md.jpg",
    caption: "JKLU hostels — your home on campus",
  },
];

export const CAMPUSES = [JKLU.campus];

/** Live backend API — update after deploying to Render */
export const PRODUCTION_API_URL = "https://jklu-swap.onrender.com";

/** Which campus photo each section uses (index into CAMPUS_PHOTOS) */
const ROUTE_PHOTO_MAP = {
  "/": 0,
  "/sell": 1,
  "/messages": 2,
  "/profile": 3,
  "/login": 1,
  "/verify": 2,
};

function hashPhotoIndex(seed, offset = 0) {
  let h = 0;
  const s = String(seed || "default");
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * 17) % CAMPUS_PHOTOS.length;
  return (h + offset) % CAMPUS_PHOTOS.length;
}

export function getRoutePhotoIndex(path, { signupStep = 1 } = {}) {
  const base = (path || "/").split("?")[0];

  if (base === "/signup") {
    return (signupStep - 1) % CAMPUS_PHOTOS.length;
  }
  if (base.startsWith("/item/")) {
    return hashPhotoIndex(base.split("/item/")[1]);
  }
  if (base.startsWith("/checkout/")) {
    return hashPhotoIndex(base.split("/checkout/")[1], 2);
  }
  if (base.startsWith("/messages/")) {
    return hashPhotoIndex(base.split("/messages/")[1], 1);
  }
  if (ROUTE_PHOTO_MAP[base] !== undefined) {
    return ROUTE_PHOTO_MAP[base];
  }
  return 0;
}

export function photoAt(index) {
  return CAMPUS_PHOTOS[index % CAMPUS_PHOTOS.length];
}

export function photoUrl(photo) {
  if (window.matchMedia("(max-width: 768px)").matches && photo.srcMd) {
    return photo.srcMd;
  }
  return photo.src;
}

export function logoHtml({ size = "header", className = "", alt = "JKLU Logo" } = {}) {
  const src = LOGO[size] || LOGO.header;
  return `<img src="${src}" alt="${alt}" class="jklu-logo ${className}" loading="lazy" />`;
}
