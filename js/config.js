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
