/**
 * Extracts the YouTube video ID from any common YouTube URL format.
 * Returns null if the URL is not a recognisable YouTube URL.
 */
export function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("?")[0] ?? null;
    }
    if (u.hostname === "youtube.com" || u.hostname === "www.youtube.com") {
      // youtube.com/watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return v;
      // youtube.com/embed/<id>  |  /shorts/<id>  |  /v/<id>
      const match = u.pathname.match(/^\/(embed|shorts|v)\/([^/?]+)/);
      if (match?.[2]) return match[2];
    }
    return null;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnail(videoId: string): string {
  // i.ytimg.com serves the same thumbnails as img.youtube.com but from a
  // cookieless domain, so requests don't carry the visitor's Google cookies.
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

/**
 * Older versions of the app persisted img.youtube.com thumbnail URLs, which
 * carry the visitor's Google cookies. Rewrite them to the cookieless host.
 */
export function toCookielessThumbnailUrl(url: string): string {
  return url.replace(/^https:\/\/img\.youtube\.com\//, "https://i.ytimg.com/");
}
