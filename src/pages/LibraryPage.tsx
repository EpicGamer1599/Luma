import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock3,
  Play,
  Plus,
  Search,
  Trash2,
  ListVideo,
  Pencil,
} from 'lucide-react';
import { api } from '../hooks/api';
import type { LibraryItem, Snapshot, Video } from '../shared/types';
import { VideoCard, type VideoAction } from '../components/VideoCard';
import { EmptyState } from '../components/VideoGrid';
export function LibraryPage({
  mode,
  snapshot,
  playlistId,
  items,
  onPlaylist,
  onAction,
  onCreate,
  onRename,
  onDelete,
  onConfirm,
  onRefresh,
  onError,
  onQueue,
}: {
  mode: 'History' | 'Watch Later' | 'Playlists';
  snapshot: Snapshot;
  playlistId?: number;
  items: LibraryItem[];
  onPlaylist: (id?: number) => void;
  onAction: (a: VideoAction, v: Video) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
  onConfirm: (title: string, action: () => Promise<void>) => void;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
  onQueue: (v: Video[]) => void;
}) {
  const [query, setQuery] = useState(''),
    [sort, setSort] = useState('manual');
  const playlist = snapshot.playlists.find((p) => p.id === playlistId);
  const source =
    mode === 'History' ? snapshot.history : mode === 'Watch Later' ? snapshot.watchLater : items;
  const filtered = source.filter((v) =>
    `${v.title} ${v.channel}`.toLowerCase().includes(query.toLowerCase()),
  );
  const shown =
    sort === 'title'
      ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
      : sort === 'newest'
        ? [...filtered].sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        : sort === 'unwatched'
          ? [...filtered].sort((a, b) => Number(a.watched) - Number(b.watched))
          : filtered;
  const run = (action: () => Promise<unknown>) =>
    void action()
      .then(onRefresh)
      .catch((e) => onError(e.message));
  async function reorder(id: string, direction: number) {
    const ids = source.map((v) => v.id),
      index = ids.indexOf(id),
      next = index + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await api({
      op: 'reorder',
      list: mode === 'Watch Later' ? 'watchLater' : 'playlist',
      ids,
      playlistId,
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL COLLECTION</span>
          <h1>{playlist?.name ?? mode}</h1>
          <p>
            {mode === 'History'
              ? 'Pick up where you left off. Your viewing history stays on this device.'
              : mode === 'Watch Later'
                ? 'Good things are worth saving. Make time for your next favorite.'
                : 'Organize your interests into collections. Saved only on this device.'}
          </p>
        </div>
        {mode === 'Playlists' && !playlist ? (
          <button className="primary" onClick={onCreate}>
            <Plus size={16} /> New playlist
          </button>
        ) : (
          <div className="button-row">
            {playlist && (
              <>
                <button onClick={() => onPlaylist(undefined)}>All playlists</button>
                <button aria-label="Rename playlist" onClick={onRename}>
                  <Pencil size={16} />
                </button>
                <button aria-label="Delete playlist" onClick={onDelete}>
                  <Trash2 size={16} />
                </button>
              </>
            )}
            {source.length > 0 && (
              <button onClick={() => onQueue(shown)}>
                <Play size={16} /> Play all
              </button>
            )}
          </div>
        )}
      </div>
      {mode === 'Playlists' && !playlist ? (
        <>
          {snapshot.playlists.length ? (
            <div className="playlist-grid">
              {snapshot.playlists.map((p, i) => (
                <button className="playlist-card" key={p.id} onClick={() => onPlaylist(p.id)}>
                  <div className={`playlist-art color-${i % 3}`}>
                    <ListVideo size={46} />
                    <span>LOCAL PLAYLIST</span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.count} {p.count === 1 ? 'video' : 'videos'}
                    <span>Open collection →</span>
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="A collection of your own"
              description="Create a playlist for late-night discoveries, new skills, or anything you love."
              action="Create your first playlist"
              onAction={onCreate}
            />
          )}
        </>
      ) : (
        <>
          <div className="library-toolbar">
            <label className="input-with-icon">
              <Search size={16} />
              <input
                aria-label={`Search ${mode}`}
                placeholder="Search this collection…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span>
              {shown.length} {shown.length === 1 ? 'video' : 'videos'}
            </span>
            <select
              aria-label="Library sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="manual">
                {mode === 'History' ? 'Recently watched' : 'Custom order'}
              </option>
              <option value="newest">Newest added</option>
              <option value="title">Title A–Z</option>
              {mode === 'Watch Later' && <option value="unwatched">Unwatched first</option>}
            </select>
            {mode !== 'Playlists' && source.length > 0 && (
              <button
                className="text-button danger"
                onClick={() =>
                  onConfirm(`Clear ${mode}?`, async () => {
                    await api({
                      op: 'clear',
                      target: mode === 'History' ? 'history' : 'watchLater',
                    });
                    await onRefresh();
                  })
                }
              >
                <Trash2 size={15} /> Clear all
              </button>
            )}
          </div>
          {!snapshot.settings.historyEnabled && mode === 'History' && (
            <div className="notice">History is paused. You can turn it back on in Settings.</div>
          )}
          {shown.length ? (
            <div className="video-grid">
              {shown.map((v) => (
                <div key={v.id}>
                  <VideoCard
                    video={v}
                    onAction={onAction}
                    position={mode === 'History' ? v.position : 0}
                    saved={snapshot.watchLater.some((x) => x.id === v.id)}
                  />
                  <div className="library-actions">
                    {mode === 'History' ? (
                      <span>
                        <Clock3 size={13} /> {v.position > 0 ? 'Continue watching' : 'Watched'}
                      </span>
                    ) : (
                      <>
                        <button
                          aria-label={`Move ${v.title} up`}
                          disabled={sort !== 'manual' || Boolean(query) || source[0]?.id === v.id}
                          onClick={() => run(() => reorder(v.id, -1))}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          aria-label={`Move ${v.title} down`}
                          disabled={
                            sort !== 'manual' || Boolean(query) || source.at(-1)?.id === v.id
                          }
                          onClick={() => run(() => reorder(v.id, 1))}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </>
                    )}
                    {mode === 'Watch Later' && (
                      <button
                        className={v.watched ? 'watched' : ''}
                        onClick={() =>
                          run(() => api({ op: 'watched', id: v.id, value: !v.watched }))
                        }
                      >
                        <Check size={14} />
                        {v.watched ? 'Watched' : 'Mark watched'}
                      </button>
                    )}
                    <button
                      className="remove"
                      aria-label={`Remove ${v.title}`}
                      onClick={() =>
                        run(() =>
                          api({
                            op: 'remove',
                            list:
                              mode === 'History'
                                ? 'history'
                                : mode === 'Watch Later'
                                  ? 'watchLater'
                                  : 'playlist',
                            id: v.id,
                            playlistId,
                          }),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                query
                  ? 'No matching videos'
                  : mode === 'History'
                    ? 'Your story starts with a play'
                    : 'A little room for discovery'
              }
              description={
                mode === 'History'
                  ? 'Videos appear here after playback starts in the official player.'
                  : 'Use a video’s menu to add it to this collection.'
              }
            />
          )}
        </>
      )}
    </>
  );
}
