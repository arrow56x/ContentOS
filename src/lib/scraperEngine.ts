export interface ScrapedPost {
  id: string;
  type: 'media' | 'hook' | 'script';
  platform: 'instagram' | 'facebook' | 'youtube' | 'tiktok';
  author: string;
  username: string;
  avatarUrl: string;
  likes: number;
  commentsCount: number;
  caption: string;
  timeAgo: string;
  mediaUrl: string;
  embedUrl?: string;
  sourceUrl: string;
  hookText: string;
  scriptBody: string;
  ctaText: string;
  hashtags: string[];
  comments: { username: string; text: string }[];
}

/**
 * Returns empty — all content comes from the live server scraper.
 * The niche parameter is kept so the call-site signature stays unchanged.
 */
export function scrapeNicheContent(_niche: string): ScrapedPost[] {
  return [];
}
