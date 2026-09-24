import { z } from 'zod';
import { demoVideos } from '../../src/shared/demo';
import type { Video, SearchInput, SearchResult, SearchEntity } from '../../src/shared/types';
const snippet = z.object({
  title: z.string(),
  description: z.string().default(''),
  channelTitle: z.string().default(''),
  channelId: z.string().default(''),
  publishedAt: z.string().default(''),
  tags: z.array(z.string()).default([]),
  thumbnails: z.record(z.object({ url: z.string() })).default({}),
});
const videoItem = z.object({
  id: z.string(),
  snippet,
  contentDetails: z.object({ duration: z.string() }).optional(),
  statistics: z.object({ viewCount: z.string().optional() }).optional(),
});
export const decodeText = (s: string) =>
  s.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt);/gi, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (named[entity]) return named[entity];
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
export function durationSeconds(duration: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration);
  return m
    ? Number(m[1] ?? 0) * 86400 +
        Number(m[2] ?? 0) * 3600 +
        Number(m[3] ?? 0) * 60 +
        Number(m[4] ?? 0)
    : 0;
}
function thumbnail(s: z.infer<typeof snippet>): string {
  const url =
    (s.thumbnails.maxres ?? s.thumbnails.high ?? s.thumbnails.medium ?? s.thumbnails.default)
      ?.url ?? '';
  return /^https:\/\/i\d?\.ytimg\.com\//.test(url) ? url : '';
}
export function parseVideos(data: unknown): Video[] {
  return z
    .object({ items: z.array(videoItem) })
    .parse(data)
    .items.map((item) => ({
      id: item.id,
      title: decodeText(item.snippet.title),
      channel: decodeText(item.snippet.channelTitle),
      channelId: item.snippet.channelId,
      description: decodeText(item.snippet.description),
      thumbnail: thumbnail(item.snippet) || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt,
      duration: durationSeconds(item.contentDetails?.duration ?? ''),
      views: Number(item.statistics?.viewCount ?? 0),
      tags: item.snippet.tags,
    }));
}
export class YouTubeError extends Error {}
export function apiError(status: number, reason: string): string {
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')
    return 'YouTube API quota has been reached. Try again after your quota resets, use Demo Mode, or review your Google Cloud quota.';
  if (status === 429 || reason === 'rateLimitExceeded')
    return 'YouTube is receiving too many requests. Wait a minute before trying again.';
  if (
    status === 400 ||
    reason === 'keyInvalid' ||
    reason === 'accessNotConfigured' ||
    status === 401 ||
    status === 403
  )
    return 'YouTube could not authorize this request. Check your API key, enable YouTube Data API v3, and review the key restrictions in Google Cloud.';
  if (status === 404) return 'This video is unavailable. It may be private or deleted.';
  return 'YouTube is temporarily unavailable. Please try again later.';
}
export class YouTubeClient {
  private cache = new Map<string, { expires: number; data: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  private key = '';
  constructor(
    key = '',
    private fetcher: typeof fetch = fetch,
  ) {
    this.key = key;
  }
  setKey(key: string) {
    this.key = key;
    this.cache.clear();
    this.pending.clear();
  }
  get hasKey() {
    return Boolean(this.key);
  }
  private async get(endpoint: string, params: Record<string, string>): Promise<unknown> {
    if (!this.key)
      throw new YouTubeError('Add a YouTube Data API key in Settings, or turn on Demo Mode.');
    const cacheKey = endpoint + JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;
    const pending = this.pending.get(cacheKey);
    if (pending) return pending;
    const task = (async () => {
      let response: Response;
      try {
        response = await this.fetcher(
          `https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key: this.key })}`,
          { signal: AbortSignal.timeout(15000) },
        );
      } catch {
        throw new YouTubeError(
          'Could not reach YouTube. Check your internet connection and try again. Your local library is still available.',
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new YouTubeError('YouTube returned an unreadable response. Please try again.');
      }
      if (!response.ok) {
        const err = z
          .object({
            error: z
              .object({ errors: z.array(z.object({ reason: z.string() })).optional() })
              .optional(),
          })
          .safeParse(body);
        throw new YouTubeError(
          apiError(response.status, err.success ? (err.data.error?.errors?.[0]?.reason ?? '') : ''),
        );
      }
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(cacheKey, { data: body, expires: Date.now() + 10 * 60 * 1000 });
      return body;
    })();
    this.pending.set(cacheKey, task);
    try {
      return await task;
    } finally {
      this.pending.delete(cacheKey);
    }
  }
  async video(id: string, demo: boolean): Promise<Video> {
    if (demo) {
      const found = demoVideos.find((v) => v.id === id);
      if (found) return found;
    }
    const videos = parseVideos(
      await this.get('videos', { part: 'snippet,contentDetails,statistics', id }),
    );
    if (!videos.length)
      throw new YouTubeError(
        'This video is unavailable. It may have been deleted, made private, or restricted.',
      );
    return videos[0];
  }
  async search(input: SearchInput, demo: boolean): Promise<SearchResult> {
    if (demo) {
      let videos = demoVideos.filter((v) =>
        `${v.title} ${v.channel} ${v.tags.join(' ')}`
          .toLowerCase()
          .includes((input.q || input.topic || '').toLowerCase()),
      );
      if (input.duration !== 'any')
        videos = videos.filter((v) =>
          input.duration === 'short'
            ? v.duration < 240
            : input.duration === 'medium'
              ? v.duration >= 240 && v.duration <= 1200
              : v.duration > 1200,
        );
      if (input.date !== 'any') {
        const days = { today: 1, week: 7, month: 30, year: 365 }[input.date];
        videos = videos.filter((v) => Date.parse(v.publishedAt) > Date.now() - days * 86400000);
      }
      if (input.order === 'date') videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      if (input.order === 'viewCount') videos.sort((a, b) => b.views - a.views);
      if (input.order === 'title') videos.sort((a, b) => a.title.localeCompare(b.title));
      if (input.type !== 'video') return { videos: [], entities: [], demo: true };
      const offset = Number(input.pageToken ?? 0) || 0;
      return {
        videos: videos.slice(offset, offset + 4),
        entities: [],
        nextPageToken: offset + 4 < videos.length ? String(offset + 4) : undefined,
        demo: true,
      };
    }
    if (
      !input.q &&
      !input.topic &&
      input.type === 'video' &&
      input.date === 'any' &&
      input.duration === 'any' &&
      input.order === 'relevance'
    ) {
      const data = await this.get('videos', {
        part: 'snippet,contentDetails,statistics',
        chart: 'mostPopular',
        maxResults: '24',
        ...(input.pageToken ? { pageToken: input.pageToken } : {}),
      });
      return {
        videos: parseVideos(data),
        entities: [],
        nextPageToken: z.object({ nextPageToken: z.string().optional() }).parse(data).nextPageToken,
        demo: false,
      };
    }
    const params: Record<string, string> = {
      part: 'snippet',
      q: input.q || input.topic || '',
      type: input.type,
      order: input.order,
      maxResults: '24',
    };
    if (input.pageToken) params.pageToken = input.pageToken;
    if (input.type === 'video' && input.duration !== 'any') params.videoDuration = input.duration;
    if (input.date !== 'any')
      params.publishedAfter = new Date(
        Math.floor(Date.now() / 86400000) * 86400000 -
          { today: 0, week: 7, month: 30, year: 365 }[input.date] * 86400000,
      ).toISOString();
    const data = z
      .object({
        nextPageToken: z.string().optional(),
        items: z.array(
          z.object({
            id: z.object({
              videoId: z.string().optional(),
              channelId: z.string().optional(),
              playlistId: z.string().optional(),
            }),
            snippet,
          }),
        ),
      })
      .parse(await this.get('search', params));
    if (input.type === 'video') {
      const ids = data.items.flatMap((x) => (x.id.videoId ? [x.id.videoId] : []));
      const videos = ids.length
        ? parseVideos(
            await this.get('videos', {
              part: 'snippet,contentDetails,statistics',
              id: ids.join(','),
            }),
          )
        : [];
      return { videos, entities: [], nextPageToken: data.nextPageToken, demo: false };
    }
    const entities: SearchEntity[] = data.items
      .map((x) => ({
        id: (input.type === 'channel' ? x.id.channelId : x.id.playlistId) ?? '',
        type: input.type as 'channel' | 'playlist',
        title: decodeText(x.snippet.title),
        channel: decodeText(x.snippet.channelTitle),
        description: decodeText(x.snippet.description),
        thumbnail: thumbnail(x.snippet),
      }))
      .filter((x) => x.id);
    return { videos: [], entities, nextPageToken: data.nextPageToken, demo: false };
  }
}
