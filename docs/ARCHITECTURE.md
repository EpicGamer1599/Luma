# Architecture

Luma has three boundaries:

1. React renderer: views, accessibility, visual filtering, official IFrame Player API.
2. Sandboxed preload: one `request` method through contextBridge; no Node objects or generic channel access.
3. Main process: validated IPC, SQL.js SQLite, OS key encryption, official Data API requests, lifecycle and external links.

All request variants live in `src/shared/types.ts`. `electron/security.ts` validates their shape and main-frame identity. Results use an `{ok,data}` / `{ok,error}` envelope so internal exceptions do not become UI stack traces.

Production assets are served by a static HTTP server bound to 127.0.0.1 on an ephemeral port. This gives the official player a normal browser origin and Referer. The server is read-only, restricts paths to the packaged `dist` directory, and cannot access IPC or library data. The app never proxies YouTube media. Development uses Vite on 127.0.0.1:5173 with a development-only CSP allowance for React refresh.

The YouTube client performs explicit user-triggered requests with a 15-second timeout and no polling. Search results are hydrated through videos.list to get durations and view counts. The old relatedToVideoId API is not used; related topic matches are requested only by clicking the related button. Cache entries expire after ten minutes and are bounded to 100.

SQLite schema version 1 contains videos, history, watch_later, playlists, playlist_items, settings, search_history, filter_rules, and hidden. Queries use prepared binding. A write takes a rollback snapshot, runs a transaction, and atomically replaces the disk file. Exporting SQL.js resets connection pragmas, so foreign-key enforcement is explicitly restored after every export. Unknown future schemas fail safely. Corrupt files are copied to a timestamped backup before a fresh library is initialized.

Filtering uses a pure matching engine. A content descriptor contains text, URL, and optionally an app-owned promotion category. Allow rules override block rules. Safe glob matching avoids user regular-expression execution; restricted cosmetic rules are evaluated against descriptors rather than injected as CSS. Rules never reach Electron's request interception or the cross-origin player.

Updates deliberately stop at release discovery. A future updater must use a maintained verified distribution mechanism, signed releases, explicit channel selection, and rollback planning; it must not execute arbitrary downloaded scripts.

Reference documentation:

- https://www.electronjs.org/docs/latest/tutorial/security
- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/required-minimum-functionality
