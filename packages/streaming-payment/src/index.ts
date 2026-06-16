/**
 * @wattz/streaming-payment public surface.
 */

export type {
  StreamPricing,
  StreamContext,
  StreamChunk,
  StreamMeter,
  StreamMicroPayment,
  StreamSettlementReceipt,
} from "./types.js";

export {
  streamWithPayments,
  StreamingPaymentError,
  type StreamerOptions,
  type ChunkSource,
  type FlushResult,
} from "./streamer.js";

export {
  buildTransferWithHookIx,
  deriveStreamPda,
  transferHookExtraAccounts,
  STREAM_PDA_SEED,
  type HookedTransferParams,
} from "./transferHook.js";

export {
  parseSseStream,
  type OpenAiEvent,
  type SseParseOptions,
} from "./sse.js";
