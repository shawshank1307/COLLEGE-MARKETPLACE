import {
  CATEGORIES,
  CONDITIONS,
  getCategoryLabel,
  getCategoryEmoji,
  formatPrice,
  timeAgo,
} from "./data.js";
import { JKLU, CAMPUS_PHOTOS, LOGO, photoUrl, getRoutePhotoIndex, photoAt } from "./config.js";
import { processListingImage, listingImageHtml } from "./image-utils.js";
import { initAmbient } from "./ambient.js";
import { api } from "./api.js";
import {
  getUser,
  isLoggedIn,
  isVerified,
  loadSession,
  login,
  logout,
  setUser,
  requireAuth,
} from "./auth.js";

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
const nav = document.getElementById("main-nav");
const menuToggle = document.getElementById("menu-toggle");
const headerActions = document.getElementById("header-actions");

let state = {
  search: "",
  category: "all",
  sort: "newest",
};

let listingsCache = [];
let myListingsCache = [];
let signupDraft = { campus: JKLU.campus };
let cameraStream = null;
let slideshowTimer = null;
let heroSlideshowTimer = null;

function applySectionPhoto(photoIndex) {
  const photo = photoAt(photoIndex);
  const url = photoUrl(photo);
  const bg = document.getElementById("page-bg");
  if (!bg) return;
  if (bg.dataset.photoIndex === String(photoIndex)) return;

  const img = new Image();
  img.onload = () => {
    bg.style.backgroundImage = `url('${url}')`;
    bg.dataset.photoIndex = String(photoIndex);
  };
  img.src = url;
}

function renderPageBanner(photoIndex, title, subtitle = "") {
  const photo = photoAt(photoIndex);
  return `
    <section class="page-banner animate-fade" style="background-image:url('${photoUrl(photo)}')">
      <div class="page-banner-overlay"></div>
      <div class="container page-banner-content">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        <p class="page-banner-caption">${escapeHtml(photo.caption)}</p>
      </div>
    </section>`;
}

function showToast(message, duration = 3000) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), duration);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function parseRoute() {
  const hash = location.hash.slice(1) || "/";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  return { path, params };
}

function navigate(path) {
  location.hash = path;
}

function setActiveNav(path) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const route = link.dataset.route;
    link.classList.toggle(
      "active",
      route === path || (path.startsWith("/item") && route === "/")
    );
  });
}

function updateHeader() {
  const user = getUser();
  if (!headerActions) return;

  if (user) {
    headerActions.innerHTML = `
      <span class="header-user">${escapeHtml(user.name.split(" ")[0])}</span>
      <button class="btn btn-outline btn-sm" id="logout-btn">Logout</button>
    `;
    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await logout();
      showToast("Logged out");
      updateHeader();
      render();
    });
  } else {
    headerActions.innerHTML = `
      <a href="#/login" class="btn btn-outline btn-sm">Login</a>
      <a href="#/signup" class="btn btn-primary btn-sm">Sign Up</a>
    `;
  }
}

async function fetchListings() {
  try {
    const data = await api.getListings();
    listingsCache = data.listings || [];
  } catch {
    listingsCache = [];
    showToast("Could not load listings. Please refresh the page.");
  }
  return listingsCache;
}

async function fetchMyListings() {
  try {
    const data = await api.getMyListings();
    myListingsCache = data.listings || [];
  } catch {
    myListingsCache = [];
  }
  return myListingsCache;
}

function filterListings(listings) {
  let result = [...listings];
  if (state.category !== "all") {
    result = result.filter((l) => l.category === state.category);
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    result = result.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        (l.sellerName || "").toLowerCase().includes(q)
    );
  }
  switch (state.sort) {
    case "price-low":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      result.sort((a, b) => b.price - a.price);
      break;
    default:
      result.sort((a, b) => b.createdAt - a.createdAt);
  }
  return result;
}

function renderListingCard(listing, { showActions = false, idx = 0 } = {}) {
  const imageContent = listing.image
    ? listingImageHtml(listing.image, escapeHtml(listing.title), "")
    : `<div class="product-photo product-photo-emoji">${listing.emoji || getCategoryEmoji(listing.category)}</div>`;

  const soldBadge = listing.status === "sold" ? `<span class="listing-badge sold">Sold</span>` : `<span class="listing-badge">${escapeHtml(listing.condition)}</span>`;

  const actions = showActions
    ? listing.status === "sold"
      ? `<div class="listing-actions">
          <button class="btn btn-danger btn-sm" data-action="remove" data-id="${listing.id}">Remove Listing</button>
         </div>`
      : `<div class="listing-actions">
          <button class="btn btn-outline btn-sm" data-action="mark-sold" data-id="${listing.id}">Mark Sold</button>
          <button class="btn btn-outline btn-sm" data-action="delete" data-id="${listing.id}">Delete</button>
         </div>`
    : "";

  return `
    <div class="listing-card-wrap animate-in" style="animation-delay: ${Math.min(idx * 0.06, 0.5)}s">
      <a href="#/item/${listing.id}" class="listing-card ${listing.status === "sold" ? "sold" : ""}">
        <div class="listing-image">${imageContent}${soldBadge}</div>
        <div class="listing-body">
          <div class="listing-price">${formatPrice(listing.price)}${listing.category === "services" ? "/hr" : ""}</div>
          <h3 class="listing-title">${escapeHtml(listing.title)}</h3>
          <div class="listing-meta">
            <span>${escapeHtml(getCategoryLabel(listing.category))}</span>
            <span class="dot"></span>
            <span class="jklu-tag">JKLU</span>
            <span class="dot"></span>
            <span>${timeAgo(listing.createdAt)}</span>
          </div>
        </div>
      </a>
      ${actions}
    </div>`;
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
  }
  if (heroSlideshowTimer) {
    clearInterval(heroSlideshowTimer);
    heroSlideshowTimer = null;
  }
}

function initSlideshow(containerSelector = ".auth-slide", dotSelector = ".slide-dot") {
  stopSlideshow();
  const slides = document.querySelectorAll(containerSelector);
  const dots = document.querySelectorAll(dotSelector);
  if (!slides.length) return;

  let current = 0;
  const show = (index) => {
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
    current = index;
  };

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => show(i));
  });

  if (slides.length > 1) {
    slideshowTimer = setInterval(() => {
      show((current + 1) % slides.length);
    }, 4500);
  }
}

function renderAuthShell(formHtml, { subtitle = JKLU.tagline, photoIndex = 0 } = {}) {
  const start = photoIndex % CAMPUS_PHOTOS.length;
  const ordered = [
    ...CAMPUS_PHOTOS.slice(start),
    ...CAMPUS_PHOTOS.slice(0, start),
  ];

  const slides = ordered.map(
    (photo, i) =>
      `<div class="auth-slide ${i === 0 ? "active" : ""}" style="background-image:url('${photoUrl(photo)}')">
        <div class="auth-slide-overlay"></div>
        <img src="${LOGO.large}" alt="" class="slide-watermark slide-watermark-tl" aria-hidden="true" />
        <img src="${LOGO.large}" alt="" class="slide-watermark slide-watermark-br" aria-hidden="true" />
        <p class="auth-slide-caption animate-caption">${escapeHtml(photo.caption)}</p>
      </div>`
  ).join("");

  const dots = ordered.map(
    (_, i) => `<button type="button" class="slide-dot ${i === 0 ? "active" : ""}" aria-label="Slide ${i + 1}"></button>`
  ).join("");

  return `
    <div class="auth-shell animate-fade">
      <aside class="auth-visual">
        <div class="auth-slideshow">${slides}</div>
        <div class="auth-visual-brand">
          <img src="${LOGO.large}" alt="JK Lakshmipat University" class="jklu-logo auth-brand-logo" />
          <p class="auth-visual-location">${escapeHtml(JKLU.location)}</p>
        </div>
        <div class="slide-dots">${dots}</div>
      </aside>
      <div class="auth-form-panel">
        <div class="auth-form-inner animate-slide-up">
          <div class="auth-form-header">
            <span class="logo-on-white auth-logo-wrap">
              <img src="${LOGO.header}" alt="JKLU" class="jklu-logo auth-form-logo" />
            </span>
            <span class="auth-brand">JKLU <em>Swap</em></span>
          </div>
          <p class="auth-tagline">${escapeHtml(subtitle)}</p>
          ${formHtml}
        </div>
      </div>
    </div>`;
}

function bindAuthShellEvents() {
  initSlideshow();
}

function stepIndicator(current, total) {
  return `<div class="step-indicator">${Array.from({ length: total }, (_, i) =>
    `<span class="step-dot ${i + 1 <= current ? "active" : ""}"></span>`
  ).join("")}</div>`;
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
}

async function startCamera(videoEl) {
  stopCamera();
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    videoEl.srcObject = cameraStream;
    await videoEl.play();
    return true;
  } catch {
    showToast("Camera access denied. Use file upload instead.");
    return false;
  }
}

function renderHome() {
  const photoIndex = getRoutePhotoIndex("/");
  applySectionPhoto(photoIndex);

  const listings = filterListings(listingsCache);

  const pills = CATEGORIES.map(
    (cat) =>
      `<button class="pill ${state.category === cat.id ? "active" : ""}" data-category="${cat.id}">${cat.emoji} ${cat.label}</button>`
  ).join("");

  const grid =
    listings.length > 0
      ? `<div class="listings-grid">${listings.map((l, i) => renderListingCard(l, { idx: i })).join("")}</div>`
      : `<div class="empty-state animate-in"><div class="emoji">🔍</div><h3>No listings found</h3><p>Try adjusting your filters or list something on JKLU campus!</p><a href="#/sell" class="btn btn-primary">List an Item</a></div>`;

  app.innerHTML = `
    <section class="hero jklu-hero">
      <div class="hero-bg-slides">
        ${CAMPUS_PHOTOS.map((p, i) => `<div class="hero-bg-slide ${i === photoIndex ? "active" : ""}" style="background-image:url('${photoUrl(p)}')"></div>`).join("")}
      </div>
      <img src="${LOGO.large}" alt="" class="hero-watermark" aria-hidden="true" />
      <div class="hero-overlay"></div>
      <div class="hero-shapes"><span class="shape shape-1"></span><span class="shape shape-2"></span><span class="shape shape-3"></span></div>
      <div class="container hero-content animate-slide-up">
        <span class="hero-badge">🎓 JK Lakshmipat University</span>
        <h1>Your <span class="text-gradient">JKLU</span> Marketplace</h1>
        <p>Verified JKLU students only — buy &amp; sell textbooks, electronics, hostel essentials &amp; more on campus.</p>
        <div class="hero-actions">
          <a href="#/signup" class="btn btn-primary btn-glow">Join JKLU Swap</a>
          <a href="#/" class="btn btn-secondary" id="browse-btn">Browse Listings</a>
        </div>
      </div>
    </section>
    <div class="container stats-bar animate-in">
      <div class="stat-card stat-float"><strong>${listingsCache.length}</strong><span>Active Listings</span></div>
      <div class="stat-card stat-float" style="animation-delay:0.1s"><strong>JKLU</strong><span>One Campus</span></div>
      <div class="stat-card stat-float" style="animation-delay:0.2s"><strong>✓</strong><span>ID Verified</span></div>
    </div>
    <section class="filters-section container animate-in">
      <div class="filters-bar">
        <div class="search-wrap"><span class="search-icon">🔍</span><input type="search" id="search-input" placeholder="Search JKLU listings..." value="${escapeHtml(state.search)}" /></div>
        <select id="sort-filter">
          <option value="newest" ${state.sort === "newest" ? "selected" : ""}>Newest first</option>
          <option value="price-low" ${state.sort === "price-low" ? "selected" : ""}>Price: Low to High</option>
          <option value="price-high" ${state.sort === "price-high" ? "selected" : ""}>Price: High to Low</option>
        </select>
      </div>
      <div class="category-pills">${pills}</div>
    </section>
    <section class="container"><h2 class="section-title animate-in">${listings.length} listing${listings.length !== 1 ? "s" : ""} at JKLU</h2>${grid}</section>`;

  bindFilterEvents();
  initHeroSlideshow(photoIndex);
  document.getElementById("browse-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".filters-section")?.scrollIntoView({ behavior: "smooth" });
  });
}

function initHeroSlideshow(startIndex = 0) {
  const slides = document.querySelectorAll(".hero-bg-slide");
  if (slides.length < 2) return;
  let i = startIndex % slides.length;
  const show = (index) => {
    slides.forEach((s, idx) => s.classList.toggle("active", idx === index));
    applySectionPhoto(index);
    i = index;
  };
  show(i);
  heroSlideshowTimer = setInterval(() => {
    show((i + 1) % slides.length);
  }, 6000);
}

function bindFilterEvents() {
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    state.search = e.target.value;
    render();
  });
  document.getElementById("sort-filter")?.addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
  document.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      render();
    });
  });
}

function renderSignup(step = 1) {
  stopCamera();
  stopSlideshow();
  const photoIndex = getRoutePhotoIndex("/signup", { signupStep: step });
  applySectionPhoto(photoIndex);

  let content = "";

  if (step === 1) {
    content = `
      ${stepIndicator(1, 3)}
      <h2>Create Account</h2>
      <p class="form-subtitle">Join the JKLU student marketplace with your official details.</p>
      <form id="signup-step1">
        <div class="form-group"><label for="name">Full Name</label><input class="input" id="name" required placeholder="e.g. Rahul Sharma" value="${escapeHtml(signupDraft.name || "")}" /></div>
        <div class="form-row">
          <div class="form-group"><label for="rollNumber">Roll Number</label><input class="input" id="rollNumber" required placeholder="e.g. 22BCS1042" value="${escapeHtml(signupDraft.rollNumber || "")}" /></div>
          <div class="form-group"><label for="phone">Phone Number</label><input class="input" id="phone" type="tel" required pattern="[0-9]{10}" placeholder="10-digit mobile" value="${escapeHtml(signupDraft.phone || "")}" /></div>
        </div>
        <div class="form-group"><label for="collegeEmail">JKLU Email</label><input class="input" id="collegeEmail" type="email" required placeholder="you@jklu.edu.in" value="${escapeHtml(signupDraft.collegeEmail || "")}" /><p class="hint">Use your official @jklu.edu.in email</p></div>
        <div class="jklu-campus-chip">📍 ${escapeHtml(JKLU.campus)} · ${escapeHtml(JKLU.location)}</div>
        <button type="submit" class="btn btn-accent btn-block">Continue →</button>
      </form>
      <p class="auth-footer">Already have an account? <a href="#/login">Log in</a></p>`;
  } else if (step === 2) {
    content = `
      ${stepIndicator(2, 3)}
      <h2>College ID Verification</h2>
      <p class="form-subtitle">Take a clear photo of your college identity card. This keeps our marketplace safe for students.</p>
      <div class="id-capture-area">
        <video id="id-video" class="id-video" playsinline autoplay muted></video>
        <canvas id="id-canvas" class="hidden"></canvas>
        <div class="id-preview" id="id-preview">${signupDraft.idPreview ? `<img src="${signupDraft.idPreview}" alt="ID preview" />` : '<span class="id-placeholder">📸 No photo yet</span>'}</div>
      </div>
      <div class="id-actions">
        <button type="button" class="btn btn-outline" id="start-camera">Open Camera</button>
        <button type="button" class="btn btn-primary" id="capture-photo">Capture Photo</button>
        <label class="btn btn-outline" for="id-upload">Upload File<input type="file" id="id-upload" accept="image/*" capture="environment" hidden /></label>
      </div>
      <div class="form-actions-row">
        <button type="button" class="btn btn-outline" id="back-step1">← Back</button>
        <button type="button" class="btn btn-accent" id="to-step3" ${signupDraft.idFile || signupDraft.idPreview ? "" : "disabled"}>Continue →</button>
      </div>`;
  } else {
    content = `
      ${stepIndicator(3, 3)}
      <h2>Verify College Email</h2>
      <p class="form-subtitle">We sent a 6-digit code to <strong>${escapeHtml(signupDraft.collegeEmail || "")}</strong></p>
      <div class="verify-notice" id="demo-otp-notice"></div>
      <form id="signup-verify">
        <div class="form-group"><label for="otp">Verification Code</label><input class="input otp-input" id="otp" required maxlength="6" pattern="[0-9]{6}" placeholder="000000" inputmode="numeric" /></div>
        <button type="submit" class="btn btn-accent btn-block">Verify &amp; Create Account</button>
      </form>
      <button type="button" class="btn btn-outline btn-block" id="resend-otp" style="margin-top:0.75rem">Resend Code</button>
      <button type="button" class="btn btn-ghost btn-block" id="back-step2">← Back</button>
      <p class="auth-footer">Already have an account? <a href="#/login">Log in</a></p>`;
  }

  app.innerHTML = renderAuthShell(content, {
    subtitle: step === 1 ? "Create your JKLU student account" : step === 2 ? "Verify your JKLU identity" : "Almost there — verify your email",
    photoIndex,
  });
  bindAuthShellEvents();

  if (step === 1) {
    document.getElementById("signup-step1")?.addEventListener("submit", (e) => {
      e.preventDefault();
      signupDraft = {
        ...signupDraft,
        name: document.getElementById("name").value.trim(),
        rollNumber: document.getElementById("rollNumber").value.trim().toUpperCase(),
        phone: document.getElementById("phone").value.trim(),
        collegeEmail: document.getElementById("collegeEmail").value.trim().toLowerCase(),
        campus: JKLU.campus,
      };
      renderSignup(2);
    });
  }

  if (step === 2) {
    const preview = document.getElementById("id-preview");
    const video = document.getElementById("id-video");
    const canvas = document.getElementById("id-canvas");
    const toStep3 = document.getElementById("to-step3");

    document.getElementById("start-camera")?.addEventListener("click", () => startCamera(video));
    document.getElementById("capture-photo")?.addEventListener("click", () => {
      if (!cameraStream) {
        showToast("Open camera first or upload a file.");
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        signupDraft.idFile = new File([blob], "id-card.jpg", { type: "image/jpeg" });
        signupDraft.idPreview = canvas.toDataURL("image/jpeg");
        preview.innerHTML = `<img src="${signupDraft.idPreview}" alt="ID preview" />`;
        toStep3.disabled = false;
        stopCamera();
        showToast("ID photo captured!");
      }, "image/jpeg", 0.85);
    });

    document.getElementById("id-upload")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      signupDraft.idFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        signupDraft.idPreview = reader.result;
        preview.innerHTML = `<img src="${reader.result}" alt="ID preview" />`;
        toStep3.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("back-step1")?.addEventListener("click", () => renderSignup(1));
    document.getElementById("to-step3")?.addEventListener("click", async () => {
      try {
        const formData = new FormData();
        formData.append("name", signupDraft.name);
        formData.append("rollNumber", signupDraft.rollNumber);
        formData.append("phone", signupDraft.phone);
        formData.append("collegeEmail", signupDraft.collegeEmail);
        formData.append("campus", signupDraft.campus);
        formData.append("idCard", signupDraft.idFile);

        const data = await api.signup(formData);
        api.setToken(data.token);
        setUser(data.user);
        signupDraft.demoOtp = data.demoOtp;
        updateHeader();
        renderSignup(3);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  if (step === 3) {
    const notice = document.getElementById("demo-otp-notice");
    if (signupDraft.demoOtp) {
      notice.innerHTML = `<div class="demo-otp">Demo mode — your code is: <strong>${signupDraft.demoOtp}</strong></div>`;
    }

    document.getElementById("signup-verify")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const data = await api.verifyEmail(signupDraft.collegeEmail, document.getElementById("otp").value.trim());
        setUser(data.user);
        showToast("Welcome to JKLU Swap!");
        navigate("#/");
        render();
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById("resend-otp")?.addEventListener("click", async () => {
      try {
        const data = await api.sendOtp(signupDraft.collegeEmail);
        if (data.demoOtp) {
          signupDraft.demoOtp = data.demoOtp;
          notice.innerHTML = `<div class="demo-otp">Demo mode — your code is: <strong>${data.demoOtp}</strong></div>`;
        }
        showToast("New code sent!");
      } catch (err) {
        showToast(err.message);
      }
    });

    document.getElementById("back-step2")?.addEventListener("click", () => renderSignup(2));
  }
}

function renderLogin() {
  stopSlideshow();
  const photoIndex = getRoutePhotoIndex("/login");
  applySectionPhoto(photoIndex);
  const formHtml = `
    <h2>Welcome Back</h2>
    <p class="form-subtitle">Log in with your JKLU email and roll number.</p>
    <form id="login-form">
      <div class="form-group"><label for="login-email">JKLU Email</label><input class="input" id="login-email" type="email" required placeholder="you@jklu.edu.in" /></div>
      <div class="form-group"><label for="login-roll">Roll Number</label><input class="input" id="login-roll" required placeholder="e.g. 22BCS1042" /></div>
      <button type="submit" class="btn btn-accent btn-block btn-glow">Log In</button>
    </form>
    <p class="auth-footer">New to JKLU Swap? <a href="#/signup">Create an account</a></p>`;

  app.innerHTML = renderAuthShell(formHtml, { subtitle: "Welcome back to JKLU Swap", photoIndex });
  bindAuthShellEvents();

  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await login(
        document.getElementById("login-email").value.trim().toLowerCase(),
        document.getElementById("login-roll").value.trim().toUpperCase()
      );
      updateHeader();
      showToast("Logged in!");
      if (!isVerified()) {
        signupDraft.collegeEmail = getUser().collegeEmail;
        navigate("#/verify");
      } else {
        navigate("#/");
      }
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderVerify() {
  stopSlideshow();
  const photoIndex = getRoutePhotoIndex("/verify");
  applySectionPhoto(photoIndex);
  const user = getUser();
  if (!user) {
    navigate("#/login");
    render();
    return;
  }
  signupDraft.collegeEmail = user.collegeEmail;

  const formHtml = `
    <h2>Verify Your Email</h2>
    <p class="form-subtitle">Enter the code sent to <strong>${escapeHtml(user.collegeEmail)}</strong></p>
    <div class="verify-notice" id="demo-otp-notice"></div>
    <form id="verify-form">
      <div class="form-group"><label for="otp">Verification Code</label><input class="input otp-input" id="otp" required maxlength="6" placeholder="000000" inputmode="numeric" /></div>
      <button type="submit" class="btn btn-accent btn-block btn-glow">Verify Email</button>
    </form>
    <button type="button" class="btn btn-outline btn-block" id="resend-otp" style="margin-top:0.75rem">Resend Code</button>`;

  app.innerHTML = renderAuthShell(formHtml, { subtitle: "Verify your JKLU email to continue", photoIndex });
  bindAuthShellEvents();

  document.getElementById("verify-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api.verifyEmail(user.collegeEmail, document.getElementById("otp").value.trim());
      setUser(data.user);
      showToast("Email verified!");
      navigate("#/");
      render();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("resend-otp")?.addEventListener("click", async () => {
    try {
      const data = await api.sendOtp(user.collegeEmail);
      if (data.demoOtp) {
        document.getElementById("demo-otp-notice").innerHTML =
          `<div class="demo-otp">Demo mode — your code is: <strong>${data.demoOtp}</strong></div>`;
      }
      showToast("Code sent!");
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function renderDetail(id) {
  const photoIndex = getRoutePhotoIndex(`/item/${id}`);
  applySectionPhoto(photoIndex);

  let listing;
  try {
    const data = await api.getListing(id);
    listing = data.listing;
  } catch {
    listing = listingsCache.find((l) => l.id === id);
  }

  if (!listing) {
    app.innerHTML = `<div class="container detail-page"><div class="empty-state"><div class="emoji">😕</div><h3>Listing not found</h3><a href="#/" class="btn btn-primary">Back to Browse</a></div></div>`;
    return;
  }

  const user = getUser();
  const isOwner = user && listing.sellerId === user.id;
  const isSold = listing.status === "sold";
  const imageContent = listing.image
    ? listingImageHtml(listing.image, escapeHtml(listing.title), "")
    : `<div class="product-photo product-photo-emoji detail-emoji">${listing.emoji || getCategoryEmoji(listing.category)}</div>`;
  const priceSuffix = listing.category === "services" ? "/hr" : "";

  let actions = "";
  if (isSold && isOwner) {
    actions = `
      <span class="sold-label">Sold — remove when you're done</span>
      <button class="btn btn-danger" id="remove-sold-btn">Remove Listing</button>`;
  } else if (isSold) {
    actions = `<span class="sold-label">This item has been sold</span>`;
  } else if (isOwner) {
    actions = `
      <button class="btn btn-outline" id="mark-sold-btn">Mark as Sold</button>
      <button class="btn btn-outline" id="delete-listing-btn">Delete Listing</button>
      <span class="owner-label">This is your listing</span>`;
  } else if (user && isVerified()) {
    actions = `
      <button class="btn btn-accent" id="message-btn">Message Seller</button>
      <a href="#/checkout/${listing.id}" class="btn btn-primary">Buy Now — ${formatPrice(listing.price)}</a>
      <button class="btn btn-outline" id="share-btn">Share</button>`;
  } else {
    actions = `<a href="#/login" class="btn btn-accent">Log in to Buy or Message</a>`;
  }

  app.innerHTML = `
    ${renderPageBanner(photoIndex, listing.title, `${getCategoryLabel(listing.category)} · ${formatPrice(listing.price)}`)}
    <div class="container detail-page">
      <a href="#/" class="back-link">← Back to listings</a>
      <div class="detail-grid">
        <div class="detail-image">${imageContent}</div>
        <div class="detail-info">
          <div class="detail-tags">
            <span class="tag">${escapeHtml(getCategoryLabel(listing.category))}</span>
            <span class="tag">${escapeHtml(listing.condition)}</span>
            <span class="tag jklu-tag">JKLU</span>
            ${listing.sellerRollNumber ? `<span class="tag verified">✓ Verified Student</span>` : ""}
          </div>
          <h1>${escapeHtml(listing.title)}</h1>
          <div class="detail-price">${formatPrice(listing.price)}${priceSuffix}</div>
          <p class="detail-desc">${escapeHtml(listing.description)}</p>
          <div class="seller-card">
            <h4>Seller</h4>
            <div class="seller-row">
              <div class="seller-avatar">${initials(listing.sellerName)}</div>
              <div>
                <div class="seller-name">${escapeHtml(listing.sellerName)}</div>
                <div class="seller-campus">JKLU · Roll: ${escapeHtml(listing.sellerRollNumber || "—")}</div>
                ${user && isVerified() ? `<div class="seller-contact">📞 ${escapeHtml(listing.sellerPhone || "—")}</div>` : ""}
              </div>
            </div>
          </div>
          <div class="detail-actions">${actions}</div>
        </div>
      </div>
    </div>`;

  document.getElementById("message-btn")?.addEventListener("click", async () => {
    try {
      const data = await api.startConversation(listing.id);
      navigate(`#/messages/${data.conversationId}`);
      render();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("share-btn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("Link copied!");
    } catch {
      showToast("Could not copy link");
    }
  });

  document.getElementById("mark-sold-btn")?.addEventListener("click", async () => {
    if (!confirm("Mark this item as sold? It will be hidden from browse.")) return;
    try {
      await api.markListingSold(listing.id);
      await fetchListings();
      showToast("Item marked as sold!");
      renderDetail(id);
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("remove-sold-btn")?.addEventListener("click", async () => {
    if (!confirm("Remove this sold listing permanently?")) return;
    try {
      await api.deleteListing(listing.id);
      await fetchListings();
      showToast("Listing removed");
      navigate("#/profile");
      render();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById("delete-listing-btn")?.addEventListener("click", async () => {
    if (!confirm("Delete this listing?")) return;
    try {
      await api.deleteListing(listing.id);
      await fetchListings();
      showToast("Listing deleted");
      navigate("#/profile");
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderSell() {
  const photoIndex = getRoutePhotoIndex("/sell");
  applySectionPhoto(photoIndex);

  if (!requireAuth((reason) => navigate(reason === "verify" ? "#/verify" : "#/signup"))) {
    app.innerHTML = `<div class="container auth-page"><div class="auth-card"><h2>Sign up required</h2><p class="form-subtitle">Create a verified student account to sell items.</p><a href="#/signup" class="btn btn-accent btn-block">Sign Up</a></div></div>`;
    return;
  }

  const user = getUser();
  const categoryOptions = CATEGORIES.filter((c) => c.id !== "all")
    .map((c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join("");
  const conditionOptions = CONDITIONS.map((c) => `<option value="${c}">${c}</option>`).join("");

  app.innerHTML = `
    ${renderPageBanner(photoIndex, "List an Item", `Selling at ${JKLU.campus}`)}
    <div class="container animate-fade">
      <p class="sell-user-line">Listing as <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.rollNumber)})</p>
      <form class="form-card animate-slide-up" id="sell-form">
        <div class="form-group"><label for="title">Title</label><input class="input" id="title" required maxlength="100" placeholder="e.g. Engineering Mathematics — Grewal" /></div>
        <div class="form-row">
          <div class="form-group"><label for="price">Price (₹)</label><input class="input" id="price" type="number" required min="0" step="1" placeholder="0" /></div>
          <div class="form-group"><label for="category">Category</label><select id="category" required>${categoryOptions}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="condition">Condition</label><select id="condition" required>${conditionOptions}</select></div>
          <div class="form-group"><label>Pickup Location</label><div class="jklu-campus-chip">📍 ${escapeHtml(JKLU.campus)}</div></div>
        </div>
        <div class="form-group"><label for="description">Description</label><textarea class="input" id="description" required maxlength="500" placeholder="Condition, pickup location, etc."></textarea></div>
        <div class="form-group">
          <label for="image">Photo (optional)</label>
          <input class="input" id="image" type="file" accept="image/*" />
          <p class="hint">Tip: Use a plain background for best results. We'll auto-crop and clean it up.</p>
          <div class="upload-preview" id="image-preview"></div>
        </div>
        <button type="submit" class="btn btn-accent btn-block">Publish Listing</button>
      </form>
    </div>`;

  let imageData = null;
  document.getElementById("image")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("image-preview");
    if (!file) {
      imageData = null;
      preview.classList.remove("visible");
      preview.innerHTML = "";
      return;
    }
    preview.classList.add("visible", "loading");
    preview.innerHTML = `<span class="preview-loading">Processing photo…</span>`;
    try {
      imageData = await processListingImage(file);
      preview.classList.remove("loading");
      preview.innerHTML = `<div class="product-photo product-photo-lg"><img src="${imageData}" alt="Preview" /></div>`;
    } catch (err) {
      preview.classList.remove("loading", "visible");
      preview.innerHTML = "";
      showToast(err.message || "Could not process image");
    }
  });

  document.getElementById("sell-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const category = document.getElementById("category").value;
      const data = await api.createListing({
        title: document.getElementById("title").value.trim(),
        description: document.getElementById("description").value.trim(),
        price: parseFloat(document.getElementById("price").value),
        category,
        condition: document.getElementById("condition").value,
        campus: JKLU.campus,
        emoji: getCategoryEmoji(category),
        image: imageData,
      });
      await fetchListings();
      showToast("Listing published!");
      navigate(`#/item/${data.listing.id}`);
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderProfile() {
  const photoIndex = getRoutePhotoIndex("/profile");
  applySectionPhoto(photoIndex);

  if (!requireAuth((reason) => navigate(reason === "verify" ? "#/verify" : "#/login"))) {
    renderLogin();
    return;
  }

  const user = getUser();
  const myListings = myListingsCache;
  const activeCount = myListings.filter((l) => l.status !== "sold").length;
  const soldCount = myListings.filter((l) => l.status === "sold").length;

  const activeListings = myListings.filter((l) => l.status !== "sold");
  const soldListings = myListings.filter((l) => l.status === "sold");

  const activeGrid = activeListings.length
    ? `<div class="listings-grid">${activeListings.map((l, i) => renderListingCard(l, { showActions: true, idx: i })).join("")}</div>`
    : `<div class="empty-state compact"><p>No active listings. <a href="#/sell">List something!</a></p></div>`;

  const soldGrid = soldListings.length
    ? `<div class="listings-grid">${soldListings.map((l, i) => renderListingCard(l, { showActions: true, idx: i })).join("")}</div>`
    : "";

  app.innerHTML = `
    ${renderPageBanner(photoIndex, "Your Profile", "Verified JKLU student account")}
    <div class="container">
      <div class="profile-grid">
        <aside class="profile-sidebar">
          <div class="profile-logo-wrap logo-on-white">
            <img src="${LOGO.large}" alt="JKLU" class="jklu-logo profile-logo" />
          </div>
          <div class="profile-avatar-lg">${initials(user.name)}</div>
          <h2>${escapeHtml(user.name)}</h2>
          <p class="campus-label">${escapeHtml(user.collegeEmail)}</p>
          <p class="campus-label">Roll: ${escapeHtml(user.rollNumber)}</p>
          <p class="campus-label">📞 ${escapeHtml(user.phone)}</p>
          <p class="campus-label">📍 ${escapeHtml(JKLU.campus)} · ${escapeHtml(JKLU.location)}</p>
          <div class="verify-badges">
            ${user.emailVerified ? '<span class="badge badge-green">✓ Email Verified</span>' : ""}
            ${user.idVerified ? '<span class="badge badge-green">✓ ID Verified</span>' : ""}
          </div>
          <div class="profile-stats">
            <div class="profile-stat"><strong>${activeCount}</strong><span>Active</span></div>
            <div class="profile-stat"><strong>${soldCount}</strong><span>Sold</span></div>
          </div>
        </aside>
        <div>
          <h2 class="section-title">Active Listings</h2>
          <div class="my-listings">${activeGrid}</div>
          ${soldListings.length ? `<h2 class="section-title sold-section-title">Sold — Remove when done</h2><p class="section-hint">These are hidden from browse. Tap <strong>Remove Listing</strong> to delete them.</p>${soldGrid}` : ""}
        </div>
      </div>
    </div>`;

  bindListingActions();
}

function bindListingActions() {
  document.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this listing?")) return;
      try {
        await api.deleteListing(btn.dataset.id);
        await fetchListings();
        await fetchMyListings();
        showToast("Listing deleted");
        render();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  document.querySelectorAll("[data-action='mark-sold']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Mark this item as sold? It will be hidden from browse.")) return;
      try {
        await api.markListingSold(btn.dataset.id);
        await fetchListings();
        await fetchMyListings();
        showToast("Item marked as sold!");
        render();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  document.querySelectorAll("[data-action='remove']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this sold listing permanently?")) return;
      try {
        await api.deleteListing(btn.dataset.id);
        await fetchListings();
        await fetchMyListings();
        showToast("Sold listing removed");
        render();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

async function renderMessages(conversationId) {
  const msgPath = conversationId ? `/messages/${conversationId}` : "/messages";
  const photoIndex = getRoutePhotoIndex(msgPath);
  applySectionPhoto(photoIndex);

  if (!requireAuth((reason) => navigate(reason === "verify" ? "#/verify" : "#/login"))) return;

  let conversations = [];
  try {
    const data = await api.getConversations();
    conversations = data.conversations || [];
  } catch (err) {
    showToast(err.message);
  }

  let messagesHtml = "";
  let activeConv = null;

  if (conversationId) {
    try {
      const data = await api.getMessages(conversationId);
      activeConv = conversations.find((c) => c.id === parseInt(conversationId, 10));
      messagesHtml = (data.messages || [])
        .map(
          (m) =>
            `<div class="chat-bubble ${m.isMine ? "mine" : "theirs"}"><div class="bubble-body">${escapeHtml(m.body)}</div><div class="bubble-time">${timeAgo(m.createdAt)}</div></div>`
        )
        .join("");
    } catch (err) {
      messagesHtml = `<p class="chat-empty">${escapeHtml(err.message)}</p>`;
    }
  }

  const convList = conversations.length
    ? conversations
        .map(
          (c) =>
            `<a href="#/messages/${c.id}" class="conv-item ${c.id === parseInt(conversationId, 10) ? "active" : ""}"><strong>${escapeHtml(c.listingTitle)}</strong><span>${escapeHtml(c.otherName)}</span><p>${escapeHtml(c.lastMessage)}</p></a>`
        )
        .join("")
    : `<p class="chat-empty">No conversations yet. Message a seller from a listing page.</p>`;

  app.innerHTML = `
    ${renderPageBanner(photoIndex, "Messages", "Chat with buyers and sellers on campus")}
    <div class="container messages-page">
      <div class="messages-layout">
        <aside class="conv-list">${convList}</aside>
        <section class="chat-panel">
          ${conversationId && activeConv ? `
            <div class="chat-header"><strong>${escapeHtml(activeConv.listingTitle)}</strong><span>with ${escapeHtml(activeConv.otherName)} · ${formatPrice(activeConv.listingPrice)}</span></div>
            <div class="chat-messages" id="chat-messages">${messagesHtml || '<p class="chat-empty">Start the conversation!</p>'}</div>
            <form class="chat-input-row" id="chat-form"><input class="input" id="chat-body" placeholder="Type a message..." required autocomplete="off" /><button type="submit" class="btn btn-accent">Send</button></form>
          ` : `<div class="chat-placeholder"><div class="emoji">💬</div><p>Select a conversation or message a seller from a listing.</p></div>`}
        </section>
      </div>
    </div>`;

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;

  document.getElementById("chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-body");
    const body = input.value.trim();
    if (!body) return;
    try {
      await api.sendMessage(conversationId, body);
      input.value = "";
      renderMessages(conversationId);
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function renderCheckout(listingId) {
  const photoIndex = getRoutePhotoIndex(`/checkout/${listingId}`);
  applySectionPhoto(photoIndex);

  if (!requireAuth((reason) => navigate(reason === "verify" ? "#/verify" : "#/login"))) return;

  let listing;
  try {
    const data = await api.getListing(listingId);
    listing = data.listing;
  } catch {
    showToast("Listing not found");
    navigate("#/");
    render();
    return;
  }

  app.innerHTML = `
    ${renderPageBanner(photoIndex, "Checkout", `Secure campus payment · ${listing.title}`)}
    <div class="container checkout-page">
      <div class="checkout-grid">
        <div class="checkout-summary form-card">
          <h3>Order Summary</h3>
          <div class="checkout-item"><span>${escapeHtml(listing.title)}</span><strong>${formatPrice(listing.price)}</strong></div>
          <div class="checkout-item"><span>Platform fee</span><strong>₹0</strong></div>
          <div class="checkout-total"><span>Total</span><strong>${formatPrice(listing.price)}</strong></div>
          <p class="hint">Meet on campus to collect your item after payment.</p>
        </div>
        <form class="form-card" id="payment-form">
          <h3>Payment Details</h3>
          <p class="form-subtitle">Demo payment — no real charges.</p>
          <div class="form-group"><label>Card Number</label><input class="input" required placeholder="4242 4242 4242 4242" maxlength="19" /></div>
          <div class="form-row">
            <div class="form-group"><label>Expiry</label><input class="input" required placeholder="MM/YY" maxlength="5" /></div>
            <div class="form-group"><label>CVV</label><input class="input" required placeholder="123" maxlength="3" type="password" /></div>
          </div>
          <div class="form-group"><label>Name on Card</label><input class="input" required placeholder="As on card" /></div>
          <button type="submit" class="btn btn-accent btn-block">Pay ${formatPrice(listing.price)}</button>
          <a href="#/item/${listing.id}" class="btn btn-ghost btn-block">Cancel</a>
        </form>
      </div>
    </div>`;

  document.getElementById("payment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.createPayment(listingId);
      await fetchListings();
      showToast("Payment successful! Message the seller to arrange pickup.");
      navigate("#/messages");
      render();
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function render() {
  stopCamera();
  stopSlideshow();
  const { path } = parseRoute();

  if (path.startsWith("/item/")) {
    setActiveNav("/");
    await renderDetail(path.split("/item/")[1]);
    return;
  }
  if (path.startsWith("/messages")) {
    setActiveNav("/messages");
    const convId = path.split("/messages/")[1] || null;
    await renderMessages(convId);
    return;
  }
  if (path.startsWith("/checkout/")) {
    setActiveNav("/");
    await renderCheckout(path.split("/checkout/")[1]);
    return;
  }

  switch (path) {
    case "/signup":
      setActiveNav("");
      renderSignup(1);
      break;
    case "/login":
      setActiveNav("");
      renderLogin();
      break;
    case "/verify":
      setActiveNav("");
      renderVerify();
      break;
    case "/sell":
      setActiveNav("/sell");
      renderSell();
      break;
    case "/profile":
      setActiveNav("/profile");
      await fetchMyListings();
      renderProfile();
      break;
    case "/messages":
      setActiveNav("/messages");
      await renderMessages(null);
      break;
    default:
      setActiveNav("/");
      await fetchListings();
      renderHome();
  }
}

menuToggle?.addEventListener("click", () => nav.classList.toggle("open"));
nav?.addEventListener("click", () => nav.classList.remove("open"));
window.addEventListener("hashchange", render);

async function init() {
  initAmbient();
  await loadSession();
  updateHeader();
  render();
}

init();
