import { z } from 'zod';
export const videoSchema = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  title: z.string().max(500),
  channel: z.string().max(300),
  channelId: z.string().max(100),
  thumbnail: z
    .string()
    .max(1000)
    .refine((s) => s.startsWith('/demo/') || /^https:\/\/i\d?\.ytimg\.com\//.test(s)),
  description: z.string().max(15000),
  publishedAt: z.string().max(40),
  duration: z.number().nonnegative().max(1e8),
  views: z.number().nonnegative(),
  tags: z.array(z.string().max(500)).max(100),
  demo: z.boolean().optional(),
});
export type Video = z.infer<typeof videoSchema>;
export const settingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  scale: z.number().min(0.8).max(1.3),
  volume: z.number().min(0).max(100),
  autoplay: z.boolean(),
  speed: z.number().min(0.25).max(2),
  historyEnabled: z.boolean(),
  searchHistoryEnabled: z.boolean(),
  filtering: z.boolean(),
  advancedFiltering: z.boolean(),
  demo: z.boolean(),
  repository: z
    .string()
    .max(150)
    .regex(/^$|^[\w.-]+\/[\w.-]+$/),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  theme: 'dark',
  scale: 1,
  volume: 70,
  autoplay: false,
  speed: 1,
  historyEnabled: true,
  searchHistoryEnabled: true,
  filtering: true,
  advancedFiltering: false,
  demo: true,
  repository: '',
};
export const ruleSchema = z
  .object({
    id: z.string().min(1).max(80),
    action: z.enum(['block', 'allow']),
    kind: z.enum(['text', 'domain', 'pattern', 'cosmetic']),
    value: z.string().trim().min(1).max(200),
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.kind === 'domain' && !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(r.value))
      ctx.addIssue({ code: 'custom', message: 'Use a domain such as example.com.' });
    if (
      r.kind === 'cosmetic' &&
      !/^\[data-promotion="(sponsored|banner|affiliate|advertisement|overlay)"\]$/.test(r.value)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Cosmetic rules may only target app-owned data-promotion categories.',
      });
  });
export type FilterRule = z.infer<typeof ruleSchema>;
export const rulesSchema = z
  .array(ruleSchema)
  .max(500)
  .refine((r) => new Set(r.map((x) => x.id)).size === r.length, 'Rule IDs must be unique.');
export const searchSchema = z.object({
  q: z.string().trim().max(200),
  type: z.enum(['video', 'channel', 'playlist']),
  date: z.enum(['any', 'today', 'week', 'month', 'year']),
  duration: z.enum(['any', 'short', 'medium', 'long']),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating', 'title']),
  pageToken: z.string().max(500).optional(),
  topic: z.string().max(60).optional(),
});
export type SearchInput = z.infer<typeof searchSchema>;
export interface SearchEntity {
  id: string;
  type: 'channel' | 'playlist';
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
}
export interface SearchResult {
  videos: Video[];
  entities: SearchEntity[];
  nextPageToken?: string;
  demo: boolean;
}
export interface LibraryItem extends Video {
  position: number;
  watched: boolean;
  addedAt: string;
  lastWatched?: string;
}
export interface Playlist {
  id: number;
  name: string;
  count: number;
  createdAt: string;
}
export interface Snapshot {
  settings: Settings;
  history: LibraryItem[];
  watchLater: LibraryItem[];
  playlists: Playlist[];
  searches: string[];
  hidden: string[];
  rules: FilterRule[];
  hasApiKey: boolean;
  version: string;
  recovery?: string;
}
const id = z.string().regex(/^[\w-]{11}$/);
const playlistId = z.number().int().positive();
export const requestSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('snapshot') }),
  z.object({ op: z.literal('search'), input: searchSchema }),
  z.object({ op: z.literal('video'), id }),
  z.object({ op: z.literal('settings'), patch: settingsSchema.partial().strict() }),
  z.object({
    op: z.literal('apiKey'),
    key: z
      .string()
      .trim()
      .max(200)
      .regex(/^[\w-]*$/),
  }),
  z.object({ op: z.literal('history'), video: videoSchema, position: z.number().min(0).max(1e8) }),
  z.object({ op: z.literal('watchLater'), video: videoSchema }),
  z.object({
    op: z.literal('remove'),
    list: z.enum(['history', 'watchLater', 'playlist']),
    id,
    playlistId: playlistId.optional(),
  }),
  z.object({ op: z.literal('watched'), id, value: z.boolean() }),
  z.object({
    op: z.literal('reorder'),
    list: z.enum(['watchLater', 'playlist']),
    ids: z.array(id).max(10000),
    playlistId: playlistId.optional(),
  }),
  z.object({ op: z.literal('playlistCreate'), name: z.string().trim().min(1).max(80) }),
  z.object({
    op: z.literal('playlistRename'),
    id: playlistId,
    name: z.string().trim().min(1).max(80),
  }),
  z.object({ op: z.literal('playlistDelete'), id: playlistId }),
  z.object({ op: z.literal('playlistItems'), id: playlistId }),
  z.object({ op: z.literal('playlistAdd'), id: playlistId, video: videoSchema }),
  z.object({ op: z.literal('hide'), id }),
  z.object({
    op: z.literal('clear'),
    target: z.enum(['history', 'searches', 'watchLater', 'hidden', 'all']),
  }),
  z.object({ op: z.literal('rules'), rules: rulesSchema }),
  z.object({ op: z.literal('external'), url: z.string().url().max(2000) }),
  z.object({ op: z.literal('copy'), id }),
  z.object({ op: z.literal('updates') }),
]);
export type Request = z.infer<typeof requestSchema>;
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };
export interface Bridge {
  request<T = unknown>(request: Request): Promise<Reply<T>>;
}
declare global {
  interface Window {
    luma: Bridge;
    onYouTubeIframeAPIReady?: () => void;
  }
}
export const youtubeUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export type Page =
  | 'Home'
  | 'Explore'
  | 'Search'
  | 'History'
  | 'Watch Later'
  | 'Playlists'
  | 'Downloads'
  | 'Settings';
