import {
  Home,
  Compass,
  Search,
  History,
  Clock3,
  ListVideo,
  Download,
  Settings,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import type { Page, Snapshot } from '../shared/types';
const nav = [
  ['Home', Home],
  ['Explore', Compass],
  ['Search', Search],
  ['History', History],
  ['Watch Later', Clock3],
  ['Playlists', ListVideo],
  ['Downloads', Download],
] as const;
export function Sidebar({
  snapshot,
  page,
  video,
  navigate,
  onCreate,
  onPlaylist,
}: {
  snapshot: Snapshot;
  page: Page;
  video: boolean;
  navigate: (page: Page) => void;
  onCreate: () => void;
  onPlaylist: (id: number) => void;
}) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('Home')} aria-label="Luma home">
        <span className="brand-mark">&#9654;</span>
        <span>
          luma<span className="brand-dot">.</span>
        </span>
      </button>
      <div className="workspace-label">YOUR VIEWING SPACE</div>
      <nav aria-label="Main navigation">
        {nav.map(([label, Icon], i) => (
          <div key={label}>
            {i === 3 && (
              <div className="nav-divider">
                <span>YOUR LIBRARY</span>
              </div>
            )}
            <button
              className={`nav-item ${page === label && !video ? 'active' : ''}`}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'Watch Later' && snapshot.watchLater.length > 0 && (
                <span className="nav-count">{snapshot.watchLater.length}</span>
              )}
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-playlists">
        <div>
          <span>PLAYLISTS</span>
          <button className="icon-button" aria-label="Create playlist" onClick={onCreate}>
            <Plus size={16} />
          </button>
        </div>
        {snapshot.playlists.length ? (
          snapshot.playlists.slice(0, 5).map((p, i) => (
            <button className="playlist-nav" key={p.id} onClick={() => onPlaylist(p.id)}>
              <span className={`playlist-dot dot-${i % 3}`} />
              <span>{p.name}</span>
            </button>
          ))
        ) : (
          <p>
            Make a little collection.
            <br />
            Keep what inspires you.
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="local-card">
          <ShieldCheck size={17} />
          <div>
            <strong>Your library. Your device.</strong>
            <span>No account needed.</span>
          </div>
        </div>
        <button
          className={`nav-item ${page === 'Settings' ? 'active' : ''}`}
          onClick={() => navigate('Settings')}
        >
          <Settings size={19} />
          <span>Settings</span>
          <span className="version">v{snapshot.version}</span>
        </button>
      </div>
    </aside>
  );
}
