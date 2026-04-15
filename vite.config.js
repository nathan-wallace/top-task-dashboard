import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '_site',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/assets/js/index.js'),
        overview: resolve(__dirname, 'src/assets/js/overview.js'),
        prompt: resolve(__dirname, 'src/assets/js/prompt.js')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
