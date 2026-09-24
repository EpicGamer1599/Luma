import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  defaultSettings,
  settingsSchema,
  videoSchema,
  rulesSchema,
  type Settings,
  type Video,
  type LibraryItem,
  type Playlist,
  type FilterRule,
} from '../../src/shared/types';
import { defaultRules } from '../../src/filtering/engine';
const schema = `
CREATE TABLE IF NOT EXISTS videos(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS history(video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE, position REAL NOT NULL DEFAULT 0, last_watched TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS watch_later(video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL, watched INTEGER NOT NULL DEFAULT 0, added_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playlists(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playlist_items(playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE, video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(playlist_id,video_id));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS search_history(query TEXT PRIMARY KEY, searched_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS filter_rules(id TEXT PRIMARY KEY, rule TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hidden(video_id TEXT PRIMARY KEY);
PRAGMA user_version = 1;`;
export class LibraryDatabase {
  private db: Database;
  recovery?: string;
  private constructor(
    private SQL: SqlJsStatic,
    private file?: string,
  ) {
    let bytes: Uint8Array | undefined;
    if (file && existsSync(file)) bytes = readFileSync(file);
    try {
      this.db = new SQL.Database(bytes);
      const integrity = this.db.exec('PRAGMA integrity_check');
      if (integrity[0]?.values[0]?.[0] !== 'ok') throw new Error('Integrity check failed');
    } catch {
      if (!file) throw new Error('Could not initialize local data.');
      const backup = `${file}.corrupt-${Date.now()}`;
      copyFileSync(file, backup);
      this.db = new SQL.Database();
      this.recovery = `Damaged local data was preserved at ${backup}. A fresh library has been created.`;
    }
    const version = Number(this.db.exec('PRAGMA user_version')[0]?.values[0]?.[0] ?? 0);
    if (version > 1)
      throw new Error('This library was created by a newer Luma version. Please upgrade Luma.');
    this.db.run('PRAGMA foreign_keys = ON');
    this.db.run(schema);
    if (!this.getSetting('initialized'))
      this.transaction(() => {
        this.setRaw('initialized', true);
        this.setRaw('preferences', defaultSettings);
        for (const rule of defaultRules)
          this.run('INSERT INTO filter_rules VALUES (?,?)', [rule.id, JSON.stringify(rule)]);
      });
  }
  static async open(file?: string, wasmPath?: string) {
    const SQL = await initSqlJs(wasmPath ? { locateFile: () => wasmPath } : undefined);
    return new LibraryDatabase(SQL, file);
  }
  private run(sql: string, args: SqlValue[] = []) {
    this.db.run(sql, args);
  }
  private rows(sql: string, args: SqlValue[] = []): Record<string, SqlValue>[] {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(args);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }
  private flush() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    const bytes = this.db.export();
    this.db.run('PRAGMA foreign_keys = ON');
    writeFileSync(temp, bytes, { mode: 0o600 });
    renameSync(temp, this.file);
  }
  private transaction<T>(fn: () => T): T {
    const before = this.db.export();
    this.db.run('PRAGMA foreign_keys = ON');
    try {
      this.db.run('BEGIN');
      const value = fn();
      this.db.run('COMMIT');
      this.flush();
      return value;
    } catch (error) {
      this.db.close();
      this.db = new this.SQL.Database(before);
      this.db.run('PRAGMA foreign_keys = ON');
      throw error;
    }
  }
  private setRaw(key: string, value: unknown) {
    this.run(
      'INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, JSON.stringify(value)],
    );
  }
  getSetting(key: string): unknown {
    const row = this.rows('SELECT value FROM settings WHERE key=?', [key])[0];
    if (!row) return undefined;
    try {
      return JSON.parse(String(row.value));
    } catch {
      throw new Error('A saved setting is damaged. Restore a backup or reset local data.');
    }
  }
  setSetting(key: string, value: unknown) {
    this.transaction(() => this.setRaw(key, value));
  }
  settings(): Settings {
    const result = settingsSchema.safeParse({
      ...defaultSettings,
      ...((this.getSetting('preferences') as object) ?? {}),
    });
    if (!result.success)
      throw new Error('Saved preferences are invalid. Restore or reset local data.');
    return result.data;
  }
  updateSettings(patch: Partial<Settings>) {
    const next = settingsSchema.parse({ ...this.settings(), ...patch });
    this.setSetting('preferences', next);
    return next;
  }
  private saveVideo(video: Video) {
    const validated = videoSchema.parse(video);
    this.run(
      'INSERT INTO videos VALUES (?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata',
      [video.id, JSON.stringify(validated)],
    );
  }
  video(id: string): Video | undefined {
    const row = this.rows('SELECT metadata FROM videos WHERE id=?', [id])[0];
    return row ? videoSchema.parse(JSON.parse(String(row.metadata))) : undefined;
  }
  recordHistory(video: Video, position: number) {
    if (!this.settings().historyEnabled) return;
    this.transaction(() => {
      this.saveVideo(video);
      this.run(
        'INSERT INTO history VALUES (?,?,?) ON CONFLICT(video_id) DO UPDATE SET position=excluded.position,last_watched=excluded.last_watched',
        [video.id, position, new Date().toISOString()],
      );
    });
  }
  addWatchLater(video: Video) {
    this.transaction(() => {
      this.saveVideo(video);
      this.run(
        'INSERT OR IGNORE INTO watch_later(video_id,sort_order,added_at) VALUES (?,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM watch_later),?)',
        [video.id, new Date().toISOString()],
      );
    });
  }
  watched(id: string, value: boolean) {
    this.transaction(() =>
      this.run('UPDATE watch_later SET watched=? WHERE video_id=?', [Number(value), id]),
    );
  }
  private decode(row: Record<string, SqlValue>): LibraryItem {
    return {
      ...videoSchema.parse(JSON.parse(String(row.metadata))),
      position: Number(row.position ?? 0),
      watched: Boolean(row.watched),
      addedAt: String(row.added_at ?? row.last_watched ?? ''),
      lastWatched: row.last_watched ? String(row.last_watched) : undefined,
    };
  }
  history(): LibraryItem[] {
    return this.rows(
      'SELECT v.metadata,h.position,h.last_watched FROM history h JOIN videos v ON v.id=h.video_id ORDER BY h.last_watched DESC',
    ).map((r) => this.decode(r));
  }
  watchLater(): LibraryItem[] {
    return this.rows(
      'SELECT v.metadata,w.watched,w.added_at FROM watch_later w JOIN videos v ON v.id=w.video_id ORDER BY w.sort_order',
    ).map((r) => this.decode(r));
  }
  playlists(): Playlist[] {
    return this.rows(
      'SELECT p.id,p.name,p.created_at,COUNT(i.video_id) AS count FROM playlists p LEFT JOIN playlist_items i ON i.playlist_id=p.id GROUP BY p.id ORDER BY p.created_at DESC',
    ).map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      count: Number(r.count),
      createdAt: String(r.created_at),
    }));
  }
  createPlaylist(name: string): number {
    return this.transaction(() => {
      this.run('INSERT INTO playlists(name,created_at) VALUES (?,?)', [
        name,
        new Date().toISOString(),
      ]);
      return Number(this.rows('SELECT last_insert_rowid() AS id')[0].id);
    });
  }
  renamePlaylist(id: number, name: string) {
    this.transaction(() => this.run('UPDATE playlists SET name=? WHERE id=?', [name, id]));
  }
  deletePlaylist(id: number) {
    this.transaction(() => this.run('DELETE FROM playlists WHERE id=?', [id]));
  }
  playlistItems(id: number): LibraryItem[] {
    return this.rows(
      'SELECT v.metadata,i.added_at FROM playlist_items i JOIN videos v ON v.id=i.video_id WHERE i.playlist_id=? ORDER BY i.sort_order',
      [id],
    ).map((r) => this.decode(r));
  }
  addToPlaylist(id: number, video: Video) {
    this.transaction(() => {
      this.saveVideo(video);
      this.run(
        'INSERT OR IGNORE INTO playlist_items VALUES (?,?,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM playlist_items WHERE playlist_id=?),?)',
        [id, video.id, id, new Date().toISOString()],
      );
    });
  }
  remove(list: 'history' | 'watchLater' | 'playlist', id: string, playlistId?: number) {
    this.transaction(() => {
      if (list === 'history') this.run('DELETE FROM history WHERE video_id=?', [id]);
      else if (list === 'watchLater') this.run('DELETE FROM watch_later WHERE video_id=?', [id]);
      else {
        if (!playlistId) throw new Error('Choose a playlist.');
        this.run('DELETE FROM playlist_items WHERE playlist_id=? AND video_id=?', [playlistId, id]);
      }
    });
  }
  reorder(list: 'watchLater' | 'playlist', ids: string[], playlistId?: number) {
    const current = list === 'watchLater' ? this.watchLater() : this.playlistItems(playlistId ?? 0);
    if (
      new Set(ids).size !== ids.length ||
      ids.length !== current.length ||
      current.some((v) => !ids.includes(v.id))
    )
      throw new Error('The list changed. Refresh it before reordering.');
    this.transaction(() => {
      ids.forEach((id, index) => {
        if (list === 'watchLater')
          this.run('UPDATE watch_later SET sort_order=? WHERE video_id=?', [index, id]);
        else
          this.run('UPDATE playlist_items SET sort_order=? WHERE playlist_id=? AND video_id=?', [
            index,
            playlistId ?? 0,
            id,
          ]);
      });
    });
  }
  addSearch(q: string) {
    if (!q || !this.settings().searchHistoryEnabled) return;
    this.transaction(() => {
      this.run(
        'INSERT INTO search_history VALUES (?,?) ON CONFLICT(query) DO UPDATE SET searched_at=excluded.searched_at',
        [q, new Date().toISOString()],
      );
      this.run(
        'DELETE FROM search_history WHERE query NOT IN (SELECT query FROM search_history ORDER BY searched_at DESC LIMIT 30)',
      );
    });
  }
  searches(): string[] {
    return this.rows('SELECT query FROM search_history ORDER BY searched_at DESC').map((r) =>
      String(r.query),
    );
  }
  hide(id: string) {
    this.transaction(() => this.run('INSERT OR IGNORE INTO hidden VALUES (?)', [id]));
  }
  hidden(): string[] {
    return this.rows('SELECT video_id FROM hidden').map((r) => String(r.video_id));
  }
  rules(): FilterRule[] {
    return rulesSchema.parse(
      this.rows('SELECT rule FROM filter_rules').map((r) => JSON.parse(String(r.rule))),
    );
  }
  setRules(rules: FilterRule[]) {
    rulesSchema.parse(rules);
    this.transaction(() => {
      this.run('DELETE FROM filter_rules');
      for (const rule of rules)
        this.run('INSERT INTO filter_rules VALUES (?,?)', [rule.id, JSON.stringify(rule)]);
    });
  }
  clear(target: 'history' | 'searches' | 'watchLater' | 'hidden' | 'all') {
    this.transaction(() => {
      switch (target) {
        case 'history':
          this.run('DELETE FROM history');
          break;
        case 'searches':
          this.run('DELETE FROM search_history');
          break;
        case 'watchLater':
          this.run('DELETE FROM watch_later');
          break;
        case 'hidden':
          this.run('DELETE FROM hidden');
          break;
        case 'all':
          this.db.exec(
            'DELETE FROM history; DELETE FROM watch_later; DELETE FROM playlist_items; DELETE FROM playlists; DELETE FROM videos; DELETE FROM search_history; DELETE FROM hidden; DELETE FROM settings; DELETE FROM filter_rules;',
          );
          this.setRaw('initialized', true);
          this.setRaw('preferences', defaultSettings);
          for (const rule of defaultRules)
            this.run('INSERT INTO filter_rules VALUES (?,?)', [rule.id, JSON.stringify(rule)]);
          break;
      }
      this.run(
        'DELETE FROM videos WHERE id NOT IN (SELECT video_id FROM history UNION SELECT video_id FROM watch_later UNION SELECT video_id FROM playlist_items)',
      );
    });
  }
  close() {
    this.db.close();
  }
}
