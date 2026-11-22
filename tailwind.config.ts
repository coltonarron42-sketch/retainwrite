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
        rw: {
          ink: "var(--rw-ink)",
          paper: "var(--rw-paper)",
          teal: "var(--rw-teal)",
          sky: "var(--rw-sky)",
          mist: "var(--rw-mist)",
        },
        // PLAN.md 8.1 Editorial-Warm palette.
        ds: {
          page: "var(--ds-page)",
          surface: "var(--ds-surface)",
          ink: "var(--ds-ink)",
          muted: "var(--ds-muted)",
          faint: "var(--ds-faint)",
          accent: "var(--ds-accent)",
          sage: "var(--ds-sage)",
          amber: "var(--ds-amber)",
          error: "var(--ds-error)",
          border: "var(--ds-border)",
        },
      },
      boxShadow: {
        "ds-button": "0 2px 8px rgba(196,120,90,0.25)",
        "ds-card": "0 1px 4px rgba(28,43,45,0.06)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        "ds-sans": ["var(--font-ds-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        "ds-mono": ["var(--font-ds-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
