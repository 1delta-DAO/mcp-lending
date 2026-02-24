/**
 * App theme tokens.
 * Edit this file to change the colour scheme globally.
 * Each token pairs a light-mode class with its dark-mode equivalent.
 */
export const t = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  /** Outermost page background */
  pageBg:   'bg-stone-300 dark:bg-gray-900',
  /** Header, sidebar, input bar */
  panelBg:  'bg-stone-200 dark:bg-gray-800',
  /** Message bubbles, text inputs, dropdowns */
  cardBg:   'bg-stone-100 dark:bg-gray-700',

  // ── Borders ──────────────────────────────────────────────────────────────────
  border:   'border-stone-400 dark:border-gray-700',
  borderSm: 'border-stone-400 dark:border-gray-600',

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   'text-stone-900 dark:text-white',
  textSecondary: 'text-stone-600 dark:text-gray-400',
  textMuted:     'text-stone-500 dark:text-gray-500',
  textFaint:     'text-stone-400 dark:text-gray-500',
  mutedBg:       'bg-stone-400 dark:bg-gray-400',

  // ── Interactive ──────────────────────────────────────────────────────────────
  /** Hover on panel-level surfaces */
  hover:    'hover:bg-stone-300 dark:hover:bg-gray-700',
  /** Hover on card-level surfaces */
  hoverCard:'hover:bg-stone-200 dark:hover:bg-gray-600',
} as const;
