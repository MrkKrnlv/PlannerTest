import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // API крутится в `wrangler pages dev` (npm run dev:api)
    proxy: { '/api': 'http://localhost:8788' },
  },
});
