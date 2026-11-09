import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/v1': {
          target:
            process.env.PLATFORM_API_TARGET ?? env.PLATFORM_API_TARGET ?? 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
    },
  };
});
