import { defineConfig } from 'vite';

// The app is published to GitHub Pages at
// https://devdevsamuel.github.io/project-ali/, so the built assets need the
// repository name in their URLs. The dev server keeps working from the root
// because Vite serves `index.html` directly in development.
export default defineConfig({
  base: '/project-ali/',
  build: {
    outDir: 'dist',
    // Source maps are not needed for a static game build.
    sourcemap: false,
  },
});
