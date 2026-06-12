import chalk from 'chalk';
import { PALETTE } from '../constants';

function tag(label: string, hex: string): string {
  if (process.env.WATTZ_NO_COLOR === '1') return `[${label}]`;
  return chalk.hex(hex)(`[${label}]`);
}

export const logger = {
  info(message: string): void {
    console.log(`${tag('info', PALETTE.cyan)} ${message}`);
  },
  success(message: string): void {
    console.log(`${tag('ok', PALETTE.gold)} ${message}`);
  },
  warn(message: string): void {
    console.warn(`${tag('warn', PALETTE.amber)} ${message}`);
  },
  error(message: string): void {
    console.error(`${tag('err', PALETTE.red)} ${message}`);
  },
  debug(message: string): void {
    if (!process.env.WATTZ_DEBUG) return;
    console.log(`${tag('dbg', PALETTE.gray)} ${message}`);
  },
  raw(message: string): void {
    process.stdout.write(message);
  },
  header(title: string): void {
    if (process.env.WATTZ_NO_COLOR === '1') {
      console.log(`\n== ${title} ==`);
      return;
    }
    console.log(`\n${chalk.hex(PALETTE.cyan).bold(title)}`);
    console.log(chalk.hex(PALETTE.gray)('-'.repeat(Math.max(title.length, 32))));
  },
};
