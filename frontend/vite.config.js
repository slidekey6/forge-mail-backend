import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  plugins: [
    {
      name: 'copy-static-files',
      closeBundle() {
        // app.js is loaded as a plain <script> (not a module), copy it as-is
        copyFileSync(
          resolve(__dirname, 'app.js'),
          resolve(__dirname, 'dist', 'app.js')
        );
        // style.css is also referenced directly
        copyFileSync(
          resolve(__dirname, 'style.css'),
          resolve(__dirname, 'dist', 'style.css')
        );
      },
    },
  ],
});
