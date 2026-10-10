import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
      },
      /*
       * Register tokens — aliases over the CSS variables declared in
       * src/app/globals.css. See docs/design-handout.md and the
       * tokens artboard on the design canvas for the roles.
       * NOTE: var()-backed colors do not support opacity modifiers
       * (bg-ink/45 renders nothing) — use an arbitrary rgba() value
       * or a wash token instead.
       */
      colors: {
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        ground: "var(--ground)",
        surface: "var(--surface)",
        "surface-sunk": "var(--surface-sunk)",
        primary: "var(--primary)",
        "primary-fill": "var(--primary-fill)",
        urgency: "var(--accent)",
        "rule-hair": "var(--rule-hair)",
        rule: "var(--rule)",
        "rule-active": "var(--rule-active)",
        success: "var(--success)",
        "success-wash": "var(--success-wash)",
        warning: "var(--warning)",
        "warning-wash": "var(--warning-wash)",
        error: "var(--error)",
        "error-wash": "var(--error-wash)",
        well: "var(--well)",
      },
      /* Radius by element: squarer controls, generous cards. */
      borderRadius: {
        control: "6px",
        panel: "10px",
        sheet: "12px",
        keycap: "13px",
        card: "20px",
      },
      /* 3D keycap buttons: raised face, solid bottom edge; pressed
       * state is an inset well with a rounded "pop" tile inside. */
      boxShadow: {
        keycap: "0 2px 0 var(--keycap-edge), 0 3px 5px rgba(13,27,42,0.08)",
        "keycap-lg": "0 3px 0 var(--keycap-edge), 0 4px 8px rgba(13,27,42,0.08)",
        well: "inset 0 2px 5px rgba(13,27,42,0.25)",
        pop: "0 1px 3px rgba(13,27,42,0.3)",
        fab: "0 3px 0 #06101a, 0 7px 14px rgba(13,27,42,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
        "fab-active":
          "0 3px 0 #0a4a63, 0 7px 14px rgba(17,119,158,0.4), inset 0 1px 0 rgba(255,255,255,0.35)",
      },
      backgroundImage: {
        keycap: "linear-gradient(180deg, #ffffff, #edf2f6)",
        "keycap-tile": "linear-gradient(180deg, #ffffff, #f0f4f8)",
        fab: "linear-gradient(180deg, #22405e, #0d1b2a)",
        "fab-active": "linear-gradient(180deg, #1fb8e8, #0f6a8d)",
      },
    },
  },
  plugins: [],
} satisfies Config;
