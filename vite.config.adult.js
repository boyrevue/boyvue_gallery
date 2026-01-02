import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vite configuration for adult section - served at /adult/
export default defineConfig({
  plugins: [react()],
  base: '/adult/',
  root: 'src-adult',
  publicDir: '../public-adult',
  build: {
    outDir: '../dist-adult',
    emptyDirFirst: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src-adult/index.html')
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  server: {
    port: 5177,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src-adult')
    }
  }
});
