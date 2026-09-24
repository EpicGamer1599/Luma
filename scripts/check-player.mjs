import { _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const env = {
  ...process.env,
  LUMA_DATA_DIR: mkdtempSync(join(tmpdir(), 'luma-player-')),
  YOUTUBE_API_KEY: '',
  LUMA_DEV_URL: '',
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
try {
  const page = await app.firstWindow();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('Renderer:', m.text().slice(0, 400));
  });
  page.on('pageerror', (e) => console.log('Page error:', e.message));
  await page.getByRole('button', { name: 'Play Big Buck Bunny', exact: true }).click();
  await page.getByRole('button', { name: 'Start YouTube player', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('iframe') || document.querySelector('.player-error'),
    undefined,
    { timeout: 25000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 12000));
  console.log(
    'Player frame:',
    await page
      .locator('iframe')
      .getAttribute('src')
      .catch(() => null),
  );
  console.log(
    'Player error:',
    (await page.locator('.player-error').count())
      ? await page.locator('.player-error').textContent()
      : null,
  );
  console.log(
    'History:',
    await page.evaluate(async () => {
      const r = await window.luma.request({ op: 'snapshot' });
      return r.ok ? r.data.history.map((v) => ({ id: v.id, position: v.position })) : r;
    }),
  );
  console.log(
    'Frame text:',
    await page
      .frames()
      .find((f) => f.url().startsWith('https://www.youtube.com/embed'))
      ?.locator('body')
      .innerText()
      .catch(() => ''),
  );
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/official-player.png' });
} finally {
  await app.close();
}
