import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Load .env, .env.production etc. from the project root explicitly.
  const env = loadEnv(mode, process.cwd(), '');
  // Referrer-restricted Maps client key (safe to inline in the bundle).
  const mapsKey = env.VITE_MAPS_API_KEY || process.env.VITE_MAPS_API_KEY || '';
  const agentUrl = env.VITE_AGENT_SERVICE_URL || process.env.VITE_AGENT_SERVICE_URL || '';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Inject values directly into the bundle at build time so they don't depend
    // on import.meta.env being populated by env-file auto-loading.
    define: {
      'import.meta.env.VITE_MAPS_API_KEY': JSON.stringify(mapsKey),
      'import.meta.env.VITE_AGENT_SERVICE_URL': JSON.stringify(agentUrl),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
