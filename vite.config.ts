import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192x192.svg', 'icon-512x512.svg'],
      manifest: {
        name: 'VibeCheck',
        short_name: 'VibeCheck',
        description: 'An anonymous vibe check for nightlife venues in Trondheim.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#8b5cf6',
        icons: [
          {
            src: 'icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache app shell assets
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Don't cache Supabase API calls - let them go to network
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /supabase/],
        // Increase max file size to cache (default is 2MB, our bundle is ~2.1MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      },
      devOptions: {
        enabled: false, // Deaktivert: ingen service worker i dev-miljø
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,
  },
});
