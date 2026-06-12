import { buildProgram } from './program';
import { logger } from './utils/logger';
import {
  WattzAPIError,
  WattzAuthenticationError,
  WattzConnectionError,
  WattzTimeoutError,
} from '@wattz/sdk';

async function main() {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
}

function handleError(err: unknown): void {
  if (err instanceof WattzAuthenticationError) {
    logger.error('Authentication failed. Check WATTZ_API_KEY or run `wattz config set apiKey <key>`.');
    return;
  }
  if (err instanceof WattzTimeoutError) {
    logger.error(`Request timed out after ${err.timeoutMs}ms. Retry, or point --api at a healthier region.`);
    return;
  }
  if (err instanceof WattzConnectionError) {
    logger.error(`Connection to the Wattz gateway failed: ${err.message}`);
    return;
  }
  if (err instanceof WattzAPIError) {
    logger.error(`Wattz API error (${err.status}): ${err.message}`);
    if (err.requestId) logger.debug(`request-id: ${err.requestId}`);
    return;
  }
  if (err instanceof Error) {
    logger.error(err.message);
    if (process.env.WATTZ_DEBUG && err.stack) {
      logger.debug(err.stack);
    }
    return;
  }
  logger.error(String(err));
}

main().catch((err) => {
  handleError(err);
  process.exit(1);
});
