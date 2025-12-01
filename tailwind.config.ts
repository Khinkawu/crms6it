import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-prompt)", "sans-serif"],
                sarabun: ["THSarabunIT", "sans-serif"],
            },
            colors: {
                background: "var(--background)",
                card: "var(--card)",
                text: "var(--text)",
                "text-secondary": "var(--text-secondary)",
                border: "var(--border)",
                "input-bg": "var(--input-bg)",
                "primary-start": "var(--primary-start)",
                "primary-end": "var(--primary-end)",
            },
            backgroundImage: {
                "brand-gradient": "linear-gradient(to right, var(--primary-start), var(--primary-end))",
            },
            boxShadow: {
                "soft": "0 2px 10px rgba(0, 0, 0, 0.03)",
                "soft-md": "0 4px 20px rgba(0, 0, 0, 0.05)",
                "soft-lg": "0 10px 40px rgba(0, 0, 0, 0.08)",
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-out",
                "fade-in-up": "fadeInUp 0.5s ease-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [],
};
export default config;
