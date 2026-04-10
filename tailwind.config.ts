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
        panel: "#0c0c0f",
        edge: "#1b1b21",
        ink: "#f4f4f5",
        muted: "#9ca3af",
        accent: "#7dd3fc",
        success: "#34d399",
        warning: "#f59e0b",
        danger: "#fb7185"
      },
      boxShadow: {
        soft: "0 24px 80px rgba(0, 0, 0, 0.45)"
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at top, rgba(125, 211, 252, 0.16), transparent 30%), radial-gradient(circle at 80% 20%, rgba(148, 163, 184, 0.12), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        }
      },
      animation: {
        float: "float 7s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
