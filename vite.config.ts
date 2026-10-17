import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
});
