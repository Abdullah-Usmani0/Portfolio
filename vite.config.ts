/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `vite build --mode artifact` makes the live preview: one self-contained page (scripts,
 * styles, fonts and data inlined) that scripts/artifact.ts turns into a claude.ai artifact.
 */
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: artifact ? './' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    assetsInclude: ['**/*.bin'],
    build: artifact
      ? {
          target: 'es2022',
          outDir: 'dist-artifact',
          sourcemap: false,
          cssCodeSplit: false,
          modulePreload: false,
          assetsInlineLimit: () => true,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : { target: 'es2022', sourcemap: true },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      environment: 'node',
    },
  };
});
