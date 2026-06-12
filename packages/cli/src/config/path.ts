import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

export function wattzHome(): string {
  return process.env.WATTZ_HOME ?? join(homedir(), '.wattz');
}

export function configPath(): string {
  return join(wattzHome(), 'config.json');
}

export function keypairPath(): string {
  return join(wattzHome(), 'keypair.json');
}

export function nodeStatePath(): string {
  return join(wattzHome(), 'node-state.json');
}

export function logPath(): string {
  return join(wattzHome(), 'wattz.log');
}

export async function ensureHome(): Promise<string> {
  const home = wattzHome();
  await mkdir(home, { recursive: true, mode: 0o700 });
  return home;
}
