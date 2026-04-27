/**
 * Anchor CLI runs this after `anchor deploy` when a `[scripts.migrate]` entry
 * is configured. It receives an `AnchorProvider` bound to the target cluster.
 *
 * Wattz keeps the migration minimal -- the `Config` PDA is initialised via a
 * separate operator playbook (see `apps/operator`) that also creates the
 * $WATTZ mint and treasury ATAs -- so this file just logs deployment metadata.
 */

import * as anchor from "@coral-xyz/anchor";

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  const walletKey = provider.wallet.publicKey.toBase58();
  const rpcEndpoint = (provider.connection as any)._rpcEndpoint;
  // eslint-disable-next-line no-console
  console.log(
    `[wattz] deployed by ${walletKey} to ${rpcEndpoint}. ` +
      `Next steps: 1) run initialize with the freshly-created $WATTZ mint, ` +
      `2) copy target/idl/wattz_marketplace.json to packages/sdk-ts/idl/.`,
  );
};
