import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'blender', 'playwright-report', 'test-results'] },
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
    // R3F mutates three.js objects every frame inside useFrame — outside React's render, by
    // design — which the compiler's immutability rule cannot tell apart from render mutation.
    files: ['src/stage/**/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
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
            { group: ['three', 'three/*', '@react-three/*', 'postprocessing'], message: 'src/sim is pure: no three.js.' },
            { group: ['gsap', 'gsap/*', 'lenis', 'zustand', 'zustand/*'], message: 'src/sim is pure: no motion or store libraries.' },
            { group: ['@/stage/*', '@/ui/*', '@/labs/*'], message: 'src/sim must not depend on rendering code.' },
          ],
        },
      ],
    },
  },
);
