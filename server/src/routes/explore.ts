import { Router } from 'express';

export type ExplorePlatform = 'instagram' | 'facebook' | 'youtube' | 'tiktok';
export type ExplorePostType = 'media' | 'hook' | 'script';

export interface ExplorePost {
  id: string;
  type: ExplorePostType;
  platform: ExplorePlatform;
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

interface DiscoveredItem {
  platform: ExplorePlatform;
  url: string;
  title: string;
  snippet: string;
  thumbnail?: string;
  embedUrl?: string;
}

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_ITEMS = 24;
const MIN_ITEMS = 15;

export const exploreRouter = Router();

exploreRouter.get('/', async (req, res) => {
  const niche = typeof req.query.niche === 'string' ? req.query.niche.trim() : '';
  const targetNiche = niche || 'business';

  try {
    const items = await discoverSocialContent(targetNiche);
    const posts = buildExplorePosts(targetNiche, items).slice(0, MAX_ITEMS);

    res.json({
      niche: targetNiche,
      live: posts.length > 0,
      generatedAt: Date.now(),
      posts,
      message:
        posts.length > 0
          ? `Found ${posts.length} public social embeds for "${targetNiche}".`
          : 'No public embeddable social results were found for this niche right now.',
    });
  } catch (err) {
    console.error('[explore] discovery error:', err);
    res.status(502).json({
      niche: targetNiche,
      live: false,
      generatedAt: Date.now(),
      posts: [],
      message: 'Live social discovery failed. Try again in a few minutes.',
    });
  }
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

async function discoverSocialContent(niche: string): Promise<DiscoveredItem[]> {
  const [socialLinks, youtubeResults] = await Promise.all([
    discoverSocialLinks(niche),
    discoverYouTubeShorts(niche),
  ]);

  const candidates = [
    ...prioritizeByPlatform(socialLinks),
    ...youtubeResults,
  ];

  const byKey = new Map<string, DiscoveredItem>();
  for (const item of candidates) {
    const cleanUrl = normalizeSocialUrl(item.url);
    if (!cleanUrl) continue;

    const platform = detectPlatform(cleanUrl);
    if (!platform) continue;

    const embedUrl = item.embedUrl ?? toEmbedUrl(platform, cleanUrl);
    const key = `${platform}:${cleanUrl}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...item,
        platform,
        url: cleanUrl,
        embedUrl,
        thumbnail: item.thumbnail ?? thumbnailFromUrl(platform, cleanUrl),
      });
    }
  }

  const results = [...byKey.values()].filter((item) => item.embedUrl || item.thumbnail);

  // If we don't have enough, run additional YouTube queries to pad up to MIN_ITEMS
  if (results.length < MIN_ITEMS) {
    const extra = await discoverYouTubeShortsExtra(niche, results.length);
    for (const item of extra) {
      const key = `${item.platform}:${item.url}`;
      if (!byKey.has(key)) {
        byKey.set(key, item);
        results.push(item);
      }
      if (results.length >= MIN_ITEMS) break;
    }
  }

  return results;
}

async function discoverSocialLinks(niche: string): Promise<DiscoveredItem[]> {
  const queries = buildDiscoveryQueries(niche);

  const pages = await Promise.all(
    queries.flatMap((q) => [
      fetchText(`https://www.google.com/search?q=${encodeURIComponent(q)}`),
      fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}`),
      fetchText(`https://search.yahoo.com/search?p=${encodeURIComponent(q)}`),
    ])
  );

  const items: DiscoveredItem[] = [];
  for (const html of pages) {
    if (!html) continue;

    const title = readHtmlTitle(html);
    const snippet = readSearchSnippet(html);
    const urls = extractSocialUrls(html);

    for (const url of urls) {
      const platform = detectPlatform(url);
      if (!platform) continue;
      items.push({
        platform,
        url,
        title: title || titleFromUrl(url),
        snippet: snippet || `Public ${platform} result for ${niche}.`,
      });
    }
  }

  return items;
}

/**
 * Build search queries dynamically from whatever niche string the user set.
 * No hardcoded niche names — every query is derived from the niche term itself.
 */
function buildDiscoveryQueries(niche: string): string[] {
  const n = niche.trim();

  return [
    // Instagram reels
    `"${n}" Instagram reel viral`,
    `${n} tips Instagram reel`,
    `${n} creator Instagram reel 2024`,
    `site:instagram.com/reel "${n}"`,
    `site:instagram.com/reel ${n} tips`,

    // Facebook reels
    `"${n}" Facebook reel viral`,
    `${n} advice Facebook reel`,
    `site:facebook.com/reel "${n}"`,

    // YouTube Shorts
    `"${n}" YouTube Shorts viral`,
    `${n} tips YouTube Shorts`,
    `site:youtube.com/shorts "${n}"`,
    `site:youtube.com/shorts ${n} tips`,
  ];
}

async function discoverYouTubeShorts(niche: string): Promise<DiscoveredItem[]> {
  const n = niche.trim();
  // Run 3 parallel YouTube Shorts queries to maximise result count
  const queries = [
    `${n} tips shorts`,
    `${n} viral shorts`,
    `${n} tutorial shorts`,
  ];

  const pages = await Promise.all(
    queries.map((q) =>
      fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIYAQ%253D%253D`)
    )
  );

  const seenIds = new Set<string>();
  const items: DiscoveredItem[] = [];

  for (const html of pages) {
    if (!html) continue;
    const ids = [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]);
    const titlesById = readYouTubeTitles(html);

    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      items.push({
        platform: 'youtube' as const,
        url: `https://www.youtube.com/shorts/${id}`,
        title: titlesById.get(id) ?? `${n} short`,
        snippet: `YouTube Short about ${n}.`,
        thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${id}`,
      });
    }
  }

  return items.slice(0, 16);
}

/** Extra YouTube Shorts queries used when primary discovery doesn't reach MIN_ITEMS. */
async function discoverYouTubeShortsExtra(niche: string, alreadyHave: number): Promise<DiscoveredItem[]> {
  const n = niche.trim();
  const needed = MIN_ITEMS - alreadyHave;
  if (needed <= 0) return [];

  const extraQueries = [
    `${n} beginner shorts`,
    `best ${n} shorts`,
    `${n} how to shorts`,
    `${n} motivation shorts`,
  ];

  const pages = await Promise.all(
    extraQueries.map((q) =>
      fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIYAQ%253D%253D`)
    )
  );

  const seenIds = new Set<string>();
  const items: DiscoveredItem[] = [];

  for (const html of pages) {
    if (!html) continue;
    const ids = [...html.matchAll(/"videoId":"([\w-]{11})"/g)].map((m) => m[1]);
    const titlesById = readYouTubeTitles(html);

    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      items.push({
        platform: 'youtube' as const,
        url: `https://www.youtube.com/shorts/${id}`,
        title: titlesById.get(id) ?? `${n} short`,
        snippet: `YouTube Short about ${n}.`,
        thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
        embedUrl: `https://www.youtube.com/embed/${id}`,
      });
      if (items.length >= needed + 5) break; // fetch a few extra for dedup safety
    }
    if (items.length >= needed + 5) break;
  }

  return items;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function prioritizeByPlatform(items: DiscoveredItem[]): DiscoveredItem[] {
  const order: Record<ExplorePlatform, number> = { instagram: 0, facebook: 1, tiktok: 2, youtube: 3 };
  return [...items].sort((a, b) => order[a.platform] - order[b.platform]);
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
      },
    });

    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function extractSocialUrls(html: string): string[] {
  const decoded = decodeHtml(html);
  const directUrls = [
    ...decoded.matchAll(
      /https?:\/\/(?:www\.|m\.)?(?:instagram\.com|facebook\.com|fb\.watch|tiktok\.com)\/[^"'<>\\\s)]+/gi
    ),
  ].map((m) => m[0]);

  const redirectUrls = [
    ...decoded.matchAll(/[?&](?:q|u|url|ru)=([^"'&<>]+)/gi),
  ]
    .map((m) => safeDecode(m[1]))
    .filter((u) => /https?:\/\/(?:www\.|m\.)?(instagram\.com|facebook\.com|fb\.watch|tiktok\.com)\//i.test(u));

  return unique([...directUrls, ...redirectUrls])
    .map(normalizeSocialUrl)
    .filter((u): u is string => Boolean(u));
}

function normalizeSocialUrl(url: string): string | null {
  try {
    let decoded = safeDecode(url);
    decoded = decoded.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

    const parsed = new URL(decoded);
    parsed.hash = '';

    if (parsed.hostname === 'm.facebook.com') parsed.hostname = 'www.facebook.com';
    if (parsed.hostname === 'm.instagram.com') parsed.hostname = 'www.instagram.com';

    if (!detectPlatform(parsed.toString())) return null;

    const keepParams = new Set(['v']);
    [...parsed.searchParams.keys()].forEach((p) => {
      if (!keepParams.has(p)) parsed.searchParams.delete(p);
    });

    return parsed.toString();
  } catch {
    return null;
  }
}

function detectPlatform(url: string): ExplorePlatform | null {
  if (/instagram\.com\/(?:reel|p|tv)\//i.test(url)) return 'instagram';
  if (/facebook\.com\/(?:watch|reel|share\/(?:r|v)|.+\/videos\/)|fb\.watch\//i.test(url)) return 'facebook';
  if (/youtube\.com\/(?:watch|shorts)|youtu\.be\//i.test(url)) return 'youtube';
  if (/tiktok\.com\/@[^/]+\/video\/\d+/i.test(url)) return 'tiktok';
  return null;
}

function toEmbedUrl(platform: ExplorePlatform, url: string): string | undefined {
  if (platform === 'instagram') {
    const match = url.match(/instagram\.com\/(reel|p|tv)\/([^/?#]+)/i);
    if (!match) return undefined;
    return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed`;
  }
  if (platform === 'facebook') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;
  }
  if (platform === 'youtube') {
    const id =
      url.match(/[?&]v=([\w-]{11})/)?.[1] ??
      url.match(/\/shorts\/([\w-]{11})/)?.[1] ??
      url.match(/youtu\.be\/([\w-]{11})/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : undefined;
  }
  if (platform === 'tiktok') {
    const id = url.match(/\/video\/(\d+)/)?.[1];
    return id ? `https://www.tiktok.com/embed/v2/${id}` : undefined;
  }
  return undefined;
}

function thumbnailFromUrl(platform: ExplorePlatform, url: string): string | undefined {
  if (platform !== 'youtube') return undefined;
  const id =
    url.match(/[?&]v=([\w-]{11})/)?.[1] ??
    url.match(/\/shorts\/([\w-]{11})/)?.[1] ??
    url.match(/youtu\.be\/([\w-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : undefined;
}

// ---------------------------------------------------------------------------
// Post building
// ---------------------------------------------------------------------------

function buildExplorePosts(niche: string, items: DiscoveredItem[]): ExplorePost[] {
  return items.map((item, idx) => {
    const title = cleanTitle(item.title) || titleFromUrl(item.url);
    const handle = handleFromUrl(item.url, item.platform);
    const seed = hashString(`${item.platform}:${item.url}`);

    return {
      id: `live-${item.platform}-${seed}-${idx}-media`,
      platform: item.platform,
      type: 'media' as const,
      author: displayAuthor(handle, item.platform),
      username: handle,
      avatarUrl: avatarFor(item.platform),
      likes: 1200 + (seed % 48_000),
      commentsCount: 24 + (seed % 900),
      caption: item.snippet || title,
      timeAgo: timeAgoFor(seed),
      mediaUrl: item.thumbnail || thumbnailFor(item.platform),
      embedUrl: item.embedUrl,
      sourceUrl: item.url,
      hookText: `Why this ${niche} post is getting attention: ${title}`,
      scriptBody: buildScript(title, niche, item.platform),
      ctaText: `Save this for your next ${niche} content sprint.`,
      hashtags: hashtagsFor(niche, item.platform),
      comments: [
        { username: 'trend_reader', text: `Strong ${item.platform} format for the ${niche} audience.` },
        { username: 'content_ops', text: 'Good hook pattern. This can be adapted into a client-safe idea.' },
      ],
    };
  });
}

function buildScript(title: string, niche: string, platform: ExplorePlatform): string {
  return `HOOK: Here's a ${platform} angle people in ${niche} are already engaging with.\n\nBODY:\n1. Open with the core problem: ${title || niche}.\n2. Show the mistake, myth, or surprising contrast behind it.\n3. Give one clear practical takeaway the viewer can use today.\n\nCTA: Save this idea, then adapt it with your own story and proof.`;
}

function hashtagsFor(niche: string, platform: ExplorePlatform): string[] {
  const clean = niche.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).slice(0, 3).join('');
  return [`#${clean || 'content'}`, `#${platform}`, '#shortformvideo', '#viralcontent'];
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

function readYouTubeTitles(html: string): Map<string, string> {
  const titles = new Map<string, string>();
  const blocks = html.split('"videoId":"').slice(1);
  for (const block of blocks) {
    const id = block.slice(0, 11);
    const titleMatch =
      block.match(/"title":\{"runs":\[\{"text":"([^"]+)"/) ??
      block.match(/"title":\{"simpleText":"([^"]+)"/);
    if (titleMatch) titles.set(id, decodeJsonText(titleMatch[1]));
  }
  return titles;
}

function readHtmlTitle(html: string): string {
  return cleanTitle(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] ?? '');
}

function readSearchSnippet(html: string): string {
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<p[^>]*>(.*?)<\/p>/is)?.[1] ??
    '';
  return stripTags(decodeHtml(meta)).slice(0, 220);
}

function cleanTitle(value: string): string {
  return stripTags(decodeHtml(value))
    .replace(/\s+-\s+(YouTube|Instagram|Facebook|TikTok|Bing|Yahoo).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length ? parts.join(' ').replace(/[-_]/g, ' ') : parsed.hostname;
  } catch {
    return 'Social media post';
  }
}

function handleFromUrl(url: string, platform: ExplorePlatform): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (platform === 'tiktok') return parts[0]?.replace(/^@/, '') || 'tiktok_creator';
    if (platform === 'facebook') return parts[0] && !['watch', 'reel'].includes(parts[0]) ? parts[0] : 'facebook_creator';
    if (platform === 'instagram') return parts[0] && !['reel', 'p', 'tv'].includes(parts[0]) ? parts[0] : 'instagram_creator';
    return 'youtube_creator';
  } catch {
    return `${platform}_creator`;
  }
}

function displayAuthor(handle: string, platform: ExplorePlatform): string {
  const readable = handle.replace(/^@/, '').replace(/[-_.]+/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()).trim();
  return readable || `${platform[0].toUpperCase()}${platform.slice(1)} Creator`;
}

function avatarFor(platform: ExplorePlatform): string {
  const colors: Record<ExplorePlatform, string> = { instagram: 'e1306c', facebook: '1877f2', youtube: 'ff0033', tiktok: '111827' };
  return `https://ui-avatars.com/api/?name=${platform}&background=${colors[platform]}&color=fff&bold=true`;
}

function thumbnailFor(platform: ExplorePlatform): string {
  const gradients: Record<ExplorePlatform, string> = { instagram: 'e1306c,fdc468', facebook: '1877f2,8ec5ff', youtube: 'ff0033,111827', tiktok: '111827,25f4ee' };
  return `https://placehold.co/900x900/${gradients[platform].split(',')[0]}/ffffff?text=${platform.toUpperCase()}`;
}

function timeAgoFor(seed: number): string {
  const values = ['1 hour ago', '3 hours ago', '8 hours ago', '1 day ago', '2 days ago'];
  return values[seed % values.length];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function decodeJsonText(value: string): string {
  try { return JSON.parse(`"${value.replace(/"/g, '\\"')}"`); } catch { return value.replace(/\\u0026/g, '&'); }
}
