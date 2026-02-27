import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import ClientLayout from "./components/ClientLayout";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { Toaster } from "react-hot-toast";

const prompt = Prompt({
    subsets: ["latin", "thai"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-prompt",
});

export const metadata: Metadata = {
    title: {
        template: "CRMS6 IT - %s",
        default: "CRMS6 IT",
    },
    description: "ระบบสารสนเทศเพื่อการบริหารจัดการงานโสตทัศนศึกษา by CRMS6 IT",
    appleWebApp: {
        statusBarStyle: "default",
        title: "CRMS6 IT",
    },
    other: {
        "mobile-web-app-capable": "yes",
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Inline script to prevent theme flash before React hydrates
    const themeScript = `
        (function() {
            try {
                const saved = localStorage.getItem('theme');
                const theme = saved || 'light';
                let resolved = theme;
                if (theme === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.classList.add(resolved);
            } catch (e) {}
        })();
    `;

    return (
        <html lang="th" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            </head>
            <body className={`${prompt.variable} font-sans antialiased`}>
                <ThemeProvider>
                    <AuthProvider>
                        <ClientLayout>
                            {children}
                        </ClientLayout>
                        <Toaster
                            position="top-center"
                            containerStyle={{
                                zIndex: 99999,
                            }}
                            toastOptions={{
                                style: {
                                    background: 'var(--card)',
                                    color: 'var(--text)',
                                    border: '1px solid var(--border)',
                                    fontFamily: 'var(--font-prompt)',
                                    borderRadius: '12px',
                                },
                                success: {
                                    iconTheme: {
                                        primary: '#10b981',
                                        secondary: 'white',
                                    },
                                },
                                error: {
                                    iconTheme: {
                                        primary: '#ef4444',
                                        secondary: 'white',
                                    },
                                },
                            }}
                        />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
