import { describe, expect, it, vi } from 'vitest';
import {
  apiError,
  decodeText,
  durationSeconds,
  parseVideos,
  YouTubeClient,
} from '../electron/youtube/client';
import type { SearchInput } from '../src/shared/types';
const input: SearchInput = {
  q: 'blender',
  type: 'video',
  date: 'any',
  duration: 'any',
  order: 'relevance',
};
const sample = {
  items: [
    {
      id: 'aqz-KE-bpKQ',
      snippet: {
        title: 'A &amp; B &#39;test&#39;',
        channelTitle: 'Channel',
        channelId: 'UCabc',
        publishedAt: '2025-01-01T00:00:00Z',
        thumbnails: { high: { url: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg' } },
      },
      contentDetails: { duration: 'PT1H2M3S' },
      statistics: { viewCount: '1234' },
    },
  ],
};
describe('YouTube client', () => {
  it('parses API video metadata and durations', () => {
    expect(parseVideos(sample)[0]).toMatchObject({
      title: "A & B 'test'",
      duration: 3723,
      views: 1234,
    });
    expect(durationSeconds('P1DT2H')).toBe(93600);
    expect(durationSeconds('PT42S')).toBe(42);
    expect(durationSeconds('bad')).toBe(0);
    expect(decodeText('&#x1f30e;')).toBe('🌎');
    expect(() => parseVideos({ items: [{}] })).toThrow();
  });
  it('uses supported filters, hydrates video details and caches identical requests', async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            nextPageToken: 'next',
            items: [{ id: { videoId: 'aqz-KE-bpKQ' }, snippet: sample.items[0].snippet }],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(sample)));
    const client = new YouTubeClient('test-key', mock);
    const result = await client.search(
      { ...input, duration: 'short', date: 'week', order: 'date' },
      false,
    );
    expect(result.videos).toHaveLength(1);
    expect(result.nextPageToken).toBe('next');
    expect(String(mock.mock.calls[0][0])).toContain('videoDuration=short');
    expect(String(mock.mock.calls[0][0])).toContain('publishedAfter=');
    await client.search({ ...input, duration: 'short', date: 'week', order: 'date' }, false);
    expect(mock.mock.calls.length).toBeLessThanOrEqual(3);
  });
  it('deduplicates concurrent identical requests and reuses cached responses', async () => {
    const mock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify(sample)));
    const client = new YouTubeClient('test-key', mock);
    await Promise.all([client.video('aqz-KE-bpKQ', false), client.video('aqz-KE-bpKQ', false)]);
    await client.video('aqz-KE-bpKQ', false);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('paginates channel search without unsupported duration parameters', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: { channelId: 'UCabc' }, snippet: sample.items[0].snippet }],
        }),
      ),
    );
    const client = new YouTubeClient('test-key', mock);
    const result = await client.search(
      { ...input, type: 'channel', duration: 'long', pageToken: 'page2' },
      false,
    );
    expect(result.entities[0]).toMatchObject({ id: 'UCabc', type: 'channel' });
    expect(String(mock.mock.calls[0][0])).toContain('pageToken=page2');
    expect(String(mock.mock.calls[0][0])).not.toContain('videoDuration');
  });
  it('supports playlist search results', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: { playlistId: 'PLabc' }, snippet: sample.items[0].snippet }],
        }),
      ),
    );
    expect(
      (await new YouTubeClient('key', mock).search({ ...input, type: 'playlist' }, false))
        .entities[0].type,
    ).toBe('playlist');
  });
  it('handles missing videos, offline connections, bad keys, quota and rate limits', async () => {
    expect(apiError(403, 'quotaExceeded')).toContain('quota');
    expect(apiError(429, '')).toContain('too many');
    expect(apiError(400, 'keyInvalid')).toContain('API key');
    const empty = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"items":[]}'));
    await expect(new YouTubeClient('key', empty).video('aqz-KE-bpKQ', false)).rejects.toThrow(
      'unavailable',
    );
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error('network'));
    await expect(new YouTubeClient('key', offline).search(input, false)).rejects.toThrow(
      'internet',
    );
    const quota = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 }),
      );
    await expect(new YouTubeClient('key', quota).search(input, false)).rejects.toThrow('quota');
    await expect(new YouTubeClient().search(input, false)).rejects.toThrow('API key');
  });
  it('provides labeled, paginated demo data without network access', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = new YouTubeClient('', mock);
    const result = await client.search({ ...input, q: '' }, true);
    expect(result.demo).toBe(true);
    expect(result.videos).toHaveLength(4);
    expect(result.videos.every((v) => v.demo)).toBe(true);
    const next = await client.search({ ...input, q: '', pageToken: result.nextPageToken }, true);
    expect(next.videos).toHaveLength(2);
    expect((await client.search({ ...input, q: 'Sintel' }, true)).videos).toHaveLength(1);
    expect(mock).not.toHaveBeenCalled();
  });
});
