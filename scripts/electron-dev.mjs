// Dev launcher for the Electron (Steam) build.
//
// Starts the Vite dev server, waits for it to answer, then launches Electron
// pointed at it via ELECTRON_START_URL. Killing Electron tears down Vite too.
// Avoids adding a `concurrently`/`wait-on` dependency for this one task.

import { spawn } from 'node:child_process';
import process from 'node:process';

const DEV_URL = 'http://localhost:8080';
// On Windows, Node 22 refuses to spawn .cmd shims directly (EINVAL) unless
// shell:true is used. Let the shell resolve `npm`/`npx` to their .cmd wrappers.
const useShell = true;

const children = [];
function shutdown(code = 0) {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Vite dev server did not respond at ${url} within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const vite = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: useShell });
children.push(vite);
vite.on('exit', (code) => shutdown(code ?? 0));

try {
  await waitForServer(DEV_URL);
} catch (err) {
  console.error(err.message);
  shutdown(1);
}

const electron = spawn(
  'npx',
  ['electron', '.'],
  {
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, ELECTRON_START_URL: DEV_URL },
  },
);
children.push(electron);
electron.on('exit', (code) => shutdown(code ?? 0));
