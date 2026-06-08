import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Конфиг сборки Vite. Ничего менять не нужно.
export default defineConfig({
  plugins: [react()],
});
