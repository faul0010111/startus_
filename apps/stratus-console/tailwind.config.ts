import type { Config } from "tailwindcss";

/**
 * Palette is defined once in globals.css as CSS variables and surfaced here so
 * status colours cannot drift between components.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        hairline: "var(--hairline)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        healthy: "var(--healthy)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        signal: "var(--signal)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { panel: "2px" },
    },
  },
  plugins: [],
};

export default config;
