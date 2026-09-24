import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Snapshot } from '../../src/shared/types';
let app: ElectronApplication;
const dataDir = mkdtempSync(join(tmpdir(), 'luma-e2e-'));
const env: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  ),
  LUMA_DATA_DIR: dataDir,
  YOUTUBE_API_KEY: '',
  LUMA_DEV_URL: '',
};
delete env.ELECTRON_RUN_AS_NODE;
async function launch() {
  app = await electron.launch({
    args: process.env.LUMA_TEST_EXE ? [] : ['.'],
    executablePath: process.env.LUMA_TEST_EXE || undefined,
    env,
  });
  const page = await app.firstWindow();
  await page.waitForSelector('.video-card');
  return page;
}
test.afterEach(async () => {
  if (app) await app.close();
});
test('desktop window, navigation, collections, filtering, settings and restart persistence', async () => {
  let page = await launch();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByRole('heading', { name: 'Made for your curiosity' })).toBeVisible();
  await expect(page.locator('.demo-notice')).toContainText('Demo Mode');
  await expect(page.getByTestId('video-card')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/home-dark.png' });
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByTestId('video-card')).toHaveCount(6);
  const first = page.getByTestId('video-card').first();
  await first.getByLabel('More options for Big Buck Bunny').click();
  await first.getByRole('button', { name: 'Add to Watch Later' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Watch Later' })
    .click();
  await expect(page.getByTestId('video-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mark watched' }).click();
  await expect(page.getByRole('button', { name: 'Watched', exact: true })).toBeVisible();
  await page
    .getByTestId('video-card')
    .first()
    .getByLabel('More options for Big Buck Bunny')
    .click();
  await page.getByRole('button', { name: 'Add to playlist', exact: true }).click();
  await page.getByLabel('Playlist name').fill('Weekend discoveries');
  await page.getByRole('button', { name: 'Create & add' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Playlists', exact: true })
    .click();
  await page.getByRole('button', { name: /Weekend discoveries.*1 video/ }).click();
  await expect(page.getByRole('heading', { name: 'Weekend discoveries' })).toBeVisible();
  await page.getByRole('button', { name: 'Rename playlist' }).click();
  await page.getByLabel('Playlist name').fill('Creative weekends');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('heading', { name: 'Creative weekends' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Big Buck Bunny', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Big Buck Bunny', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start YouTube player' })).toBeVisible();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('copied');
  await page.getByRole('button', { name: 'Find related videos' }).click();
  await expect(page.getByTestId('video-card')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/video-page.png' });
  await page.keyboard.press('Control+k');
  await expect(page.getByLabel('Search YouTube')).toBeFocused();
  await page.getByLabel('Search YouTube').fill('Sintel');
  await page.getByLabel('Search YouTube').press('Enter');
  await expect(page.getByTestId('video-card')).toHaveCount(1);
  await page.getByLabel('Search type').selectOption('channel');
  await expect(
    page.getByText('Demo Mode includes video samples only.', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Search type').selectOption('video');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Explore', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Explore a little further' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Downloads', exact: true })
    .click();
  await expect(
    page.getByText('Luma does not download YouTube video or audio.', { exact: false }),
  ).toBeVisible();
  await page
    .locator('.sidebar-bottom')
    .getByRole('button', { name: /Settings/ })
    .click();
  await page.getByLabel('Theme', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('Manage filters', { exact: false }).click();
  await expect(page.getByText('Sample sponsored card is hidden by your rules.')).toBeVisible();
  await page.getByRole('switch', { name: 'Ad & Content Filtering', exact: true }).click();
  await expect(page.locator('[data-promotion="sponsored"]')).toBeVisible();
  await page.getByRole('switch', { name: 'Ad & Content Filtering', exact: true }).click();
  await page.getByRole('switch', { name: 'Advanced filtering', exact: true }).click();
  await page
    .getByLabel('Filter rules JSON')
    .fill(
      JSON.stringify([
        { id: 'test', kind: 'text', value: 'Big Buck Bunny', action: 'block', enabled: true },
      ]),
    );
  await page.getByRole('button', { name: 'Save rules', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Filter rules saved');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Home', exact: true })
    .click();
  await expect(page.getByTestId('video-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Play Big Buck Bunny', exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({ path: 'test-results/home-light-filtered.png' });
  const state = await page.evaluate(async () => {
    const reply = await window.luma.request<Snapshot>({ op: 'snapshot' });
    if (!reply.ok) throw new Error(reply.error);
    return reply.data;
  });
  expect(state.watchLater[0].watched).toBe(true);
  expect(state.playlists[0].name).toBe('Creative weekends');
  expect(state.searches).toContain('Sintel');
  // Exercise actual renderer-to-main IPC and SQLite history without depending on remote playback.
  await page.evaluate(async (video) => {
    const reply = await window.luma.request({ op: 'history', video, position: 42 });
    if (!reply.ok) throw new Error(reply.error);
  }, state.watchLater[0]);
  await page.reload();
  await page.waitForSelector('.video-card');
  await page.keyboard.press('Control+h');
  await expect(page.getByText('Continue watching', { exact: true })).toBeVisible();
  const secure = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const p = (
      win.webContents as unknown as {
        getLastWebPreferences: () => {
          sandbox: boolean;
          contextIsolation: boolean;
          nodeIntegration: boolean;
        };
      }
    ).getLastWebPreferences();
    return {
      visible: win.isVisible(),
      sandbox: p.sandbox,
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
    };
  });
  expect(secure).toEqual({
    visible: true,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
  });
  expect(readFileSync(join(dataDir, 'library.sqlite')).subarray(0, 15).toString()).toBe(
    'SQLite format 3',
  );
  await app.close();
  page = await launch();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Watch Later' })
    .click();
  await expect(page.getByRole('button', { name: 'Watched', exact: true })).toBeVisible();
  await page.keyboard.press('Control+h');
  await expect(page.getByText('Continue watching', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('Verified persisted SQLite library:', dataDir);
});
