import { Command } from 'commander';
import { CLI_VERSION } from '../constants';
import { SDK_VERSION } from '@wattz/sdk';

export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Print the CLI and SDK versions.')
    .option('--json', 'Emit JSON', false)
    .action((opts: { json: boolean }) => {
      const info = {
        cli: CLI_VERSION,
        sdk: SDK_VERSION,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      };
      if (opts.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }
      console.log(`wattz ${info.cli}`);
      console.log(`sdk   ${info.sdk}`);
      console.log(`node  ${info.node}`);
      console.log(`os    ${info.platform}/${info.arch}`);
    });
}
