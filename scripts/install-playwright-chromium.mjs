import { spawn } from 'node:child_process';
import { join } from 'node:path';

const child = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' }
});

child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal !== null) {
    console.error(`Playwright browser installation exited from signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
