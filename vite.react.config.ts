import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3100 },
  build: { outDir: 'dist-react' },
  plugins: [tailwindcss(), cloudflare({ configPath: process.env.REACT_WRANGLER_CONFIG ?? 'wrangler.react.jsonc', config: process.env.REACT_WRANGLER_CONFIG ? { secrets: { required: [] } } : undefined, viteEnvironment: { name: 'ssr' } }), tanstackStart({ srcDirectory: 'src/app' }), react()],
});
