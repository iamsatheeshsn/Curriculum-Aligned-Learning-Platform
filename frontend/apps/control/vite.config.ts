import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@stemora/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@stemora/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@stemora/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@stemora/nav': path.resolve(__dirname, '../../packages/nav/src'),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
});
