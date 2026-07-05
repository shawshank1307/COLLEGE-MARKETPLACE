const FLOWERS = ["🌸", "🌺", "🌼", "🪷", "💮", "🌷", "✿", "🏵️"];

const BOOKS = ["📚", "📖", "📕", "📗", "📘"];
const LAPTOPS = ["💻", "🖥️"];

const MATH_EQUATIONS = [
  "a² + b² = c²",
  "E = mc²",
  "∫ f(x) dx",
  "dy/dx",
  "∑ n=1",
  "sin θ",
  "π ≈ 3.14",
  "lim x→0",
  "√x",
  "f(x) = ax + b",
  "log₂ n",
  "∇ · F",
];

function butterflySvg(id) {
  return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="10" cy="14" rx="9" ry="7" fill="url(#b${id}-L)" opacity="0.9"/>
  <ellipse cx="22" cy="14" rx="9" ry="7" fill="url(#b${id}-R)" opacity="0.9"/>
  <ellipse cx="8" cy="12" rx="4" ry="3" fill="rgba(255,255,255,0.35)"/>
  <ellipse cx="24" cy="12" rx="4" ry="3" fill="rgba(255,255,255,0.35)"/>
  <ellipse cx="16" cy="16" rx="1.5" ry="5" fill="#4a3728"/>
  <defs>
    <linearGradient id="b${id}-L" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9a56"/>
      <stop offset="50%" stop-color="#ff6b9d"/>
      <stop offset="100%" stop-color="#c2563e"/>
    </linearGradient>
    <linearGradient id="b${id}-R" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffb347"/>
      <stop offset="50%" stop-color="#ff85a2"/>
      <stop offset="100%" stop-color="#d4654a"/>
    </linearGradient>
  </defs>
</svg>`;
}

export function initAmbient() {
  const layer = document.getElementById("ambient-layer");
  if (!layer || layer.dataset.ready) return;
  layer.dataset.ready = "1";

  for (let i = 1; i <= 3; i++) {
    const orb = document.createElement("div");
    orb.className = `ambient-orb ambient-orb-${i}`;
    layer.appendChild(orb);
  }

  for (let i = 1; i <= 6; i++) {
    const b = document.createElement("div");
    b.className = `ambient-butterfly butterfly-${i}`;
    b.innerHTML = butterflySvg(i);
    layer.appendChild(b);
  }

  for (let i = 1; i <= 8; i++) {
    const f = document.createElement("div");
    f.className = `ambient-flower flower-${i}`;
    f.textContent = FLOWERS[(i - 1) % FLOWERS.length];
    layer.appendChild(f);
  }

  for (let i = 1; i <= 5; i++) {
    const p = document.createElement("div");
    p.className = `ambient-petal petal-${i}`;
    layer.appendChild(p);
  }

  for (let i = 1; i <= 6; i++) {
    const s = document.createElement("div");
    s.className = `ambient-sparkle sparkle-${i}`;
    layer.appendChild(s);
  }

  // Books — roam like butterflies
  for (let i = 1; i <= 5; i++) {
    const book = document.createElement("div");
    book.className = `ambient-roamer ambient-book book-${i}`;
    book.innerHTML = `<span class="roamer-inner">${BOOKS[(i - 1) % BOOKS.length]}</span>`;
    book.setAttribute("aria-hidden", "true");
    layer.appendChild(book);
  }

  // Laptops — roam like butterflies
  for (let i = 1; i <= 4; i++) {
    const laptop = document.createElement("div");
    laptop.className = `ambient-roamer ambient-laptop laptop-${i}`;
    laptop.innerHTML = `<span class="roamer-inner">${LAPTOPS[(i - 1) % LAPTOPS.length]}</span>`;
    laptop.setAttribute("aria-hidden", "true");
    layer.appendChild(laptop);
  }

  // Maths equations — drifting across screen
  for (let i = 1; i <= 10; i++) {
    const eq = document.createElement("div");
    eq.className = `ambient-math math-${i}`;
    eq.textContent = MATH_EQUATIONS[(i - 1) % MATH_EQUATIONS.length];
    eq.setAttribute("aria-hidden", "true");
    layer.appendChild(eq);
  }
}
