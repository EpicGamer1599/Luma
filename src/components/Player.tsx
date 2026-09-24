import { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink, AlertCircle } from 'lucide-react';
import type { Settings, Video } from '../shared/types';
import { youtubeUrl } from '../shared/types';
import { api } from '../hooks/api';
let apiPromise: Promise<void> | undefined;
function loadPlayerApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    const timer = setTimeout(() => {
      script.remove();
      apiPromise = undefined;
      reject(new Error('The YouTube player could not load. Check your internet connection.'));
    }, 20000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      apiPromise = undefined;
      reject(new Error('Could not connect to the YouTube player.'));
    };
    document.head.append(script);
  });
  return apiPromise;
}
export function Player({
  video,
  settings,
  start = 0,
  onProgress,
  onEnded,
  onError,
}: {
  video: Video;
  settings: Settings;
  start?: number;
  onProgress: (position: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    player = useRef<YT.Player | null>(null);
  const callbacks = useRef({ onProgress, onEnded, onError });
  callbacks.current = { onProgress, onEnded, onError };
  const [active, setActive] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setActive(settings.autoplay);
    setError('');
  }, [video.id, settings.autoplay]);
  useEffect(() => {
    if (!active) return;
    let disposed = false,
      interval: ReturnType<typeof setInterval> | undefined;
    let current: YT.Player | undefined;
    let hasPlayed = false;
    let ended = false;
    void loadPlayerApi()
      .then(() => {
        if (disposed || !host.current) return;
        const element = document.createElement('div');
        host.current.replaceChildren(element);
        current = new YT.Player(element, {
          videoId: video.id,
          width: '100%',
          height: '100%',
          playerVars: {
            origin: location.origin,
            autoplay: 1,
            controls: 1,
            playsinline: 1,
            start: Math.floor(start),
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              player.current = event.target;
              event.target.setVolume(settings.volume);
              if (event.target.getAvailablePlaybackRates().includes(settings.speed))
                event.target.setPlaybackRate(settings.speed);
            },
            onStateChange: (event) => {
              if (disposed) return;
              if (event.data === YT.PlayerState.PLAYING) {
                hasPlayed = true;
                ended = false;
                callbacks.current.onProgress(event.target.getCurrentTime());
              }
              if (event.data === YT.PlayerState.PAUSED && hasPlayed)
                callbacks.current.onProgress(event.target.getCurrentTime());
              if (event.data === YT.PlayerState.ENDED) {
                ended = true;
                callbacks.current.onProgress(0);
                callbacks.current.onEnded();
              }
            },
            onError: (event) => {
              const messages: Record<number, string> = {
                2: 'This video ID is invalid.',
                5: 'YouTube could not play this video in the embedded player.',
                100: 'This video is private, deleted, or unavailable.',
                101: 'The creator has disabled embedded playback. Open this video on YouTube.',
                150: 'The creator has disabled embedded playback. Open this video on YouTube.',
                153: 'YouTube could not identify this embedded player. Open on YouTube, or restart Luma.',
              };
              setError(
                messages[event.data] ??
                  'This video cannot be played here. Try opening it on YouTube.',
              );
            },
          },
        });
        interval = setInterval(() => {
          if (player.current?.getPlayerState() === YT.PlayerState.PLAYING)
            callbacks.current.onProgress(player.current.getCurrentTime());
        }, 10000);
      })
      .catch((e) => {
        if (!disposed) setError((e as Error).message);
      });
    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      if (current && hasPlayed && !ended) {
        try {
          callbacks.current.onProgress(current.getCurrentTime());
        } catch {
          /* Player may have been destroyed by Chromium. */
        }
      }
      player.current = null;
      current?.destroy();
    };
    // Settings apply when each player is created; changes do not restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, active]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          (event.target.matches('input,textarea,select,button') ||
            event.target.isContentEditable)) ||
        document.querySelector('dialog[open]')
      )
        return;
      const p = player.current;
      if (!p) return;
      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault();
          p.getPlayerState() === YT.PlayerState.PLAYING ? p.pauseVideo() : p.playVideo();
          break;
        case 'arrowleft':
          event.preventDefault();
          p.seekTo(Math.max(0, p.getCurrentTime() - 5), true);
          break;
        case 'arrowright':
          event.preventDefault();
          p.seekTo(Math.min(p.getDuration(), p.getCurrentTime() + 5), true);
          break;
        case 'm':
          p.isMuted() ? p.unMute() : p.mute();
          break;
        case 'f':
          event.preventDefault();
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
          else
            void shell.current
              ?.requestFullscreen()
              .catch(() =>
                callbacks.current.onError(
                  'Fullscreen is unavailable. Use the player fullscreen control.',
                ),
              );
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return (
    <>
      <div className="player-shell" ref={shell}>
        {!active ? (
          <div
            className="player-cover"
            style={{
              backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.7),rgba(0,0,0,.15)),url("${video.thumbnail}")`,
            }}
          >
            <button
              className="large-play"
              onClick={() => setActive(true)}
              aria-label="Start YouTube player"
            >
              <Play fill="currentColor" size={32} />
            </button>
            <p>Play on the official YouTube player</p>
            <span>Connects to YouTube when you press play</span>
          </div>
        ) : (
          <div className="iframe-host" ref={host} />
        )}
      </div>
      {error && (
        <div className="player-error" role="alert">
          <AlertCircle size={25} />
          <p>{error}</p>
          <button
            onClick={() =>
              void api({ op: 'external', url: youtubeUrl(video.id) }).catch((e) =>
                onError(e.message),
              )
            }
          >
            <ExternalLink size={16} /> Open on YouTube
          </button>
        </div>
      )}
    </>
  );
}
