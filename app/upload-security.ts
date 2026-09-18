// Only passive image formats may be served as same-origin preplan photos.
export async function isSafePhoto(file: Blob) {
  if (file.size <= 0) return false;
  const bytes = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  switch (file.type.toLowerCase()) {
    case "image/jpeg": return starts(0xff, 0xd8, 0xff);
    case "image/png": return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/gif": return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
    case "image/heic":
    case "image/heif":
    case "image/avif": {
      if (bytes.length < 16 || ascii(4, 8) !== "ftyp") return false;
      const size = new DataView(bytes.buffer).getUint32(0);
      const brands = [ascii(8, 12)];
      for (let i = 16; i + 4 <= Math.min(size, bytes.length); i += 4) brands.push(ascii(i, i + 4));
      const allowed = file.type.toLowerCase() === "image/avif" ? ["avif", "avis"] : ["heic", "heix", "hevc", "hevx", "mif1", "msf1"];
      return brands.some(brand => allowed.includes(brand));
    }
    default: return false;
  }
}
