import { Command } from 'commander';
import { isProcessAlive, readNodeState } from '../../runtime/loader';
import { logger } from '../../utils/logger';

export function registerStop(node: Command): void {
  node
    .command('stop')
    .description('Stop the local node runtime (SIGTERM to the tracked PID).')
    .option('--force', 'Send SIGKILL instead of SIGTERM', false)
    .action(async (opts: { force: boolean }) => {
      const state = await readNodeState();
      if (!state) {
        logger.info('No node state on disk.');
        return;
      }
      if (!isProcessAlive(state.pid)) {
        logger.info(`Process ${state.pid} is not running.`);
        return;
      }
      const signal = opts.force ? 'SIGKILL' : 'SIGTERM';
      try {
        process.kill(state.pid, signal);
        logger.success(`Sent ${signal} to pid=${state.pid}`);
      } catch (err) {
        logger.error(`Failed to signal pid=${state.pid}: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });
}
