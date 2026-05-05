import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bone: "#F4ECE0",
        boneSoft: "#F8F2E8",
        ink: "#1A1614",
        inkSoft: "#3A322D",
        muted: "#7B6F65",
        rule: "rgba(26, 22, 20, 0.08)",
        flame: "#FF5A1F",
        flameSoft: "#FFAF75",
        coal: "#131011",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      letterSpacing: {
        widest: "0.18em",
      },
    },
  },
  plugins: [],
};

export default config;
