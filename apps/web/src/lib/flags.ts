// Launch gating. Each surface stays dark (404 + hidden links) until its env
// flag is the literal string "true" — flipped one slot at a time during the
// posting sequence. NEXT_PUBLIC_* values are inlined at build time, so a flag
// change requires a redeploy to take effect.
export const FLAGS = {
  playground: process.env.NEXT_PUBLIC_1_PLAYGROUND === 'true',
  sdk: process.env.NEXT_PUBLIC_2_SDK === 'true',
  operator: process.env.NEXT_PUBLIC_3_OPERATOR === 'true',
} as const;
