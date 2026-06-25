/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#7c3aed',
        secondary: '#db2777',
        accent: '#f59e0b',
        ink: '#1e1b2e'
      }
    }
  },
  plugins: []
};
