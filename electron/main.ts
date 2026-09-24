import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  clipboard,
  safeStorage,
  dialog,
  session,
} from 'electron';
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { config } from 'dotenv';
import { LibraryDatabase } from './database/library';
import { YouTubeClient, YouTubeError } from './youtube/client';
import { allowedExternal, isTrustedSender, validateRequest } from './security';
import { youtubeUrl, type Snapshot } from '../src/shared/types';
import { z } from 'zod';
config({ quiet: true } as Parameters<typeof config>[0]);
if (process.env.LUMA_DATA_DIR) app.setPath('userData', resolve(process.env.LUMA_DATA_DIR));
let db: LibraryDatabase;
let youtube: YouTubeClient;
let server: Server | undefined;
let origin = '';
let window: BrowserWindow | undefined;
const dev = !app.isPackaged && process.env.LUMA_DEV_URL === 'http://127.0.0.1:5173';
const csp = `default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com${dev ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com https://i1.ytimg.com https://i2.ytimg.com https://i3.ytimg.com https://i4.ytimg.com; frame-src https://www.youtube.com; connect-src 'self'${dev ? ' ws://127.0.0.1:5173' : ''}; object-src 'none'; base-uri 'self'; form-action 'self'`;
async function serve(): Promise<string> {
  return new Promise((resolveServer, reject) => {
    const root = resolve(app.getAppPath(), 'dist');
    server = createServer((req, res) => {
      try {
        if (!req.headers.host?.startsWith('127.0.0.1:')) {
          res.writeHead(403).end();
          return;
        }
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        let name = decodeURIComponent(url.pathname);
        if (name === '/') name = '/index.html';
        const path = resolve(root, `.${name}`);
        if (!path.startsWith(root + sep) || !existsSync(path)) {
          res.writeHead(404).end();
          return;
        }
        const mime: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, {
          'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
          'Content-Security-Policy': csp,
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        });
        res.end(readFileSync(path));
      } catch {
        res.writeHead(400).end();
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      if (address && typeof address !== 'string') resolveServer(`http://127.0.0.1:${address.port}`);
    });
  });
}
function snapshot(): Snapshot {
  return {
    settings: db.settings(),
    history: db.history(),
    watchLater: db.watchLater(),
    playlists: db.playlists(),
    searches: db.searches(),
    hidden: db.hidden(),
    rules: db.rules(),
    hasApiKey: youtube.hasKey,
    version: app.getVersion(),
    recovery: db.recovery,
  };
}
function savedKey(): string {
  const encrypted = db.getSetting('apiKey');
  if (typeof encrypted === 'string' && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      db.recovery =
        'The saved API key could not be decrypted on this computer. Add it again in Settings.';
    }
  }
  return process.env.YOUTUBE_API_KEY ?? '';
}
async function checkUpdates() {
  const repository = db.settings().repository;
  if (!repository)
    return { message: 'Set your published GitHub repository in Settings to check releases.' };
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new YouTubeError('Could not reach GitHub. Check your connection.');
  }
  if (response.status === 404)
    return { message: 'This repository has no published release yet, or it is not public.' };
  if (!response.ok) throw new YouTubeError('GitHub could not check releases. Try again later.');
  const release = z
    .object({ tag_name: z.string(), html_url: z.string() })
    .parse(await response.json());
  const version = release.tag_name.replace(/^v/, '');
  const parts = (v: string) => v.split('.').map(Number);
  const a = parts(version),
    b = parts(app.getVersion());
  const newer =
    /^\d+\.\d+\.\d+$/.test(version) &&
    a.some((n, i) => n > b[i] && a.slice(0, i).every((v, j) => v === b[j]));
  return {
    message: newer
      ? `Luma ${version} is available. Review the release on GitHub.`
      : `You are up to date (${app.getVersion()}).`,
    url: newer && allowedExternal(release.html_url) ? release.html_url : undefined,
  };
}
function registerIPC() {
  ipcMain.handle('luma:request', async (event, input: unknown) => {
    try {
      if (
        !window ||
        event.sender !== window.webContents ||
        !isTrustedSender(
          event.senderFrame?.url ?? '',
          origin,
          event.senderFrame === window.webContents.mainFrame,
        )
      )
        throw new Error('Untrusted request.');
      const r = validateRequest(input);
      let data: unknown = null;
      switch (r.op) {
        case 'snapshot':
          data = snapshot();
          break;
        case 'search':
          data = await youtube.search(r.input, db.settings().demo);
          db.addSearch(r.input.q);
          break;
        case 'video':
          data = await youtube.video(r.id, db.settings().demo);
          break;
        case 'settings':
          db.updateSettings(r.patch);
          break;
        case 'apiKey':
          if (r.key) {
            if (
              !safeStorage.isEncryptionAvailable() ||
              safeStorage.getSelectedStorageBackend?.() === 'basic_text'
            )
              throw new YouTubeError(
                'Secure key storage is unavailable. Configure YOUTUBE_API_KEY in your local .env file instead.',
              );
            db.setSetting('apiKey', safeStorage.encryptString(r.key).toString('base64'));
          } else db.setSetting('apiKey', null);
          youtube.setKey(r.key || process.env.YOUTUBE_API_KEY || '');
          break;
        case 'history':
          db.recordHistory(r.video, r.position);
          break;
        case 'watchLater':
          db.addWatchLater(r.video);
          break;
        case 'remove':
          db.remove(r.list, r.id, r.playlistId);
          break;
        case 'watched':
          db.watched(r.id, r.value);
          break;
        case 'reorder':
          db.reorder(r.list, r.ids, r.playlistId);
          break;
        case 'playlistCreate':
          data = db.createPlaylist(r.name);
          break;
        case 'playlistRename':
          db.renamePlaylist(r.id, r.name);
          break;
        case 'playlistDelete':
          db.deletePlaylist(r.id);
          break;
        case 'playlistItems':
          data = db.playlistItems(r.id);
          break;
        case 'playlistAdd':
          db.addToPlaylist(r.id, r.video);
          break;
        case 'hide':
          db.hide(r.id);
          break;
        case 'clear':
          db.clear(r.target);
          if (r.target === 'all') {
            youtube.setKey(process.env.YOUTUBE_API_KEY ?? '');
            db.recovery = undefined;
            await session.defaultSession.clearStorageData();
            await session.defaultSession.clearCache();
          }
          break;
        case 'rules':
          db.setRules(r.rules);
          break;
        case 'external':
          if (!allowedExternal(r.url)) throw new Error('This external link is not supported.');
          await shell.openExternal(r.url);
          break;
        case 'copy':
          clipboard.writeText(youtubeUrl(r.id));
          break;
        case 'updates':
          data = await checkUpdates();
          break;
      }
      return { ok: true, data };
    } catch (error) {
      const message =
        error instanceof YouTubeError
          ? error.message
          : error instanceof Error &&
              /invalid|Choose a playlist|list changed|newer Luma|saved setting|Saved preferences/i.test(
                error.message,
              )
            ? error.message
            : 'The action could not be completed. Your local data may be unavailable or the input is invalid. Please try again or restart Luma.';
      return { ok: false, error: message };
    }
  });
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 880,
    minHeight: 640,
    title: 'Luma',
    backgroundColor: '#101114',
    icon: join(app.getAppPath(), 'build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (allowedExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.on('closed', () => {
    window = undefined;
  });
  await window.loadURL(origin);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    window?.restore();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      db = await LibraryDatabase.open(
        join(app.getPath('userData'), 'library.sqlite'),
        app.isPackaged
          ? join(process.resourcesPath, 'sql-wasm.wasm')
          : join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      );
      youtube = new YouTubeClient(savedKey());
      if (!db.getSetting('configured')) {
        db.updateSettings({
          demo: !youtube.hasKey,
          repository: process.env.LUMA_GITHUB_REPOSITORY ?? '',
        });
        db.setSetting('configured', true);
      }
      session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
        callback(permission === 'fullscreen'),
      );
      session.defaultSession.setPermissionCheckHandler(
        (_wc, permission) => permission === 'fullscreen',
      );
      if (dev)
        session.defaultSession.webRequest.onHeadersReceived(
          { urls: ['http://127.0.0.1:5173/*'] },
          (details, callback) =>
            callback({
              responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'Referrer-Policy': ['strict-origin-when-cross-origin'],
              },
            }),
        );
      origin = dev ? 'http://127.0.0.1:5173' : await serve();
      registerIPC();
      await createWindow();
    })
    .catch(() => {
      dialog.showErrorBox(
        'Luma could not start',
        'The local library could not be opened. Check that your user data folder is writable, and restore a backup if needed. See README troubleshooting.',
      );
      app.quit();
    });
  app.on('activate', () => {
    if (!window && db) void createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('will-quit', () => {
    db?.close();
    server?.close();
  });
}
