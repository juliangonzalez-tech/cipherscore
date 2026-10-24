import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#050505",
        ink: "#f4f4f5",
        accent: "#7dd3fc",
        success: "#34d399",
        warning: "#f59e0b",
        danger: "#fb7185"
      },
      boxShadow: {
        soft: "0 24px 80px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
