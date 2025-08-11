import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'primary': '#22c55e',
        'primary-light': '#81C281',
        'primary-dark': '#048504',
        'primary-darker': '#176128',
        'primary-selected': '#dcfce7',
        'logo-lime': '#C3EA1B',
        'logo-green': '#45AB0F',
        'icon-dark': '#064506',
        'neutral-dark': '#343A40'
      },
    },
  },
  plugins: [],
};
export default config;
