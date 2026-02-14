import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/ca-mera/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: true,
  },
});
