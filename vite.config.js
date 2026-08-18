import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Root-absolute asset URLs. This used to be './' so the same build could run
  // under a subpath, which was safe while '/' was the only path that existed.
  // /privacy and /terms end that: a relative <script src="./assets/…"> resolves
  // against the current directory, so it would break the moment a host served
  // /privacy/ with a trailing slash. The deploy target is a domain root, so
  // pin it there and let the paths be unambiguous.
  base: '/',
  server: { port: 5173 },
})
