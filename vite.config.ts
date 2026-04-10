import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths so it works when served under any sub-path
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
