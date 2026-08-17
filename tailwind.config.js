/** @type {import('tailwindcss').Config} */

// Tokens are CSS custom properties defined in src/index.css, so a single set of
// utility classes works in both themes. Channels are stored space-separated so
// Tailwind's opacity modifiers (bg-accent/20) still work.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['variant', [
    '@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) & }',
    ':root[data-theme="dark"] &',
  ]],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-raised': token('surface-raised'),
        border: token('border'),

        text: token('text'),
        'text-muted': token('text-muted'),

        accent: token('accent'),
        'on-accent': token('on-accent'),

        warning: token('warning'),
        danger: token('danger'),

        'brand-sage': token('brand-sage'),
        'on-brand-sage': token('on-brand-sage'),
      },
    },
  },
  plugins: [],
}
