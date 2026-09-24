# Publishing a release

1. Choose your repository owner/name and unique application identity. The supplied `org.luma.youtubeclient` is the project's default app ID; avoid collisions if forking under a different product name.
2. Set repository metadata in package.json and update the README clone URL. Set Settings → About to the public `owner/repository` to enable release checks.
3. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` on a clean Windows machine.
4. Test the unpacked app using `LUMA_TEST_EXE`, then manually install/uninstall the NSIS artifact on a fresh Windows VM. Confirm local persistence, official playback, live API search with your own key, and restricted-video errors.
5. Configure trusted code signing with electron-builder's supported signing configuration. The default `win.signExecutable` is false to allow unsigned development builds; enable it for signed production builds. Never add certificate files or passwords to Git. Use appropriately scoped CI secrets for signing only.
6. Before distributing a YouTube API client, review current Google API terms, branding, client identification and data-retention requirements. Check your API project configuration and app ID. Test official embedding using your installed product identity.
7. Bump package.json and lockfile versions together. Create a GitHub release with a matching stable `vX.Y.Z` tag, publish signed installer artifacts and checksums, and document changes.

The Windows workflow creates installer artifacts; it does not publish or request signing credentials. The About screen compares numeric stable versions with the latest published GitHub release. Prerelease channels and automatic installation are intentionally absent.

For macOS, build/sign/notarize on macOS; for Linux, validate AppImage packaging and desktop integration on a supported distribution. Those platforms are configured but not certified by the Windows verification run.
