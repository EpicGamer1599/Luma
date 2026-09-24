# Security

Luma is a desktop application with a sandboxed renderer and a narrow validated IPC boundary. Keep Electron and dependencies current when publishing releases.

If you discover a vulnerability, do not post credentials, exploitable private data, or a working exploit in a public issue. Use the published repository's private vulnerability reporting feature if enabled. Repository maintainers should enable that feature under Settings → Security before a public release. No security contact or hosted repository is fabricated in this source tree.

Scope of protections:

- Context isolation, renderer sandbox, Node integration disabled, restrictive production CSP.
- IPC limited to named operations with origin/frame checks and schema validation.
- HTTPS external-link allowlist; no arbitrary shell execution or URL opening.
- User API keys stored with OS encryption where available and never returned to the renderer.
- SQL parameters for all user data, schema version check, transactional writes, atomic file replacement.
- Rule files contain data only, not executable CSS or JavaScript. Cosmetic rules cannot target a player.

No automatic updater or downloaded code execution is implemented. Release checking only reads public GitHub release metadata. Unsigned builds are for development/community distribution; publishers should configure trusted signing.

Local database metadata is not encrypted. Protect the operating-system account and backups. API keys embedded in a desktop app cannot be kept secret from the computer's owner.
