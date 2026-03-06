/**
 * Converts a Google Drive sharing/view URL to a direct-access URL
 * suitable for use in <img> and <iframe> elements.
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

  // Pattern: /file/d/{ID}/...
  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/?&#]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }

  // Pattern: /open?id={ID}
  const openMatch = raw.match(/drive\.google\.com\/open\?(?:.*&)?id=([^&]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }

  return raw;
}
