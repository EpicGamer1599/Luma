import { Clock3, Ellipsis, Play, Plus, ExternalLink, Link, EyeOff } from 'lucide-react';
import type { Video } from '../shared/types';
import { compact, dateLabel, duration } from '../hooks/api';
export type VideoAction = 'play' | 'open' | 'watchLater' | 'playlist' | 'copy' | 'hide';
export function VideoCard({
  video,
  onAction,
  saved = false,
  position = 0,
}: {
  video: Video;
  onAction: (action: VideoAction, video: Video) => void;
  saved?: boolean;
  position?: number;
}) {
  const items = [
    ['play', Play, 'Play'],
    ['open', ExternalLink, 'Open on YouTube'],
    ['watchLater', Clock3, saved ? 'Saved to Watch Later' : 'Add to Watch Later'],
    ['playlist', Plus, 'Add to playlist'],
    ['copy', Link, 'Copy video link'],
    ['hide', EyeOff, 'Hide this video'],
  ] as const;
  return (
    <article className="video-card" data-testid="video-card">
      <button
        className="thumbnail"
        onClick={() => onAction('play', video)}
        aria-label={`Play ${video.title}`}
      >
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
        <span className="hover-play">
          <Play size={22} fill="currentColor" />
        </span>
        {video.demo && <span className="sample-badge">SAMPLE</span>}
        <span className="duration">
          {video.duration ? duration(video.duration) : 'LIVE / VIDEO'}
        </span>
        {position > 0 && video.duration > 0 && (
          <span
            className="progress"
            style={{ width: `${Math.min(100, (position / video.duration) * 100)}%` }}
          />
        )}
      </button>
      <div className="card-info">
        <div className="avatar" aria-hidden="true">
          {video.channel.slice(0, 1)}
        </div>
        <div className="card-copy">
          <button className="title-button" onClick={() => onAction('play', video)}>
            {video.title}
          </button>
          <p>{video.channel}</p>
          <p>
            {compact(video.views)} views <span>·</span> {dateLabel(video.publishedAt)}
          </p>
        </div>
        <details className="card-menu">
          <summary aria-label={`More options for ${video.title}`}>
            <Ellipsis size={20} />
          </summary>
          <div className="dropdown">
            {items.map(([action, Icon, label]) => (
              <button
                key={action}
                onClick={(e) => {
                  e.currentTarget.closest('details')?.removeAttribute('open');
                  onAction(action, video);
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}
