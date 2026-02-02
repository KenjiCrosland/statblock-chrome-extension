import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'content-crosland': resolve(__dirname, 'src/content/crosland.ts'),
        'content-roll20': resolve(__dirname, 'src/content/roll20.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'src/popup/popup.html', dest: '.' },
        { src: 'src/popup/popup.css', dest: '.' },
        { src: 'public/*.svg', dest: '.' },
      ],
    }),
  ],
});
