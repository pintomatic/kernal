import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: ['react', 'react-dom', 'react-force-graph-2d', 'lucide-react'],
    esbuildOptions(options) {
      // Preserve 'use client' directives — tsup strips them by default
      options.banner = { js: '"use client";' };
    },
    async onSuccess() {
      // Copy CSS variables file to dist so consumers can import '@kernal/ui/dist/index.css'
      copyFileSync('src/index.css', 'dist/index.css');
    },
  },
]);
