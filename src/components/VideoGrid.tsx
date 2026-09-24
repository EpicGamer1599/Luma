import { SearchX, ArrowRight } from 'lucide-react';
import { VideoCard, type VideoAction } from './VideoCard';
import type { Video } from '../shared/types';
export function VideoGrid({
  videos,
  onAction,
  savedIds = [],
  positions = {},
}: {
  videos: Video[];
  onAction: (action: VideoAction, video: Video) => void;
  savedIds?: string[];
  positions?: Record<string, number>;
}) {
  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onAction={onAction}
          saved={savedIds.includes(video.id)}
          position={positions[video.id]}
        />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <SearchX size={28} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button className="primary" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function SkeletonGrid() {
  return (
    <div className="video-grid" aria-label="Loading videos">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
