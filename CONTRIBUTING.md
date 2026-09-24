# Contributing to Luma

Use Node.js 22.12+ and `npm install`. Start the desktop app with `npm run dev`.

Before submitting a pull request:

1. Explain the user-facing problem and keep the change focused.
2. Preserve strict TypeScript types and validate every new IPC operation in `src/shared/types.ts`.
3. Keep privileged filesystem/network operations in the main process. Never expose arbitrary Electron or Node methods to the renderer.
4. Add meaningful tests for changed behavior. Tests must work without API keys.
5. Run `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` on Windows.
6. Inspect dark/light layouts and keyboard access when changing UI.

Never commit credentials, local databases, build outputs, or user data. Use `.env.example` for configuration names only. Update README and migration documentation when changing behavior or persistence.

Database schema changes must increment `PRAGMA user_version` and provide a transactional forward migration. Existing user libraries and corrupt-file backups must be preserved.

Luma does not download YouTube media, block embedded-player ads, circumvent restrictions, or synchronize accounts. Changes must maintain these boundaries. Filtering belongs exclusively to app-owned content.

For bugs, provide OS, Luma version, reproduction steps, and a screenshot if relevant. Redact API keys and personal library data. See SECURITY.md for sensitive issues.
