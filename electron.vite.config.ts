import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: resolve(projectRoot, 'src/desktop/main.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: resolve(projectRoot, 'src/desktop/preload.ts'),
        output: {
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: resolve(projectRoot, 'src/desktop/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(projectRoot, 'src/desktop/renderer/index.html')
      }
    }
  }
});
