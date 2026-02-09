/** Capture video frame as base64 JPEG for backend API */
export function captureFrameAsBase64(video: HTMLVideoElement, quality = 0.9): string | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? null;
}

/** Crop face region จาก video ตาม box แล้ว return base64 (min 224px สำหรับ DeepFace) */
export function captureFaceCropAsBase64(
  video: HTMLVideoElement,
  box: { x: number; y: number; width: number; height: number },
  padding = 0.35,
  quality = 0.92,
  minSize = 224
): string | null {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
  const padX = box.width * padding;
  const padY = box.height * padding;
  let x = Math.max(0, box.x - padX);
  let y = Math.max(0, box.y - padY);
  let w = Math.min(video.videoWidth - x, box.width + padX * 2);
  let h = Math.min(video.videoHeight - y, box.height + padY * 2);
  if (w < 10 || h < 10) return null;
  const scale = Math.max(1, minSize / Math.min(w, h));
  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, x, y, w, h, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? null;
}
