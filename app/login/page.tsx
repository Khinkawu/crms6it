"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Wrench, Calendar, Package,
    Shield, ArrowRight, CheckCircle2
} from "lucide-react";

// Feature cards for the showcase
const features = [
    {
        icon: Wrench,
        title: "แจ้งซ่อมง่าย",
        description: "แจ้งปัญหาอุปกรณ์ ติดตามสถานะแบบ Real-time",
        color: "from-orange-500 to-red-500",
    },
    {
        icon: Calendar,
        title: "จองห้องออนไลน์",
        description: "จองห้องประชุมและอุปกรณ์ ไม่ต้องเดินมาจอง",
        color: "from-blue-500 to-cyan-500",
    },
    {
        icon: Package,
        title: "จัดการอุปกรณ์",
        description: "ยืม-คืน อุปกรณ์โสตทัศนศึกษา ครบจบในที่เดียว",
        color: "from-violet-500 to-purple-500",
    },
];

export default function LoginPage() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();
    const [currentFeature, setCurrentFeature] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            router.push("/");
        }
    }, [user, router]);

    // Auto-rotate features
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentFeature((prev) => (prev + 1) % features.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Feature Showcase (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400">
                {/* Animated Background Elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-1.5s" }} />
                    <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-300/10 rounded-full blur-2xl animate-float" style={{ animationDelay: "-3s" }} />
                </div>

                {/* Grid Pattern Overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                }} />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xl p-0.5 shadow-xl">
                            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                                <img src="/icon.png" alt="Logo" className="w-12 h-12 object-contain" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">CRMS6 IT</h1>
                            <p className="text-white/70 text-sm">งานโสตทัศนศึกษา</p>
                        </div>
                    </div>

                    {/* Hero Text */}
                    <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
                        ระบบบริหารจัดการ<br />
                        <span className="text-cyan-200">สำหรับงานโสตทัศนศึกษา</span><br />
                        โรงเรียนเทศบาล 6 นครเชียงราย
                    </h2>

                    <p className="text-lg text-white/80 mb-12 max-w-md">
                        แพลตฟอร์มสำหรับการจัดการอุปกรณ์โสตทัศนศึกษา<br />
                        จองห้องประชุม ระบบแจ้งซ่อม และประมวลผลภาพกิจกรรม
                    </p>

                    {/* Feature Carousel */}
                    <div className="relative h-32 mb-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentFeature}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.4 }}
                                className="absolute inset-0"
                            >
                                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 max-w-md">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${features[currentFeature].color}`}>
                                            {React.createElement(features[currentFeature].icon, { size: 24, className: "text-white" })}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg mb-1">
                                                {features[currentFeature].title}
                                            </h3>
                                            <p className="text-white/70 text-sm">
                                                {features[currentFeature].description}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Feature Indicators */}
                    <div className="flex gap-2">
                        {features.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentFeature(index)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentFeature
                                    ? "w-8 bg-white"
                                    : "w-2 bg-white/40 hover:bg-white/60"
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 relative overflow-hidden">
                {/* Background decoration for mobile */}
                <div className="absolute inset-0 lg:hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md relative z-10"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex flex-col items-center mb-10">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/30 mb-4">
                                <div className="w-full h-full rounded-[14px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                                    <img src="/icon.png" alt="Logo" className="w-14 h-14 object-contain" />
                                </div>
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                <Sparkles size={12} className="text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRMS6 IT</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">งานโสตทัศนศึกษา</p>
                    </div>

                    {/* Login Card */}
                    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-200/50 dark:border-gray-700/50">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                ยินดีต้อนรับ
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400">
                                เข้าสู่ระบบด้วยบัญชี Google ของโรงเรียน
                            </p>
                        </div>

                        {/* Benefits List */}
                        <div className="space-y-3 mb-8">
                            {[
                                "เข้าถึงทุกบริการได้ทันที",
                                "รับแจ้งเตือนผ่าน LINE",
                                "ปลอดภัยด้วย Google Account"
                            ].map((benefit, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + index * 0.1 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                                        <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">{benefit}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Sign In Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSignIn}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-lg transition-all group disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            ) : (
                                <img
                                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                    alt="Google"
                                    className="w-6 h-6"
                                />
                            )}
                            <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                {isLoading ? "กำลังเข้าสู่ระบบ..." : "Sign in with Google"}
                            </span>
                            {!isLoading && (
                                <ArrowRight size={18} className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                            )}
                        </motion.button>

                        {/* Email hint */}
                        <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-blue-500 flex-shrink-0" />
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    กรุณาใช้อีเมล @tesaban6.ac.th เท่านั้น
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
                        © {new Date().getFullYear()} CRMS6 IT Department. All rights reserved.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
