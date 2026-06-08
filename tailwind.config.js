/** @type {import('tailwindcss').Config} */
// Палитра и шрифты приложения. Цвета совпадают с дизайном.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e0e10',      // фон
        panel: '#161618',    // карточки
        panel2: '#1c1c1f',   // вложенные поверхности
        cream: '#e8e6e1',    // акцент (текст, прогресс)
        muted: '#9a9893',    // вторичный текст
        dim: '#6a6864',      // третичный текст
        done: '#5fa888',     // статус «готово» / realtime
      },
      fontFamily: {
        sans: ['Golos Text', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
