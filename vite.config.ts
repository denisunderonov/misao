import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { secureHtml } from './scripts/security.ts';

export default defineConfig({
  plugins: [react(), {
    name: 'production-security-policy',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: secureHtml },
  }],
  base: process.env.VITE_BASE_PATH || '/',
});
