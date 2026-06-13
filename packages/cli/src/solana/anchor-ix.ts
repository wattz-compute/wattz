import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

/**
 * Compute the 8-byte discriminator Anchor derives for `global:<name>`.
 * Matches @coral-xyz/anchor's coder so we can build raw instructions
 * without pulling the whole IDL runtime for a two-instruction call.
 */
export function anchorDiscriminator(name: string): Buffer {
  const hash = createHash('sha256').update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

export function u64LE(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value, 0);
  return buf;
}

export function u32LE(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value, 0);
  return buf;
}

export function boolByte(value: boolean): Buffer {
  return Buffer.from([value ? 1 : 0]);
}
