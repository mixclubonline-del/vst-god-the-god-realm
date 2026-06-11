import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use relative paths so the build works inside JUCE's embedded WebView
  base: './',
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  build: {
    // Output to dist/ for JUCE BinaryData embedding
    outDir: 'dist',
    // Inline small assets to reduce file count for BinaryData
    assetsInlineLimit: 8192,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  }
});
