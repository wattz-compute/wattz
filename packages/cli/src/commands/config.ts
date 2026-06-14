import { Command } from 'commander';
import { loadConfig, saveConfig } from '../config/schema';
import { logger } from '../utils/logger';
import { configPath, wattzHome } from '../config/path';

export function registerConfigCommand(program: Command): void {
  const cfg = program.command('config').description('Read or write local Wattz CLI config.');

  cfg
    .command('path')
    .description('Print the config file path.')
    .action(() => {
      console.log(configPath());
    });

  cfg
    .command('show')
    .description('Print the full config as JSON.')
    .action(async () => {
      const config = await loadConfig();
      console.log(JSON.stringify(config, null, 2));
    });

  cfg
    .command('get <key>')
    .description('Print a config value by dotted key.')
    .action(async (key: string) => {
      const config = await loadConfig();
      const value = getPath(config as unknown as Record<string, unknown>, key);
      if (value === undefined) {
        logger.warn(`No value at "${key}"`);
        process.exitCode = 1;
        return;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        console.log(String(value));
        return;
      }
      console.log(JSON.stringify(value, null, 2));
    });

  cfg
    .command('set <key> <value>')
    .description('Set a config value by dotted key.')
    .action(async (key: string, value: string) => {
      const config = await loadConfig();
      const record = config as unknown as Record<string, unknown>;
      setPath(record, key, coerce(value));
      await saveConfig(config);
      logger.success(`Updated "${key}" in ${configPath()}`);
    });

  cfg
    .command('reset')
    .description('Reset the config to defaults (keypair is preserved).')
    .action(async () => {
      const { defaultNodeConfig, DEFAULT_CONFIG } = await import('../config/schema');
      const next = { ...DEFAULT_CONFIG };
      await saveConfig(next);
      logger.success(`Reset config at ${wattzHome()} to defaults.`);
      // Reference these to satisfy typechecker in case they become unused
      void defaultNodeConfig;
    });
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, seg) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined), obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i]!;
    if (typeof cursor[seg] !== 'object' || cursor[seg] === null) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = value;
}

function coerce(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  return value;
}
