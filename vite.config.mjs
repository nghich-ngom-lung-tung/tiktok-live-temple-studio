import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const backendPort = Number(process.env.PORT || 3000);
const vitePort = Number(process.env.VITE_PORT || 5173);
const backendTarget = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  root: path.resolve(rootDir, 'src/views'),
  publicDir: path.resolve(rootDir, 'public'),
  appType: 'mpa',
  plugins: [
    {
      name: 'admin-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url) {
            const url = new URL(req.url, 'http://vite.local');
            if (url.pathname === '/admin') {
              req.url = `/admin/index.html${url.search}`;
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    host: '127.0.0.1',
    port: vitePort,
    strictPort: true,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/rpc': { target: backendTarget, changeOrigin: true },
      '/tts-cache': { target: backendTarget, changeOrigin: true },
      '/ws': {
        target: `ws://127.0.0.1:${backendPort}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: path.resolve(rootDir, 'src/views/index.html'),
        admin: path.resolve(rootDir, 'src/views/admin/index.html')
      }
    }
  }
});
