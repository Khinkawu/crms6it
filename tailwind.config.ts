import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#020617", // Slate 950
                surface: "#0f172a", // Slate 900
                primary: "#0ea5e9", // Sky 500
                secondary: "#38bdf8", // Sky 400
                accent: "#22d3ee", // Cyan 400
                "glass-border": "rgba(255, 255, 255, 0.08)",
                "glass-surface": "rgba(30, 41, 59, 0.4)", // Slate 800 with opacity
                "glass-highlight": "rgba(255, 255, 255, 0.05)",
            },
            backgroundImage: {
                "main-gradient": "radial-gradient(circle at top center, #0f172a 0%, #020617 100%)",
                "glow-gradient": "conic-gradient(from 180deg at 50% 50%, #0ea5e9 0deg, #22d3ee 180deg, #0ea5e9 360deg)",
            },
            boxShadow: {
                "glass": "0 4px 30px rgba(0, 0, 0, 0.1)",
                "glass-lg": "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
                "neon": "0 0 10px rgba(14, 165, 233, 0.5), 0 0 20px rgba(14, 165, 233, 0.3)",
            },
            backdropBlur: {
                "glass": "12px",
            },
            animation: {
                "float": "float 6s ease-in-out infinite",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
