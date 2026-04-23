// Parses the imageUrl field which can be:
//   - plain string  → just the main image
//   - JSON { main: string, kitImages: string[] }
export function parseProductImages(imageUrl: string | null | undefined): {
  main: string | null;
  kitImages: string[];
} {
  if (!imageUrl) return { main: null, kitImages: [] };
  try {
    const parsed = JSON.parse(imageUrl);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        main: parsed.main ?? null,
        kitImages: Array.isArray(parsed.kitImages) ? parsed.kitImages.filter(Boolean) : [],
      };
    }
  } catch {}
  return { main: imageUrl, kitImages: [] };
}
