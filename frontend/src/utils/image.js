const MAX_LADO = 1600; // px: suficiente para ver el detalle de una pieza y mucho más liviano que la foto original
const CALIDAD = 0.82;

/** Reduce una foto (máx. 1600 px de lado, JPEG 82 %). Si no se puede procesar, devuelve el archivo original. */
export async function comprimirImagen(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // gif/svg/heic: se sube tal cual
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size <= 800 * 1024) {
      bitmap.close?.();
      return file; // ya es pequeña
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG con transparencia -> fondo blanco al pasar a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', CALIDAD));
    if (!blob || blob.size >= file.size) return file;
    const nombre = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
