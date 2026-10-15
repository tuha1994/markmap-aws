export function firestoreEmulatorEndpoint(): { host: string; port: number } {
  const configured = process.env.FIRESTORE_EMULATOR_HOST;
  if (configured === undefined) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set by the Rules test runner.');
  }
  const separator = configured.lastIndexOf(':');

  if (separator === -1) {
    throw new Error(`FIRESTORE_EMULATOR_HOST must include a port: ${configured}`);
  }

  const host = configured.slice(0, separator);
  const port = Number(configured.slice(separator + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Firestore emulator endpoint: ${configured}`);
  }

  return { host, port };
}
