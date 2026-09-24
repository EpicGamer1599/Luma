// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Player } from '../src/components/Player';
import { demoVideos } from '../src/shared/demo';
import { defaultSettings } from '../src/shared/types';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mockApi() {
  let events: YT.Events = {};
  let state = 1;
  let position = 20;
  const p = {
    setVolume: vi.fn(),
    getAvailablePlaybackRates: () => [0.5, 1, 1.5, 2],
    setPlaybackRate: vi.fn(),
    getCurrentTime: () => position,
    getPlayerState: () => state,
    getDuration: () => 596,
    pauseVideo: vi.fn(),
    playVideo: vi.fn(),
    seekTo: vi.fn(),
    isMuted: () => false,
    mute: vi.fn(),
    unMute: vi.fn(),
    destroy: vi.fn(),
  };
  class FakePlayer {
    constructor(_element: HTMLElement, options: YT.PlayerOptions) {
      events = options.events ?? {};
      queueMicrotask(() => events.onReady?.({ target: p as unknown as YT.Player }));
      return p;
    }
  }
  vi.stubGlobal('YT', { Player: FakePlayer, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } });
  return {
    p,
    setPosition: (n: number) => {
      position = n;
    },
    emit: (n: number) => {
      state = n;
      events.onStateChange?.({ target: p as unknown as YT.Player, data: n });
    },
    fail: (n: number) => events.onError?.({ target: p as unknown as YT.Player, data: n }),
  };
}
describe('official player integration', () => {
  it('requires user consent before loading, records only played videos, applies preferences and handles shortcuts', async () => {
    const mock = mockApi(),
      progress = vi.fn(),
      ended = vi.fn();
    const rendered = render(
      <Player
        video={demoVideos[0]}
        settings={{ ...defaultSettings, speed: 1.5 }}
        onProgress={progress}
        onEnded={ended}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Start YouTube player' })).toBeInTheDocument();
    expect(progress).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start YouTube player' }));
    await waitFor(() => expect(mock.p.setVolume).toHaveBeenCalledWith(70));
    expect(mock.p.setPlaybackRate).toHaveBeenCalledWith(1.5);
    act(() => mock.emit(1));
    expect(progress).toHaveBeenCalledWith(20);
    fireEvent.keyDown(window, { key: ' ' });
    expect(mock.p.pauseVideo).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(mock.p.seekTo).toHaveBeenCalledWith(25, true);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(mock.p.seekTo).toHaveBeenCalledWith(15, true);
    fireEvent.keyDown(window, { key: 'm' });
    expect(mock.p.mute).toHaveBeenCalled();
    act(() => mock.emit(0));
    expect(progress).toHaveBeenLastCalledWith(0);
    expect(ended).toHaveBeenCalledTimes(1);
    rendered.unmount();
    expect(progress).toHaveBeenLastCalledWith(0);
    expect(mock.p.destroy).toHaveBeenCalled();
  });
  it('shows embedding restrictions outside the player without recording history', async () => {
    const mock = mockApi(),
      progress = vi.fn();
    render(
      <Player
        video={demoVideos[0]}
        settings={{ ...defaultSettings, autoplay: true }}
        onProgress={progress}
        onEnded={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => expect(mock.p.setVolume).toHaveBeenCalled());
    act(() => mock.fail(101));
    expect(screen.getByRole('alert')).toHaveTextContent('disabled embedded playback');
    expect(screen.getByRole('alert').closest('.player-shell')).toBeNull();
    expect(progress).not.toHaveBeenCalled();
  });
});
