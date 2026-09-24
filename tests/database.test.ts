import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryDatabase } from '../electron/database/library';
import { demoVideos } from '../src/shared/demo';
import { defaultRules } from '../src/filtering/engine';
const dirs: string[] = [];
const dbs: LibraryDatabase[] = [];
async function open(path?: string) {
  const db = await LibraryDatabase.open(path);
  dbs.push(db);
  return db;
}
afterEach(() => {
  for (const db of dbs.splice(0))
    try {
      db.close();
    } catch {}
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
describe('SQLite library', () => {
  it('writes a real SQLite file and persists settings, history and collections across restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'luma-test-'));
    dirs.push(dir);
    const file = join(dir, 'library.sqlite');
    const db = await open(file);
    db.updateSettings({ theme: 'light', volume: 42 });
    db.recordHistory(demoVideos[0], 91);
    db.addWatchLater(demoVideos[1]);
    const id = db.createPlaylist('Weekend');
    db.addToPlaylist(id, demoVideos[0]);
    db.close();
    dbs.pop();
    expect(readFileSync(file).subarray(0, 15).toString()).toBe('SQLite format 3');
    const restored = await open(file);
    expect(restored.settings()).toMatchObject({ theme: 'light', volume: 42 });
    expect(restored.history()[0].position).toBe(91);
    expect(restored.watchLater()[0].id).toBe(demoVideos[1].id);
    expect(restored.playlistItems(id)[0].id).toBe(demoVideos[0].id);
  });
  it('upserts history, respects privacy, removes and clears history', async () => {
    const db = await open();
    db.recordHistory(demoVideos[0], 12);
    db.recordHistory(demoVideos[0], 55);
    expect(db.history()).toHaveLength(1);
    expect(db.history()[0].position).toBe(55);
    db.updateSettings({ historyEnabled: false });
    db.recordHistory(demoVideos[1], 4);
    expect(db.history()).toHaveLength(1);
    db.remove('history', demoVideos[0].id);
    expect(db.history()).toHaveLength(0);
    db.updateSettings({ historyEnabled: true });
    db.recordHistory(demoVideos[1], 2);
    db.clear('history');
    expect(db.history()).toHaveLength(0);
  });
  it('deduplicates, reorders and marks Watch Later items', async () => {
    const db = await open();
    db.addWatchLater(demoVideos[0]);
    db.addWatchLater(demoVideos[1]);
    db.addWatchLater(demoVideos[0]);
    expect(db.watchLater()).toHaveLength(2);
    db.reorder('watchLater', [demoVideos[1].id, demoVideos[0].id]);
    db.watched(demoVideos[1].id, true);
    expect(db.watchLater()[0]).toMatchObject({ id: demoVideos[1].id, watched: true });
    expect(() => db.reorder('watchLater', [demoVideos[0].id, demoVideos[0].id])).toThrow(
      'list changed',
    );
    db.remove('watchLater', demoVideos[0].id);
    expect(db.watchLater()).toHaveLength(1);
    db.clear('watchLater');
    expect(db.watchLater()).toHaveLength(0);
  });
  it('renames, reorders, deletes playlists without deleting videos from other lists', async () => {
    const db = await open();
    const id = db.createPlaylist("Robert'); DROP TABLE videos;--");
    db.addToPlaylist(id, demoVideos[0]);
    db.addToPlaylist(id, demoVideos[1]);
    db.addToPlaylist(id, demoVideos[0]);
    db.addWatchLater(demoVideos[0]);
    db.renamePlaylist(id, 'Favorites');
    expect(db.playlists()[0]).toMatchObject({ name: 'Favorites', count: 2 });
    db.reorder('playlist', [demoVideos[1].id, demoVideos[0].id], id);
    expect(db.playlistItems(id)[0].id).toBe(demoVideos[1].id);
    db.remove('playlist', demoVideos[1].id, id);
    db.deletePlaylist(id);
    expect(db.playlistItems(id)).toEqual([]);
    expect(db.watchLater()).toHaveLength(1);
  });
  it('rolls back a failed transaction', async () => {
    const db = await open();
    expect(() => db.addToPlaylist(999, demoVideos[0])).toThrow();
    expect(db.video(demoVideos[0].id)).toBeUndefined();
    db.addWatchLater(demoVideos[1]);
    expect(db.watchLater()).toHaveLength(1);
  });
  it('limits search history, handles disabled recording and persists rules', async () => {
    const db = await open();
    for (let i = 0; i < 35; i++) db.addSearch(`query-${i}`);
    expect(db.searches()).toHaveLength(30);
    db.updateSettings({ searchHistoryEnabled: false });
    db.addSearch('private');
    expect(db.searches()).not.toContain('private');
    db.setRules([]);
    expect(db.rules()).toEqual([]);
    db.clear('searches');
    expect(db.searches()).toEqual([]);
    db.hide(demoVideos[0].id);
    db.clear('all');
    expect(db.hidden()).toEqual([]);
    expect(db.rules()).toEqual(defaultRules);
    expect(db.settings().theme).toBe('dark');
  });
  it('preserves corrupt data and initializes a fresh usable database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'luma-corrupt-'));
    dirs.push(dir);
    const file = join(dir, 'library.sqlite');
    writeFileSync(file, 'broken sqlite file');
    const db = await open(file);
    expect(db.recovery).toContain('preserved');
    expect(readdirSync(dir).some((name) => name.includes('.corrupt-'))).toBe(true);
    db.addWatchLater(demoVideos[0]);
    expect(db.watchLater()).toHaveLength(1);
  });
  it('rejects invalid settings without modifying saved preferences', async () => {
    const db = await open();
    expect(() => db.updateSettings({ volume: 101 })).toThrow();
    expect(db.settings().volume).toBe(70);
  });
});
