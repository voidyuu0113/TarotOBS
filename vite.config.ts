import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const singleFile = mode === 'singlefile';

  return {
    base: '/TarotOBS/',
    plugins: singleFile ? [viteSingleFile()] : [],
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
    build: {
      outDir: singleFile ? 'dist-single' : 'dist',
      assetsInlineLimit: singleFile ? Number.MAX_SAFE_INTEGER : undefined,
      cssCodeSplit: !singleFile,
      modulePreload: singleFile ? false : undefined,
      rollupOptions: singleFile
        ? {
            output: {
              inlineDynamicImports: true,
            },
          }
        : undefined,
    },
  };
});
