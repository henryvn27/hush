import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    setupFiles: ['./tests/rendered/setup.ts'],
    include: ['tests/rendered/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
  },
});
