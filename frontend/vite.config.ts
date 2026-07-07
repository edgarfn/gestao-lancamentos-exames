/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/*.spec.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      // Cobertura concentrada nas peças críticas de segurança (autenticação, sessão,
      // rotas protegidas). As telas de CRUD são validadas pelo fluxo manual ponta-a-ponta
      // descrito em INSTALACAO.md. Limiares como piso de regressão, não meta final.
      thresholds: {
        statements: 10,
        branches: 55,
        functions: 30,
        lines: 10,
      },
    },
  },
});
