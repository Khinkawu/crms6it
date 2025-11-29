import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import ClientLayout from "./components/ClientLayout";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";

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
    description: "Audio Visual Department Management System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${prompt.variable} font-sans antialiased`}>
                <ThemeProvider>
                    <AuthProvider>
                        <ClientLayout>
                            {children}
                        </ClientLayout>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
