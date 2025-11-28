import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { AuthProvider } from "../context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Stock Management System",
    description: "Modern inventory management with Liquid Glass aesthetic",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.className} antialiased selection:bg-primary/30 selection:text-white`}>
                <AuthProvider>
                    <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-[#020617]"></div>
                    <Sidebar />
                    <main className="relative min-h-screen md:ml-64 p-4 md:p-8 transition-all duration-300">
                        <div className="max-w-7xl mx-auto pt-16 md:pt-0">
                            {children}
                        </div>
                    </main>
                </AuthProvider>
            </body>
        </html>
    );
}
