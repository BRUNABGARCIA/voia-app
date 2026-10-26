import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Testes da interface usam DOM local, separados do runtime Cloudflare/D1.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/ui/**/*.test.tsx'],
    maxWorkers: 1,
  },
});
