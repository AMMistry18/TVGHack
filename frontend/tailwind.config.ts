import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        grid: {
          green: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
          blue: "#3b82f6",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(16, 185, 129, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(16, 185, 129, 0.6)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
