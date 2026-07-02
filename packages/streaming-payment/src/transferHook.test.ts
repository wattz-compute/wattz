import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { deriveStreamPda, streamIdSeed } from "./transferHook.js";

// Live Wattz program id (Solana devnet).
const PROGRAM_ID = new PublicKey("GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU");

// A real UUIDv4, the shape the gateway hands back in the SSE preamble.
const STREAM_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

describe("streamIdSeed", () => {
  it("collapses a 36-byte UUIDv4 to a 32-byte seed", () => {
    expect(new TextEncoder().encode(STREAM_ID).length).toBe(36);
    expect(streamIdSeed(STREAM_ID).length).toBe(32);
  });

  it("is deterministic for a given id", () => {
    expect(streamIdSeed(STREAM_ID)).toStrictEqual(streamIdSeed(STREAM_ID));
  });
});

describe("deriveStreamPda", () => {
  it("derives a PDA from a UUIDv4 without exceeding the seed limit", () => {
    // The raw UUID as a seed throws "Max seed length exceeded"; hashing first
    // is what keeps this from blowing up.
    expect(() =>
      PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wattz-stream"), new TextEncoder().encode(STREAM_ID)],
        PROGRAM_ID,
      ),
    ).toThrow(/seed length/i);

    const [pda, bump] = deriveStreamPda(PROGRAM_ID, STREAM_ID);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
    // A PDA is off the ed25519 curve.
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
  });

  it("is stable across calls and distinct across ids", () => {
    const [a] = deriveStreamPda(PROGRAM_ID, STREAM_ID);
    const [again] = deriveStreamPda(PROGRAM_ID, STREAM_ID);
    const [other] = deriveStreamPda(PROGRAM_ID, "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    expect(a.equals(again)).toBe(true);
    expect(a.equals(other)).toBe(false);
  });
});
