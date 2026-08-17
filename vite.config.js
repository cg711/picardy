import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the same build works at a domain root (Netlify,
  // Vercel, Cloudflare Pages) and under a subpath (GitHub Pages project sites
  // at /<repo>/) without rebuilding. Safe here because all app state lives in
  // the URL hash — there is only ever one real path to serve.
  base: './',
  server: { port: 5173 },
})
