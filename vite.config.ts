import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the same build works on GitHub Pages under /<repo>/ and inside Telegram.
  base: './',
  server: { watch: { ignored: ['**/output/**', '**/.npm-cache/**', '**/test-results/**'] } },
  build: { rolldownOptions: { input: { main: 'index.html', engine: 'engine.html' } } },
});
