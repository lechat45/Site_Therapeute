import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5190, strictPort: true },
  // Postgres (PGlite) s'initialise en WebAssembly : délais généreux.
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120_000, hookTimeout: 300_000 },
});
