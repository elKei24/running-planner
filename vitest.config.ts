import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [preact()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['src/domain/**/*.test.ts', 'src/planner/**/*.test.ts', 'src/io/**/*.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'happy-dom', include: ['src/ui/**/*.test.{ts,tsx}', 'src/store/**/*.test.ts'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.test.*', 'src/vite-env.d.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
