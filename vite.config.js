import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  base: mode === 'production' ? '/ca-mera/' : '/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: true,
  },
}));
