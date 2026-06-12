import { Command } from 'commander';
import { registerNodeCommand } from './commands/node';
import { registerModelCommand } from './commands/model';
import { registerInferCommand } from './commands/infer';
import { registerStakeCommand } from './commands/stake';
import { registerClaimCommand } from './commands/claim';
import { registerConfigCommand } from './commands/config';
import { registerDocsCommand } from './commands/docs';
import { registerVersionCommand } from './commands/version';
import { CLI_NAME, CLI_VERSION } from './constants';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name(CLI_NAME)
    .description(
      'Wattz CLI. Operate a Solana AI inference GPU node, publish models, run inference, and manage stake.',
    )
    .version(CLI_VERSION, '-v, --version', 'Print the CLI version')
    .option('--api <url>', 'Override API base URL for this invocation')
    .option('--verbose', 'Print debug diagnostics')
    .hook('preAction', (thisCmd) => {
      const opts = thisCmd.opts<{ api?: string; verbose?: boolean }>();
      if (opts.api) process.env.WATTZ_BASE_URL = opts.api;
      if (opts.verbose) process.env.WATTZ_DEBUG = '1';
    });

  registerNodeCommand(program);
  registerModelCommand(program);
  registerInferCommand(program);
  registerStakeCommand(program);
  registerClaimCommand(program);
  registerConfigCommand(program);
  registerDocsCommand(program);
  registerVersionCommand(program);

  program.showSuggestionAfterError(true);
  program.showHelpAfterError('(add --help for usage)');

  return program;
}
