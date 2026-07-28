import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { developmentPreviewRoutes } from './vite/developmentPreviewRoutes';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        legacy: 'index.html',
        v1_2: 'v1.2/index.html'
      }
    }
  },
  plugins: [developmentPreviewRoutes(), react()],
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
});
