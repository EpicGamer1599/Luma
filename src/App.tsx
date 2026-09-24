import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Clock3,
  ListVideo,
  Download,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  X,
  Check,
  AlertCircle,
  Film,
} from 'lucide-react';
import { api } from './hooks/api';
import { youtubeUrl, type LibraryItem, type Snapshot, type Video } from './shared/types';
import type { VideoAction } from './components/VideoCard';
import { Modal } from './components/Modal';
import { BrowsePage } from './pages/BrowsePage';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { VideoPage } from './pages/VideoPage';
import type { Page } from './shared/types';
import { Sidebar } from './components/Sidebar';
type Dialog =
  | { kind: 'playlist'; video?: Video; rename?: number }
  | { kind: 'confirm'; title: string; action: () => Promise<void> };
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(),
    [startupError, setStartupError] = useState(''),
    [page, setPage] = useState<Page>('Home'),
    [query, setQuery] = useState(''),
    [searchInput, setSearchInput] = useState(''),
    [video, setVideo] = useState<Video>(),
    [queue, setQueue] = useState<Video[]>([]),
    [playlistId, setPlaylistId] = useState<number>(),
    [playlistItems, setPlaylistItems] = useState<LibraryItem[]>([]),
    [dialog, setDialog] = useState<Dialog>(),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ message: string; error: boolean }>();
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    const next = await api<Snapshot>({ op: 'snapshot' });
    setSnapshot(next);
  }, []);
  const notice = useCallback((message: string) => setToast({ message, error: false }), []);
  const error = useCallback((message: string) => setToast({ message, error: true }), []);
  useEffect(() => {
    void refresh().catch((e) => setStartupError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!snapshot) return;
    const apply = () => {
      document.documentElement.dataset.theme =
        snapshot.settings.theme === 'system'
          ? matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : snapshot.settings.theme;
      document.documentElement.style.fontSize = `${snapshot.settings.scale * 14}px`;
    };
    const media = matchMedia('(prefers-color-scheme: dark)');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [snapshot?.settings.theme, snapshot?.settings.scale]);
  useEffect(() => {
    let cancelled = false;
    if (playlistId)
      void api<LibraryItem[]>({ op: 'playlistItems', id: playlistId })
        .then((items) => {
          if (!cancelled) setPlaylistItems(items);
        })
        .catch((e) => error(e.message));
    else setPlaylistItems([]);
    return () => {
      cancelled = true;
    };
  }, [playlistId, snapshot, error]);
  const navigate = useCallback((next: Page) => {
    setPage(next);
    setVideo(undefined);
    setQueue([]);
    if (next !== 'Playlists') setPlaylistId(undefined);
    contentRef.current?.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['k', 'h'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'k') {
          navigate('Search');
          searchRef.current?.focus();
        } else navigate('History');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [video?.id, page, playlistId]);
  async function mutate(action: () => Promise<unknown>, message?: string) {
    try {
      await action();
      await refresh();
      if (message) notice(message);
    } catch (e) {
      error((e as Error).message);
    }
  }
  function videoAction(action: VideoAction, v: Video) {
    switch (action) {
      case 'play':
        setVideo(v);
        setQueue([]);
        break;
      case 'open':
        void mutate(() => api({ op: 'external', url: youtubeUrl(v.id) }));
        break;
      case 'watchLater':
        void mutate(() => api({ op: 'watchLater', video: v }), 'Saved to Watch Later');
        break;
      case 'playlist':
        setName('');
        setDialog({ kind: 'playlist', video: v });
        break;
      case 'copy':
        void mutate(() => api({ op: 'copy', id: v.id }), 'Video link copied');
        break;
      case 'hide':
        void mutate(
          () => api({ op: 'hide', id: v.id }),
          'Video hidden from discovery. Restore it in Settings.',
        );
        break;
    }
  }
  function doSearch(q: string) {
    setQuery(q.trim());
    setSearchInput(q);
    navigate('Search');
    void refresh().catch((e) => error(e.message));
  }
  function confirm(title: string, action: () => Promise<void>) {
    setDialog({ kind: 'confirm', title, action });
  }
  async function submitDialog() {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === 'confirm') await dialog.action();
      else if (dialog.rename) await api({ op: 'playlistRename', id: dialog.rename, name });
      else {
        const id = await api<number>({ op: 'playlistCreate', name });
        if (dialog.video) await api({ op: 'playlistAdd', id, video: dialog.video });
        notice(dialog.video ? 'Playlist created and video added.' : 'Playlist created.');
      }
      await refresh();
      setDialog(undefined);
    } catch (e) {
      error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (startupError)
    return (
      <div className="startup-error">
        <AlertCircle size={36} />
        <h1>Luma couldn’t open your library</h1>
        <p>{startupError}</p>
        <button
          onClick={() => {
            setStartupError('');
            void refresh().catch((e) => setStartupError(e.message));
          }}
        >
          Try again
        </button>
      </div>
    );
  if (!snapshot)
    return (
      <div className="startup-error">
        <span className="brand-mark">&#9654;</span>
        <h1>Opening your viewing space…</h1>
      </div>
    );
  const nextInQueue = queue[queue.findIndex((v) => v.id === video?.id) + 1];
  return (
    <div className="app-shell">
      <Sidebar
        snapshot={snapshot}
        page={page}
        video={Boolean(video)}
        navigate={navigate}
        onCreate={() => {
          setName('');
          setDialog({ kind: 'playlist' });
        }}
        onPlaylist={(id) => {
          navigate('Playlists');
          setPlaylistId(id);
        }}
      />
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <span>/</span> <strong>{video ? 'Now playing' : page}</strong>
          </div>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(searchInput);
            }}
          >
            <Search size={17} />
            <input
              ref={searchRef}
              aria-label="Search YouTube"
              placeholder="Follow your curiosity…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearchInput('')}>
                <X size={14} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </form>
          <button className="mode-pill" onClick={() => navigate('Settings')}>
            <span className="status-dot" />
            {snapshot.settings.demo
              ? 'Demo mode'
              : snapshot.hasApiKey
                ? 'Live mode'
                : 'API key needed'}
            <ArrowUpRight size={13} />
          </button>
        </header>
        <main className="main-content" ref={contentRef}>
          {snapshot.recovery && (
            <div className="notice" role="alert">
              {snapshot.recovery}
            </div>
          )}
          {video ? (
            <VideoPage
              video={video}
              snapshot={snapshot}
              onBack={() => setVideo(undefined)}
              onAction={videoAction}
              onError={error}
              onRefresh={refresh}
              queue={queue}
              onNext={() => {
                if (nextInQueue) setVideo(nextInQueue);
              }}
            />
          ) : page === 'Home' || page === 'Explore' || page === 'Search' ? (
            <BrowsePage
              key={page}
              mode={page}
              query={query}
              snapshot={snapshot}
              onAction={videoAction}
              onSearch={doSearch}
              onSettings={() => navigate('Settings')}
              onError={error}
              onRefresh={refresh}
            />
          ) : page === 'History' || page === 'Watch Later' || page === 'Playlists' ? (
            <LibraryPage
              key={`${page}-${playlistId}`}
              mode={page}
              snapshot={snapshot}
              playlistId={playlistId}
              items={playlistItems}
              onPlaylist={setPlaylistId}
              onAction={videoAction}
              onCreate={() => {
                setName('');
                setDialog({ kind: 'playlist' });
              }}
              onRename={() => {
                setName(snapshot.playlists.find((p) => p.id === playlistId)?.name ?? '');
                setDialog({ kind: 'playlist', rename: playlistId });
              }}
              onDelete={() =>
                confirm('Delete this playlist?', async () => {
                  await api({ op: 'playlistDelete', id: playlistId! });
                  setPlaylistId(undefined);
                  await refresh();
                })
              }
              onConfirm={confirm}
              onRefresh={refresh}
              onError={error}
              onQueue={(videos) => {
                if (videos.length) {
                  setQueue(videos);
                  setVideo(videos[0]);
                }
              }}
            />
          ) : page === 'Settings' ? (
            <SettingsPage
              snapshot={snapshot}
              onRefresh={refresh}
              onError={error}
              onNotice={notice}
              onConfirm={confirm}
            />
          ) : (
            <div className="downloads-page">
              <div className="download-illustration">
                <Download size={54} />
                <Film className="floating-film" size={26} />
              </div>
              <span className="eyebrow">A LITTLE SPACE FOR WHAT’S NEXT</span>
              <h1>Good things take time.</h1>
              <p>
                Downloads are reserved for future supported media sources.
                <br />
                Luma does not download YouTube video or audio.
              </p>
              <div className="download-note">
                <ShieldCheck size={22} />
                <div>
                  <strong>Enjoy YouTube through its official player</strong>
                  <p>
                    Save a video to Watch Later or a playlist to find it easily.
                    <br />
                    Watching still requires an internet connection.
                  </p>
                </div>
              </div>
              <button className="primary" onClick={() => navigate('Watch Later')}>
                <Clock3 size={16} /> Go to Watch Later
              </button>
            </div>
          )}
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(undefined)}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === 'confirm'
              ? dialog.title
              : dialog.rename
                ? 'Rename playlist'
                : dialog.video
                  ? 'Add to playlist'
                  : 'New playlist'
          }
          onClose={() => {
            if (!busy) setDialog(undefined);
          }}
        >
          {dialog.kind === 'confirm' ? (
            <>
              <p>This updates data stored on this device. Deleted items cannot be recovered.</p>
              <div className="modal-footer">
                <button onClick={() => setDialog(undefined)} disabled={busy}>
                  Cancel
                </button>
                <button className="primary" onClick={() => void submitDialog()} disabled={busy}>
                  {busy ? 'Working…' : 'Confirm'}
                </button>
              </div>
            </>
          ) : (
            <>
              {dialog.video && snapshot.playlists.length > 0 && (
                <div className="playlist-choices">
                  {snapshot.playlists.map((p) => (
                    <button
                      key={p.id}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api({ op: 'playlistAdd', id: p.id, video: dialog.video! });
                          await refresh();
                          setDialog(undefined);
                          notice('Added to playlist.');
                        } catch (e) {
                          error((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <ListVideo size={18} />
                      {p.name}
                      <Plus size={16} />
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitDialog();
                }}
              >
                <label className="field-label">
                  {dialog.video ? 'Or create a new playlist' : 'Playlist name'}
                  <input
                    autoFocus
                    aria-label="Playlist name"
                    placeholder="e.g. Weekend discoveries"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="modal-footer">
                  <button type="button" onClick={() => setDialog(undefined)} disabled={busy}>
                    Cancel
                  </button>
                  <button className="primary" type="submit" disabled={!name.trim() || busy}>
                    {busy
                      ? 'Saving…'
                      : dialog.rename
                        ? 'Save name'
                        : dialog.video
                          ? 'Create & add'
                          : 'Create playlist'}
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
