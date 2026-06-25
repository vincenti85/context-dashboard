import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vercel/Linear minimal palette
        bg: {
          DEFAULT: "#0a0a0a",
          subtle: "#111111",
          elevated: "#1a1a1a",
        },
        border: {
          DEFAULT: "#222222",
          subtle: "#1a1a1a",
        },
        text: {
          DEFAULT: "#ededed",
          muted: "#888888",
          subtle: "#666666",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
