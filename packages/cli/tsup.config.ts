import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  minify: false,
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
  outExtension: () => ({ js: '.js' }),
});
