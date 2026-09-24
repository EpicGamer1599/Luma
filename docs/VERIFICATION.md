# Verification record

Verified on Windows x64 on 24 September 2026 using Node.js 22.15.1 and Electron 44.4.5.

## Completed

- Installed dependencies with npm and recorded dependency resolution in `package-lock.json`.
- Ran `npm run dev`; the Electron window opened with the Luma title and the Vite server returned HTTP 200.
- `npm run typecheck`: passed with strict mode and unused-symbol checks.
- `npm test`: 28 tests passed across six test files.
- Real Electron integration test: opened the desktop window, browsed demo pages, paginated sample metadata, searched, used filters, saved Watch Later, marked an item watched, created/renamed a playlist, opened a video page, copied a link, requested related samples, navigated all sidebar pages, changed theme, applied content rules, recorded history through validated IPC, and restarted with persisted data.
- Repeated the integration test against `release/win-unpacked/Luma.exe`: passed. The test also checks window visibility, context isolation, sandboxing, disabled Node integration, and the on-disk SQLite file signature.
- Live official YouTube playback: the Big Buck Bunny sample loaded in the actual YouTube IFrame Player and played. A real playback position was recorded in SQLite. This used no Data API key. The player was visually inspected; no YouTube media was downloaded to a file.
- Dark and light UI screenshots inspected. Bundled demo artwork, logo, video page, and layout rendered correctly.
- `npm run build`: produced an unsigned Windows NSIS installer and unpacked application.
- `npm audit --omit=dev`: reported zero known production-dependency vulnerabilities at verification time.

A test originally sent Ctrl+H immediately after reload, before React finished mounting. It now waits for the interface to be ready. Database tests caught missing foreign-key restoration after SQL.js export and incomplete multi-statement reset execution; both were corrected and retested.

## Scope and limitations

- No real YouTube Data API key was provided. Live authenticated API discovery/search, actual project quota settings, and API-key restrictions were not exercised against Google. Parsing, filters, pagination, caching, quota/key/offline failures, channels, and playlists are verified with controlled API responses.
- Player shortcuts, initial volume/speed, history events, and embedding-error UI are tested with an IFrame API mock. Live audiovisual playback and real position recording were observed separately. Arbitrary videos, every restriction type, all network environments, and all player control combinations are not certified.
- The installer was built and the packaged executable tested. Installation/uninstallation on a fresh Windows VM was not performed. No signing certificate was supplied; the installer is unsigned.
- macOS/Linux packaging and OS key-storage backends were not tested. Their configuration is a starting point for platform verification.
- GitHub Actions are supplied but have not run on a hosted repository. No repository was published or release uploaded. The release checker needs the eventual public repository name and a published release.
- No audiovisual downloading, YouTube ad blocking, account sync, or automatic update installation is implemented.

## Repeat the checks

```sh
npm ci
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Use the README's `LUMA_TEST_EXE` example to test the packaged executable. `node scripts/check-player.mjs` is an optional network-dependent diagnostic that opens the real official player and prints its observed state; run `npm run compile` first. It is not part of offline CI.

Test databases use isolated temporary directories. Test screenshots and traces are written to ignored `test-results/`. Close any app before backing up its SQLite database.
