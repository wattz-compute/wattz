// Extract and validate an 11-char YouTube video ID.
// Accepts a raw ID, a share URL, or an embed URL. Returns null for anything invalid.
// This is used by BackgroundMusic to defend against "Invalid video id" IFrame throws.

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input: string | undefined | null): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  if (YT_ID.test(raw)) return raw;

  try {
    const url = new URL(raw);
    // youtu.be/<id>
    if (url.hostname.endsWith('youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0];
      return YT_ID.test(id) ? id : null;
    }
    if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
      const v = url.searchParams.get('v');
      if (v && YT_ID.test(v)) return v;
      // /embed/<id>
      const parts = url.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1] && YT_ID.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1];
      }
      // /shorts/<id>
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx >= 0 && parts[shortsIdx + 1] && YT_ID.test(parts[shortsIdx + 1])) {
        return parts[shortsIdx + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}
