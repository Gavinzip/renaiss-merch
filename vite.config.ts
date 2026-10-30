import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { developmentPreviewRoutes } from './vite/developmentPreviewRoutes';
import { publicProofMedia } from './vite/publicProofMedia';

export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      input: {
        legacy: 'index.html',
        v1_2: 'v1.2/index.html',
        draw: 'draw/index.html',
        archivePokemon: 'events/pokemon-30/index.html',
        archiveFootball: 'events/football/index.html'
      }
    }
  },
  plugins: [publicProofMedia(mode, { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>), developmentPreviewRoutes(), react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three']
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react/jsx-runtime'
    ]
  }
}));
