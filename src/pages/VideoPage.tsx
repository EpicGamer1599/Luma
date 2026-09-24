import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock3,
  ExternalLink,
  ListPlus,
  Share2,
  ChevronDown,
  SkipForward,
} from 'lucide-react';
import { Player } from '../components/Player';
import { VideoGrid } from '../components/VideoGrid';
import type { VideoAction } from '../components/VideoCard';
import { api, compact, dateLabel } from '../hooks/api';
import { youtubeUrl, type Video, type Snapshot, type SearchResult } from '../shared/types';
import { isBlocked } from '../filtering/engine';
export function VideoPage({
  video,
  snapshot,
  onBack,
  onAction,
  onError,
  onRefresh,
  queue,
  onNext,
}: {
  video: Video;
  snapshot: Snapshot;
  onBack: () => void;
  onAction: (a: VideoAction, v: Video) => void;
  onError: (m: string) => void;
  onRefresh: () => Promise<void>;
  queue: Video[];
  onNext: () => void;
}) {
  const [related, setRelated] = useState<Video[]>([]),
    [loading, setLoading] = useState(false),
    [details, setDetails] = useState(video),
    [metadataError, setMetadataError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setDetails(video);
    setRelated([]);
    setMetadataError('');
    if (!snapshot.settings.demo)
      void api<Video>({ op: 'video', id: video.id })
        .then((v) => {
          if (!cancelled) setDetails(v);
        })
        .catch((e) => {
          if (!cancelled) setMetadataError(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [video.id, snapshot.settings.demo]);
  async function loadRelated() {
    setLoading(true);
    try {
      const result = await api<SearchResult>({
        op: 'search',
        input: {
          q: snapshot.settings.demo
            ? ''
            : (details.tags[0] ?? details.title.split(' ').slice(0, 3).join(' ')),
          type: 'video',
          date: 'any',
          duration: 'any',
          order: 'relevance',
        },
      });
      setRelated(
        result.videos.filter(
          (v) =>
            v.id !== video.id &&
            !snapshot.hidden.includes(v.id) &&
            !isBlocked(
              { text: `${v.title} ${v.channel}`, url: youtubeUrl(v.id) },
              snapshot.rules,
              snapshot.settings.filtering,
              snapshot.settings.advancedFiltering,
            ),
        ),
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const saved = snapshot.watchLater.some((v) => v.id === video.id);
  const next = queue[queue.findIndex((v) => v.id === video.id) + 1];
  return (
    <>
      <div className="viewer-back">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back to browsing
        </button>
        <span>{video.demo ? 'DEMO SAMPLE · LIVE PLAYER' : 'YOUTUBE'}</span>
      </div>
      <Player
        key={video.id}
        video={details}
        settings={{
          ...snapshot.settings,
          autoplay: snapshot.settings.autoplay || queue.length > 0,
        }}
        start={snapshot.history.find((v) => v.id === video.id)?.position ?? 0}
        onProgress={(position) => {
          void api({ op: 'history', video: details, position })
            .then(onRefresh)
            .catch((e) => onError(e.message));
        }}
        onEnded={onNext}
        onError={onError}
      />
      <div className="video-heading">
        <h1>{details.title}</h1>
        <span>
          {compact(details.views)} views · {dateLabel(details.publishedAt)}
          {details.demo ? ' · Illustrative demo metadata' : ''}
        </span>
      </div>
      {metadataError && (
        <div className="notice" role="alert">
          {metadataError}
        </div>
      )}
      <div className="video-actions">
        <div className="channel-block">
          <div className="avatar">{details.channel[0]}</div>
          <div>
            <strong>{details.channel}</strong>
            <span>Watch on YouTube</span>
          </div>
        </div>
        <div className="button-row">
          <button className={saved ? 'saved' : ''} onClick={() => onAction('watchLater', details)}>
            {saved ? <Check size={16} /> : <Clock3 size={16} />} {saved ? 'Saved' : 'Watch later'}
          </button>
          <button onClick={() => onAction('playlist', details)}>
            <ListPlus size={16} /> Playlist
          </button>
          <button onClick={() => onAction('copy', details)}>
            <Share2 size={16} /> Share
          </button>
          <button aria-label="Open on YouTube" onClick={() => onAction('open', details)}>
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
      <details className="description-panel">
        <summary>
          About this video <ChevronDown size={16} />
        </summary>
        <p>{details.description || 'No description is available for this video.'}</p>
        <div className="tags">
          {details.tags.slice(0, 15).map((tag, i) => (
            <span key={`${tag}-${i}`}>#{tag}</span>
          ))}
        </div>
      </details>
      {next && (
        <div className="queue-next">
          <div>
            <span className="eyebrow">UP NEXT IN YOUR PLAYLIST</span>
            <h3>{next.title}</h3>
          </div>
          <button onClick={onNext}>
            <SkipForward size={16} /> Play next
          </button>
        </div>
      )}
      <div className="section-heading">
        <div>
          <h2>Keep exploring</h2>
          <p>Related topic matches, searched on demand.</p>
        </div>
        <button disabled={loading} onClick={() => void loadRelated()}>
          {loading ? 'Finding videos…' : 'Find related videos'}
        </button>
      </div>
      <VideoGrid
        videos={related}
        onAction={onAction}
        savedIds={snapshot.watchLater.map((v) => v.id)}
      />
    </>
  );
}
