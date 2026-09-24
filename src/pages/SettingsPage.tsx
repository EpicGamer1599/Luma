import { useState } from 'react';
import { ExternalLink, KeyRound, RefreshCw } from 'lucide-react';
import { api } from '../hooks/api';
import type { Settings, Snapshot } from '../shared/types';
import { Toggle } from '../components/Toggle';
import { FilteringSettings } from '../components/FilteringSettings';

export function SettingsPage({
  snapshot,
  onRefresh,
  onError,
  onNotice,
  onConfirm,
}: {
  snapshot: Snapshot;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
  onConfirm: (title: string, action: () => Promise<void>) => void;
}) {
  const [key, setKey] = useState(''),
    [repository, setRepository] = useState(snapshot.settings.repository),
    [update, setUpdate] = useState<{ message: string; url?: string }>(),
    [checking, setChecking] = useState(false);
  const settings = snapshot.settings;
  const run = (fn: () => Promise<unknown>, notice?: string) =>
    void fn()
      .then(onRefresh)
      .then(() => {
        if (notice) onNotice(notice);
      })
      .catch((e) => onError(e.message));
  const patch = (patch: Partial<Settings>) => run(() => api({ op: 'settings', patch }));

  const clear = (target: 'history' | 'searches' | 'watchLater' | 'hidden' | 'all', label: string) =>
    onConfirm(label, async () => {
      await api({ op: 'clear', target });
      await onRefresh();
      onNotice('Local data updated.');
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>Settings</h1>
          <p>Your space, your preferences. Everything is saved on this device.</p>
        </div>
        <span className="subtle-label">Luma {snapshot.version}</span>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            'Connection',
            'Appearance',
            'Playback',
            'Privacy',
            'Filtering',
            'Shortcuts',
            'Data',
            'About',
          ].map((s) => (
            <a key={s} href={`#settings-${s.toLowerCase()}`}>
              {s}
            </a>
          ))}
        </nav>
        <div className="settings-content">
          <section className="settings-section" id="settings-connection">
            <h2>
              <KeyRound size={20} /> YouTube connection
            </h2>
            <p>
              Use your own YouTube Data API v3 key for live search and discovery. Playback uses the
              official YouTube player.
            </p>
            <div className="key-status">
              <span className={`status-dot ${snapshot.hasApiKey ? '' : 'muted'}`} />
              {snapshot.hasApiKey ? 'API key configured' : 'No API key configured'}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api({ op: 'apiKey', key });
                  setKey('');
                }, 'API key saved securely. Turn off Demo Mode for live results.');
              }}
            >
              <label className="field-label">
                YouTube API key
                <input
                  aria-label="YouTube API key"
                  type="password"
                  placeholder="Enter your API key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="button-row">
                <button className="primary" type="submit" disabled={!key.trim()}>
                  Save key
                </button>
                {snapshot.hasApiKey && (
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        () => api({ op: 'apiKey', key: '' }),
                        'Stored key removed. Environment keys remain active until restart.',
                      )
                    }
                  >
                    Remove stored key
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    run(() =>
                      api({
                        op: 'external',
                        url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
                      }),
                    )
                  }
                >
                  API setup <ExternalLink size={14} />
                </button>
              </div>
            </form>
            <Toggle
              label="Demo Mode"
              description="Browse bundled sample metadata without an API key."
              value={settings.demo}
              onChange={(demo) => patch({ demo })}
            />
          </section>
          <section className="settings-section" id="settings-appearance">
            <h2>Appearance</h2>
            <div className="setting-row">
              <div>
                <strong>Theme</strong>
                <p>Choose your favorite backdrop.</p>
              </div>
              <select
                aria-label="Theme"
                value={settings.theme}
                onChange={(e) => patch({ theme: e.target.value as Settings['theme'] })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="setting-row">
              <div>
                <strong>UI scale</strong>
                <p>Adjust text and controls.</p>
              </div>
              <select
                aria-label="UI scale"
                value={settings.scale}
                onChange={(e) => patch({ scale: Number(e.target.value) })}
              >
                {[0.85, 1, 1.1, 1.2].map((s) => (
                  <option key={s} value={s}>
                    {Math.round(s * 100)}%
                  </option>
                ))}
              </select>
            </div>
          </section>
          <section className="settings-section" id="settings-playback">
            <h2>Playback</h2>
            <div className="setting-row">
              <div>
                <strong>Default volume</strong>
                <p>Applied when a player starts.</p>
              </div>
              <label className="range-label">
                <input
                  aria-label="Default volume"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.volume}
                  onChange={(e) => patch({ volume: Number(e.target.value) })}
                />
                {settings.volume}%
              </label>
            </div>
            <Toggle
              label="Autoplay"
              description="Start videos automatically and continue to the next playlist item. Your browser may require a click."
              value={settings.autoplay}
              onChange={(autoplay) => patch({ autoplay })}
            />
            <div className="setting-row">
              <div>
                <strong>Playback speed</strong>
                <p>Applied when supported by the video.</p>
              </div>
              <select
                aria-label="Playback speed"
                value={settings.speed}
                onChange={(e) => patch({ speed: Number(e.target.value) })}
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </div>
          </section>
          <section className="settings-section" id="settings-privacy">
            <h2>Privacy</h2>
            <Toggle
              label="Watch history"
              description="Remember watched videos and playback position locally."
              value={settings.historyEnabled}
              onChange={(historyEnabled) => patch({ historyEnabled })}
            />
            <Toggle
              label="Search history"
              description="Remember your last 30 searches locally."
              value={settings.searchHistoryEnabled}
              onChange={(searchHistoryEnabled) => patch({ searchHistoryEnabled })}
            />
            <p className="fine-print">
              Live searches send your query and API key to Google. Playing a video connects to
              YouTube, which may use cookies. Luma has no analytics or account synchronization.
            </p>
            <div className="button-row">
              <button
                onClick={() =>
                  run(() => api({ op: 'external', url: 'https://www.youtube.com/t/terms' }))
                }
              >
                YouTube Terms
              </button>
              <button
                onClick={() =>
                  run(() => api({ op: 'external', url: 'https://policies.google.com/privacy' }))
                }
              >
                Google Privacy Policy
              </button>
            </div>
          </section>
          <FilteringSettings
            snapshot={snapshot}
            patch={patch}
            onRefresh={onRefresh}
            onNotice={onNotice}
          />
          <section className="settings-section" id="settings-shortcuts">
            <h2>Keyboard shortcuts</h2>
            <div className="shortcut-grid">
              {[
                ['Play / pause', 'Space'],
                ['Seek backward / forward', 'Left / Right'],
                ['Fullscreen', 'F'],
                ['Mute / unmute', 'M'],
                ['Search', 'Ctrl / Cmd K'],
                ['History', 'Ctrl / Cmd H'],
              ].map(([label, key]) => (
                <div key={label}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
            </div>
            <p className="fine-print">
              Playback shortcuts work while the page has focus. Inside the embedded player, YouTube
              handles its own shortcuts.
            </p>
          </section>
          <section className="settings-section" id="settings-data">
            <h2>Local data</h2>
            <p>Clear individual collections or start fresh. These actions cannot be undone.</p>
            <div className="data-actions">
              <button onClick={() => clear('history', 'Clear watch history?')}>
                Clear watch history
              </button>
              <button onClick={() => clear('searches', 'Clear search history?')}>
                Clear search history
              </button>
              <button onClick={() => clear('watchLater', 'Clear Watch Later?')}>
                Clear Watch Later
              </button>
              <button onClick={() => clear('hidden', 'Restore hidden videos?')}>
                Restore hidden videos
              </button>
              <button
                className="danger"
                onClick={() => clear('all', 'Reset all application data?')}
              >
                Reset application data
              </button>
            </div>
          </section>
          <section className="settings-section" id="settings-about">
            <h2>Made for curiosity.</h2>
            <p>Luma {snapshot.version} · MIT License</p>
            <p>
              An independent, open-source desktop client. Not affiliated with or endorsed by YouTube
              or Google.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => api({ op: 'settings', patch: { repository } }), 'Repository saved.');
              }}
            >
              <label className="field-label">
                GitHub repository
                <input
                  aria-label="GitHub repository"
                  placeholder="owner/repository"
                  value={repository}
                  onChange={(e) => setRepository(e.target.value)}
                />
              </label>
              <button type="submit">Save repository</button>
            </form>
            <div className="button-row about-actions">
              <button
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  try {
                    setUpdate(await api({ op: 'updates' }));
                  } catch (e) {
                    onError((e as Error).message);
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                <RefreshCw size={15} />
                {checking ? 'Checking…' : 'Check for updates'}
              </button>
              {settings.repository && (
                <button
                  onClick={() =>
                    run(() =>
                      api({ op: 'external', url: `https://github.com/${settings.repository}` }),
                    )
                  }
                >
                  View repository <ExternalLink size={14} />
                </button>
              )}
            </div>
            {update && (
              <div className="notice">
                {update.message}
                {update.url && (
                  <button onClick={() => run(() => api({ op: 'external', url: update.url! }))}>
                    View release
                  </button>
                )}
              </div>
            )}
            <p className="fine-print">
              Release checks run only when requested. Updates are installed manually; Luma never
              downloads or executes an updater.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
