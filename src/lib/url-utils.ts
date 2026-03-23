/**
 * Extracts the Google Drive file ID from any supported Drive URL format.
 * Returns null for non-Drive URLs.
 */
function extractDriveId(url: string): string | null {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?&#]+)/);
  if (fileMatch) return fileMatch[1];

  const openMatch = url.match(/drive\.google\.com\/open\?(?:.*&)?id=([^&]+)/);
  if (openMatch) return openMatch[1];

  const ucMatch = url.match(/drive\.google\.com\/uc\?.*[?&]id=([^&]+)/);
  if (ucMatch) return ucMatch[1];

  const thumbMatch = url.match(/drive\.google\.com\/thumbnail\?.*[?&]id=([^&]+)/);
  if (thumbMatch) return thumbMatch[1];

  return null;
}

/**
 * Converts a Google Drive sharing/view URL to a direct-access URL
 * suitable for use in links and <iframe> elements.
 *
 * Supported input patterns:
 *   https://drive.google.com/file/d/{ID}/view?usp=...
 *   https://drive.google.com/file/d/{ID}/view
 *   https://drive.google.com/open?id={ID}
 *
 * All other URLs (YouTube, plain HTTPS, empty strings) are returned unchanged.
 */
export function sanitizeDriveUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;

  const id = extractDriveId(raw);
  if (id) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  return raw;
}

/**
 * Returns a Google Drive thumbnail URL suitable for use in <img> elements.
 * Google's thumbnail endpoint is more permissive than uc?export=view and
 * avoids the 403 hotlinking restriction.
 *
 * Falls back to the original URL for non-Drive URLs.
 */
export function driveImageSrc(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;

  const id = extractDriveId(raw);
  if (id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
  }

  return raw;
}

/**
 * Returns a URL pointing to the local /api/drive-image proxy route.
 * Use this when Drive files are private — the proxy fetches them server-side
 * using service account credentials, avoiding 403 hotlinking errors.
 *
 * Falls back to the original URL for non-Drive URLs.
 */
export function driveProxyUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;

  const id = extractDriveId(raw);
  if (id) {
    return `/api/drive-image?id=${id}`;
  }

  return raw;
}
