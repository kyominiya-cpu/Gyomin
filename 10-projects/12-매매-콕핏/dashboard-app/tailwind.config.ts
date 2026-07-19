import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 트레이딩 콕핏 다크 팔레트
        ink: "#0b0e14",
        panel: "#131722",
        edge: "#232838",
        buy: "#22c55e",
        sell: "#ef4444",
        warn: "#f59e0b",
        muted: "#8b93a7",
      },
    },
  },
  plugins: [],
};

export default config;
