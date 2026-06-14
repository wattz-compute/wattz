import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/program';
import { anchorDiscriminator, u64LE } from '../src/solana/anchor-ix';
import { generateAttestation } from '../src/attestation/generate';
import { formatLamports, formatUptime, shortPubkey } from '../src/utils/format';

describe('program', () => {
  it('builds a commander program with expected top-level commands', () => {
    const program = buildProgram();
    const names = program.commands.map((cmd) => cmd.name());
    expect(names).toEqual(
      expect.arrayContaining(['node', 'model', 'infer', 'stake', 'claim', 'config', 'docs', 'version']),
    );
  });

  it('registers node subcommands', () => {
    const program = buildProgram();
    const node = program.commands.find((cmd) => cmd.name() === 'node');
    expect(node).toBeDefined();
    const names = node!.commands.map((cmd) => cmd.name());
    expect(names).toEqual(expect.arrayContaining(['init', 'start', 'status', 'stop']));
  });
});

describe('anchor helpers', () => {
  it('derives an 8-byte discriminator', () => {
    const disc = anchorDiscriminator('stake');
    expect(disc.length).toBe(8);
  });

  it('encodes u64 as little-endian bytes', () => {
    const buf = u64LE(1_000n);
    expect(buf.length).toBe(8);
    expect(buf.readBigUInt64LE(0)).toBe(1_000n);
  });
});

describe('attestation', () => {
  it('produces a deterministic hash for a given nonce', () => {
    const a = generateAttestation('nonce-1');
    const b = generateAttestation('nonce-1');
    expect(a.quote_hash).toBe(b.quote_hash);
    expect(a.kind).toBe(b.kind);
  });

  it('produces a different hash for a different nonce', () => {
    const a = generateAttestation('nonce-1');
    const b = generateAttestation('nonce-2');
    expect(a.quote_hash).not.toBe(b.quote_hash);
  });
});

describe('format', () => {
  it('formats lamports as SOL', () => {
    expect(formatLamports(1_000_000_000)).toBe('1.0000 SOL');
    expect(formatLamports(0)).toBe('0.0000 SOL');
  });

  it('formats uptime as compact d/h/m', () => {
    expect(formatUptime(0)).toBe('0s');
    expect(formatUptime(90)).toBe('1m');
    expect(formatUptime(60 * 60 * 25 + 60 * 30)).toBe('1d 1h 30m');
  });

  it('shortens long pubkeys', () => {
    const pk = '4NkkyByMuT5W2c5FRoZBw5aYQ1uk4jTAqGtHfyxYt3zH';
    expect(shortPubkey(pk)).toBe(`${pk.slice(0, 6)}...${pk.slice(-4)}`);
  });
});
