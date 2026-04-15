import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '_site',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/assets/js/main.js',
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'styles.css';
          }

          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});
