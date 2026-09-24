// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VideoCard } from '../src/components/VideoCard';
import { SettingsPage } from '../src/pages/SettingsPage';
import { demoVideos } from '../src/shared/demo';
import { defaultSettings, type Snapshot } from '../src/shared/types';
import { defaultRules } from '../src/filtering/engine';
afterEach(cleanup);
describe('important React components', () => {
  it('renders metadata and dispatches real card actions', () => {
    const action = vi.fn();
    render(<VideoCard video={demoVideos[0]} onAction={action} />);
    expect(screen.getByText('Big Buck Bunny')).toBeInTheDocument();
    expect(screen.getByText('9:56')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play Big Buck Bunny' }));
    expect(action).toHaveBeenCalledWith('play', demoVideos[0]);
    fireEvent.click(screen.getByText('Add to Watch Later'));
    expect(action).toHaveBeenCalledWith('watchLater', demoVideos[0]);
    fireEvent.click(screen.getByText('Add to playlist'));
    expect(action).toHaveBeenCalledWith('playlist', demoVideos[0]);
  });
  it('shows filtering scope, rejects unsafe filter JSON and renders preferences', async () => {
    const snapshot: Snapshot = {
      settings: defaultSettings,
      history: [],
      watchLater: [],
      playlists: [],
      searches: [],
      hidden: [],
      rules: defaultRules,
      hasApiKey: false,
      version: '1.0.0',
    };
    render(
      <SettingsPage
        snapshot={snapshot}
        onRefresh={async () => {}}
        onError={vi.fn()}
        onNotice={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Ad & Content Filtering' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(/official YouTube player, its advertising/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Manage filters'));
    fireEvent.change(screen.getByLabelText('Filter rules JSON'), {
      target: {
        value:
          '[{"id":"unsafe","kind":"cosmetic","value":"iframe","action":"block","enabled":true}]',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('app-owned');
  });
});
