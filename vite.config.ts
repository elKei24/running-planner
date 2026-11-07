import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';

// BASE_PATH is set by the GitHub Pages deployment workflow (e.g. "/running-planner/").
const base = process.env.BASE_PATH ?? '/';

// Shown as "Version ..." on the settings page. Releases are cut by semantic-release from the
// Conventional Commits history (see .releaserc.json), so package.json carries no real version:
// the release workflow passes the released version in as APP_VERSION. Everything else is a
// development build and is labelled with the commit it was built from.
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return `dev-${execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}`;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    // devToolsEnabled: false keeps `preact/debug` out of the dev bundle. With Preact 11 the
    // debug hooks wrapper conflicts with @preact/signals 2.x (TypeError reading '__$f' in dev
    // only). Re-enable once @preact/signals supports it; production is unaffected either way.
    preact({ devToolsEnabled: false }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Running Planner',
        short_name: 'Planner',
        description: 'Adaptive marathon training plan that lives in your browser.',
        theme_color: '#0f766e',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: { target: 'es2022', sourcemap: true },
});
