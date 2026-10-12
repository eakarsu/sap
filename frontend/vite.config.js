import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const localConfig = loadEnv('', resolve(process.cwd(), '..'), '');
const demoPairs = [
  ['DEMO_EMAIL', 'DEMO_PASSWORD'],
  ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'],
  ['ADMIN_EMAIL', 'ADMIN_PASSWORD'],
  ['DEFAULT_EMAIL', 'DEFAULT_PASSWORD'],
];
const demoPair = demoPairs.find(([email, password]) => localConfig[email] && localConfig[password]);
const demoEnabled = localConfig.ENABLE_DEMO_CREDENTIAL_AUTOFILL === 'true' && Boolean(demoPair);

export default defineConfig({
  define: {
    'import.meta.env.VITE_ENABLE_DEMO_CREDENTIAL_AUTOFILL': JSON.stringify(String(demoEnabled)),
    'import.meta.env.VITE_DEMO_EMAIL': JSON.stringify(demoEnabled ? localConfig[demoPair[0]] : ''),
    'import.meta.env.VITE_DEMO_PASSWORD': JSON.stringify(demoEnabled ? localConfig[demoPair[1]] : ''),
  },
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
  preview: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 4002}`,
        changeOrigin: true,
      },
    },
  },
});
