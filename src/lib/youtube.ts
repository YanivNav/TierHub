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
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}
