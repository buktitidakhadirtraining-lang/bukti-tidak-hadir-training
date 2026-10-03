/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0056b3',
          dark: '#004085',
          light: '#e6f0fa',
        },
        danger: {
          DEFAULT: '#dc3545',
          light: '#f8d7da',
        },
        warning: {
          DEFAULT: '#ffc107',
          light: '#fff3cd',
        },
        success: {
          DEFAULT: '#28a745',
          light: '#d4edda',
        },
        background: '#f4f7f6',
      },
      fontFamily: {
        heading: ['var(--font-montserrat)', 'sans-serif'],
        body: ['var(--font-nunito)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
