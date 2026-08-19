import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"]
      },
      backgroundImage: {
        "radial-signal":
          "radial-gradient(circle at 20% 20%, hsl(var(--primary) / 0.10), transparent 32%), radial-gradient(circle at 78% 12%, hsl(var(--accent) / 0.07), transparent 28%)",
        "signal-grid":
          "linear-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.08) 1px, transparent 1px)",
        "brand-conic":
          "conic-gradient(from 180deg at 50% 50%, hsl(var(--primary) / 0.0), hsl(var(--primary) / 0.28), hsl(var(--accent) / 0.18), hsl(var(--primary) / 0.0))",
        "panel-sheen":
          "linear-gradient(145deg, hsl(var(--card)), hsl(var(--secondary) / 0.36))"
      },
      boxShadow: {
        glow: "0 20px 60px hsl(var(--primary) / 0.10)",
        glass:
          "0 18px 48px hsl(216 42% 32% / 0.10), 0 2px 8px hsl(216 42% 32% / 0.04)",
        "energy-line":
          "0 0 0 1px hsl(var(--primary) / 0.10), 0 10px 24px hsl(var(--primary) / 0.10)"
      },
      keyframes: {
        "slow-pulse": {
          "0%, 100%": { opacity: "0.42", transform: "scale(1)" },
          "50%": { opacity: "0.78", transform: "scale(1.04)" }
        },
        "line-scan": {
          "0%": { transform: "translateX(-40%)", opacity: "0" },
          "18%, 76%": { opacity: "0.75" },
          "100%": { transform: "translateX(140%)", opacity: "0" }
        }
      },
      animation: {
        "slow-pulse": "slow-pulse 8s ease-in-out infinite",
        "line-scan": "line-scan 5.6s cubic-bezier(0.22, 1, 0.36, 1) infinite"
      }
    }
  },
  plugins: []
};

export default config;
