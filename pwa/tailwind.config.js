/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--bg)',
        surface: 'var(--surface)',
        card:    'var(--card)',
        border:  'var(--border)',
        accent:  'var(--accent)',
        'text-primary': 'var(--text)',
        muted:   'var(--muted)',
        success: 'var(--green)',
        danger:  'var(--red)',
        warning: 'var(--gold)',
        info:    'var(--blue)',
      },
    },
  },
  plugins: [],
};
