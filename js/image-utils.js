const MAX_SIZE = 1200;
const JPEG_QUALITY = 0.88;
const BG_COLOR = "#ffffff";

/**
 * Resize, flatten onto white background, and compress listing photos.
 */
export function processListingImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose a valid image file."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > MAX_SIZE || h > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("Could not read image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not load file."));
    reader.readAsDataURL(file);
  });
}

export function listingImageHtml(image, alt, emoji) {
  if (image) {
    return `<div class="product-photo"><img src="${image}" alt="${alt}" loading="lazy" /></div>`;
  }
  return `<div class="product-photo product-photo-emoji">${emoji}</div>`;
}
