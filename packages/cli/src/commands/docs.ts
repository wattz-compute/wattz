import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { DOCS_URL } from '../constants';
import { logger } from '../utils/logger';

export function registerDocsCommand(program: Command): void {
  program
    .command('docs')
    .description(`Open the Wattz documentation site (${DOCS_URL}).`)
    .option('--print', 'Print the URL instead of launching a browser', false)
    .action((opts: { print: boolean }) => {
      if (opts.print) {
        console.log(DOCS_URL);
        return;
      }
      const os = platform();
      const cmd = os === 'darwin' ? 'open' : os === 'win32' ? 'cmd' : 'xdg-open';
      const args = os === 'win32' ? ['/c', 'start', '""', DOCS_URL] : [DOCS_URL];
      try {
        const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
        child.on('error', () => {
          console.log(DOCS_URL);
        });
        child.unref();
        logger.info(`Opened ${DOCS_URL}`);
      } catch {
        console.log(DOCS_URL);
      }
    });
}
