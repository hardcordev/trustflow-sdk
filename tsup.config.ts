import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/hooks/index.ts',
    // Subpath build targets so the README's documented imports
    // (`@trustflow/sdk/escrow` etc.) resolve against the published package (#100).
    'src/escrow/index.ts',
    'src/wallet/index.ts',
    'src/utils/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  // Shared chunks keep a single copy of TrustFlowError, logger and the escrow classes
  // across the root and subpath entries (#304).
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  target: 'es2020',
  platform: 'neutral',
});
