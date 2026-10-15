import { unlinkSync, writeFileSync } from 'node:fs';
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
        reject(new Error('Could not reserve a TCP port for the Firestore Emulator.'));
        return;
      }
      resolve({ port: address.port, server });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function run(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: process.cwd(), stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Rules test runner exited from signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const [firestoreReservation, hubReservation] = await Promise.all([reservePort(), reservePort()]);
  const configPath = join(process.cwd(), `.firebase-rules-test-${process.pid}-${Date.now()}.json`);
  const config = {
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    emulators: {
      firestore: { host: '127.0.0.1', port: firestoreReservation.port },
      hub: { host: '127.0.0.1', port: hubReservation.port },
      ui: { enabled: false }
    }
  };

  await Promise.all([closeServer(firestoreReservation.server), closeServer(hubReservation.server)]);
  writeFileSync(configPath, JSON.stringify(config));
  try {
    const firebaseCli = join(process.cwd(), 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    const exitCode = await run(process.execPath, [
      firebaseCli,
      '--config', configPath,
      'emulators:exec',
      '--only', 'firestore',
      '--project', 'markmap-aws-rules',
      'vitest run --config vitest.rules.config.ts'
    ]);
    process.exitCode = exitCode;
  } finally {
    unlinkSync(configPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
