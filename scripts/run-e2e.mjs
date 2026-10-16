import { rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve a local Firebase Emulator port.'));
        return;
      }
      resolve({ port: address.port, server });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function run(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: process.cwd(), stdio: 'inherit', env: environment });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        reject(new Error(`E2E runner exited from signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const [firestoreReservation, authReservation, hubReservation] = await Promise.all([
    reservePort(), reservePort(), reservePort()
  ]);
  const configPath = join(process.cwd(), `.firebase-e2e-${process.pid}-${Date.now()}.json`);
  const config = {
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    emulators: {
      auth: { host: '127.0.0.1', port: authReservation.port },
      firestore: { host: '127.0.0.1', port: firestoreReservation.port },
      hub: { host: '127.0.0.1', port: hubReservation.port },
      ui: { enabled: false }
    }
  };
  await Promise.all([
    closeServer(firestoreReservation.server), closeServer(authReservation.server), closeServer(hubReservation.server)
  ]);
  writeFileSync(configPath, JSON.stringify(config));

  const environment = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: '0',
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authReservation.port}`,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestoreReservation.port}`,
    VITE_FIREBASE_API_KEY: 'e2e-api-key',
    VITE_FIREBASE_AUTH_DOMAIN: '127.0.0.1',
    VITE_FIREBASE_PROJECT_ID: 'markmap-aws-e2e',
    VITE_FIREBASE_APP_ID: '1:1234567890:web:e2e',
    VITE_FIREBASE_USE_EMULATORS: 'true',
    VITE_FIREBASE_AUTH_EMULATOR_URL: `http://127.0.0.1:${authReservation.port}`,
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: String(firestoreReservation.port),
    VITE_E2E_APPROVED_EMAIL: 'approved@example.test',
    VITE_E2E_DENIED_EMAIL: 'denied@example.test',
    VITE_E2E_AUTH_PASSWORD: 'e2e-password-123'
  };

  try {
    const firebaseCli = join(process.cwd(), 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    const exitCode = await run(process.execPath, [
      firebaseCli,
      '--config', configPath,
      'emulators:exec',
      '--only', 'auth,firestore',
      '--project', 'markmap-aws-e2e',
      'npm run build -- --mode e2e && playwright test'
    ], environment);
    process.exitCode = exitCode;
  } finally {
    rmSync(configPath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
