import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-artifact', 'node_modules', 'public', 'blender', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The simulation layer is pure and clean-room: no rendering, motion or DOM libraries.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: 'src/sim is pure: no React.' },
            { group: ['three', 'three/*'], message: 'src/sim is pure: no three.js.' },
            { group: ['gsap', 'gsap/*', 'lenis', 'zustand', 'zustand/*'], message: 'src/sim is pure: no motion or store libraries.' },
            { group: ['@/motion/*', '@/sections/*', '@/ui/*'], message: 'src/sim must not depend on rendering code.' },
          ],
        },
      ],
    },
  },
);
