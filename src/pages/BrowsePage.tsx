import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Play, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { api } from '../hooks/api';
import type { SearchInput, SearchResult, Snapshot, Video } from '../shared/types';
import type { VideoAction } from '../components/VideoCard';
import { EmptyState, SkeletonGrid, VideoGrid } from '../components/VideoGrid';
import { isBlocked } from '../filtering/engine';
export function BrowsePage({
  mode,
  query,
  snapshot,
  onAction,
  onSearch,
  onSettings,
  onError,
  onRefresh,
}: {
  mode: 'Home' | 'Explore' | 'Search';
  query: string;
  snapshot: Snapshot;
  onAction: (action: VideoAction, video: Video) => void;
  onSearch: (q: string) => void;
  onSettings: () => void;
  onError: (s: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [filters, setFilters] = useState<Omit<SearchInput, 'q'>>({
    type: 'video',
    date: 'any',
    duration: 'any',
    order: 'relevance',
  });
  const [topic, setTopic] = useState('All'),
    [result, setResult] = useState<SearchResult>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const requestId = useRef(0);
  const input: SearchInput = {
    ...filters,
    q: mode === 'Search' ? query : '',
    topic: mode !== 'Search' && topic !== 'All' ? topic.toLowerCase() : undefined,
  };
  async function load(more = false) {
    const serial = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const next = await api<SearchResult>({
        op: 'search',
        input: { ...input, pageToken: more ? result?.nextPageToken : undefined },
      });
      if (serial !== requestId.current) return;
      setResult((previous) =>
        more && previous
          ? {
              ...next,
              videos: [...previous.videos, ...next.videos].filter(
                (v, i, a) => a.findIndex((x) => x.id === v.id) === i,
              ),
              entities: [...previous.entities, ...next.entities],
            }
          : next,
      );
      if (input.q) void onRefresh().catch((e) => onError(e.message));
    } catch (e) {
      if (serial === requestId.current) setError((e as Error).message);
    } finally {
      if (serial === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    setResult(undefined);
    void load();
    return () => {
      requestId.current++;
    };
  }, [mode, query, topic, filters, snapshot.settings.demo, snapshot.hasApiKey]);
  const visible = (result?.videos ?? []).filter(
    (v) =>
      !snapshot.hidden.includes(v.id) &&
      !isBlocked(
        {
          text: `${v.title} ${v.channel} ${v.description}`,
          url: `https://www.youtube.com/watch?v=${v.id}`,
        },
        snapshot.rules,
        snapshot.settings.filtering,
        snapshot.settings.advancedFiltering,
      ),
  );
  const featured = visible[0];
  return (
    <>
      {snapshot.settings.demo && (
        <div className="demo-notice">
          <span className="status-dot" />
          <strong>Demo Mode</strong>
          <span>Bundled sample metadata. Your library is real and saved locally.</span>
          <button onClick={onSettings}>
            Connect YouTube <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      {mode === 'Home' && featured && (
        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg,#172320 0%,#172320ee 34%,#17232022 100%),url("${featured.thumbnail}")`,
          }}
        >
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={14} />
              {snapshot.settings.demo ? 'A LITTLE INSPIRATION' : 'DISCOVER SOMETHING GOOD'}
            </span>
            <h1>
              Your next rabbit hole
              <br />
              starts here.
            </h1>
            <p>
              A space for your curiosity. Find something you love,
              <br className="desktop-break" /> save it for later, and make it your own.
            </p>
            <button className="primary" onClick={() => onAction('play', featured)}>
              <Play size={16} fill="currentColor" />{' '}
              {snapshot.settings.demo ? 'Explore a sample' : 'Start watching'}
            </button>
          </div>
          <div className="hero-label">
            <span>
              {snapshot.settings.demo ? 'FROM THE DEMO COLLECTION' : 'FEATURED ON YOUTUBE'}
            </span>
            <strong>{featured.title}</strong>
          </div>
        </section>
      )}
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {mode === 'Search' ? 'FOLLOW YOUR CURIOSITY' : 'YOUR DAILY DOSE OF DISCOVERY'}
          </span>
          <h1>
            {mode === 'Home'
              ? 'Made for your curiosity'
              : mode === 'Explore'
                ? 'Explore a little further'
                : query
                  ? `Results for “${query}”`
                  : 'Find your next favorite'}
          </h1>
          <p>
            {mode === 'Search'
              ? 'Videos, channels, and playlists from YouTube.'
              : snapshot.settings.demo
                ? 'A small collection to explore your new viewing space.'
                : 'Popular videos from YouTube. Explore a topic to find more.'}
          </p>
        </div>
        <span className="subtle-label">
          {snapshot.settings.demo ? 'Sample collection' : 'Powered by YouTube'}
        </span>
      </div>
      {mode !== 'Search' ? (
        <div className="topic-row">
          {['All', 'Nature', 'Technology', 'Film', 'Design', 'Music', 'Gaming'].map((t) => (
            <button
              key={t}
              className={`chip ${topic === t ? 'selected' : ''}`}
              onClick={() => setTopic(t)}
            >
              {t}
            </button>
          ))}
          <span className="topic-end">
            <SlidersHorizontal size={16} /> Explore by interest
          </span>
        </div>
      ) : (
        <div className="filter-row">
          <SlidersHorizontal size={17} />
          <label>
            Type
            <select
              aria-label="Search type"
              value={filters.type}
              onChange={(e) =>
                setFilters({ ...filters, type: e.target.value as SearchInput['type'] })
              }
            >
              <option value="video">Videos</option>
              <option value="channel">Channels</option>
              <option value="playlist">Playlists</option>
            </select>
          </label>
          <label>
            Uploaded
            <select
              aria-label="Upload date"
              value={filters.date}
              onChange={(e) =>
                setFilters({ ...filters, date: e.target.value as SearchInput['date'] })
              }
            >
              {[
                ['any', 'Any time'],
                ['today', 'Today'],
                ['week', 'This week'],
                ['month', 'This month'],
                ['year', 'This year'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Duration
            <select
              aria-label="Duration"
              disabled={filters.type !== 'video'}
              value={filters.duration}
              onChange={(e) =>
                setFilters({ ...filters, duration: e.target.value as SearchInput['duration'] })
              }
            >
              {[
                ['any', 'Any length'],
                ['short', 'Short · under 4 min'],
                ['medium', 'Medium · 4–20 min'],
                ['long', 'Long · over 20 min'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              aria-label="Search sort"
              value={filters.order}
              onChange={(e) =>
                setFilters({ ...filters, order: e.target.value as SearchInput['order'] })
              }
            >
              {[
                ['relevance', 'Relevance'],
                ['date', 'Upload date'],
                ['viewCount', 'View count'],
                ['rating', 'Rating'],
                ['title', 'Title'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {mode === 'Search' && !query && snapshot.searches.length > 0 && (
        <div className="recent-searches">
          <span>Recent searches</span>
          {snapshot.searches.slice(0, 8).map((q) => (
            <button className="chip" key={q} onClick={() => onSearch(q)}>
              <Search size={13} />
              {q}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <div className="error-panel" role="alert">
          <h2>Couldn’t load videos</h2>
          <p>{error}</p>
          <button onClick={() => void load()}>Try again</button>
          <button onClick={onSettings}>Open settings</button>
        </div>
      ) : loading && !result ? (
        <SkeletonGrid />
      ) : (
        <>
          <VideoGrid
            videos={visible}
            onAction={onAction}
            savedIds={snapshot.watchLater.map((v) => v.id)}
          />
          {result?.entities.map((entity) => (
            <button
              className="entity-card"
              key={entity.id}
              onClick={() =>
                void api({
                  op: 'external',
                  url:
                    entity.type === 'channel'
                      ? `https://www.youtube.com/channel/${entity.id}`
                      : `https://www.youtube.com/playlist?list=${entity.id}`,
                }).catch((e) => onError(e.message))
              }
            >
              <div className="entity-icon">{entity.type === 'channel' ? 'CH' : 'PL'}</div>
              <div>
                <span className="eyebrow">{entity.type}</span>
                <h3>{entity.title}</h3>
                <p>{entity.description.slice(0, 180)}</p>
              </div>
              <ArrowUpRight size={20} />
            </button>
          ))}
          {!visible.length && !result?.entities.length && (
            <EmptyState
              title="Nothing here just yet"
              description={
                snapshot.settings.demo && filters.type !== 'video'
                  ? 'Demo Mode includes video samples only. Connect a YouTube API key for live channel and playlist search.'
                  : 'Try another search or topic, loosen your filters, or restore hidden videos in Settings.'
              }
            />
          )}
          {result?.nextPageToken && (
            <div className="load-more">
              <button onClick={() => void load(true)} disabled={loading}>
                {loading ? 'Loading…' : 'Show more'}
                <ArrowDown size={16} />
              </button>
            </div>
          )}
        </>
      )}
      <footer className="page-footer">
        <span className="brand-mark small">&#9654;</span>
        <span>Less noise. More of what you love.</span>
        <span>Built for your curiosity.</span>
      </footer>
    </>
  );
}
