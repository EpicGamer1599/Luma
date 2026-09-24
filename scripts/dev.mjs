import { createServer } from 'vite';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import electron from 'electron';
await build({
  entryPoints: ['electron/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-electron/main.cjs',
  external: ['electron', 'sql.js'],
  sourcemap: true,
});
await build({
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-electron/preload.cjs',
  external: ['electron'],
});
const server = await createServer();
await server.listen();
const env = { ...process.env, LUMA_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
