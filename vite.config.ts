import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  console.log('Vite Config: Carregando ambiente para modo:', mode);
  console.log('Vite Config: GEMINI_API_KEY_ presente no env:', !!env.GEMINI_API_KEY_);
  console.log('Vite Config: VITE_GEMINI_API_KEY presente no env:', !!env.VITE_GEMINI_API_KEY);
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
