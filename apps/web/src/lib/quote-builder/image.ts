// Board photos are downscaled before they are stored: localStorage holds a
// few megabytes in total, and a phone photo alone can be larger than that.
// The average colour becomes the board's swatch, which is what the 3D model
// is painted with.
const MAX_EDGE = 320;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

export async function readBoardImage(file: File): Promise<{ dataUrl: string; swatch: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPG, PNG or WebP).");
  }
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const sample = document.createElement("canvas");
  sample.width = 16;
  sample.height = 16;
  const sctx = sample.getContext("2d");
  let swatch = "#D4C9B5";
  if (sctx) {
    sctx.drawImage(canvas, 0, 0, 16, 16);
    const { data } = sctx.getImageData(0, 0, 16, 16);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const count = data.length / 4;
    swatch = `#${hex(r / count)}${hex(g / count)}${hex(b / count)}`.toUpperCase();
  }

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.78), swatch };
}
