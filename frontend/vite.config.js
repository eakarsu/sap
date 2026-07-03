import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ include: /\.(js|jsx|ts|tsx)$/ })],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.(js|jsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    port: Number(process.env.FRONTEND_PORT || 3001),
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT || 4002}`,
        changeOrigin: true,
      },
    },
  },
});
