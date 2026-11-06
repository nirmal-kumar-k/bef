import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next.js's recommended rules (React, hooks, accessibility basics, Core Web
// Vitals) plus its TypeScript rules. Run with `pnpm lint`.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The codebase uses `any` widely (169 places when lint was introduced,
    // 2026-11-05). Typing them is its own project; until then they show as
    // warnings so `pnpm lint` reports real errors instead of failing forever.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler rules (eslint-plugin-react-hooks 7). This app does not
      // use the React Compiler, so these flag missed optimisations rather than
      // bugs; reviewed 2026-11-05 - the one real misuse (setState inside
      // useMemo in the order form) was fixed. Kept visible as warnings.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', '.claude/**', 'babufoundry/**', 'next-env.d.ts', 'tsconfig.tsbuildinfo']),
])
