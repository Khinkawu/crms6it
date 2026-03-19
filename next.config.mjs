import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    // Block clickjacking — prevent embedding in <iframe> from other origins
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    // Prevent MIME-type sniffing
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    // Limit referrer info sent to external sites
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    // Restrict browser feature access
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    // CSP — allows Next.js/Firebase/LINE while blocking framing from unknown origins
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.googleapis.com apis.google.com *.line-scdn.net",
                            "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
                            "img-src * data: blob:",
                            "connect-src 'self' *.googleapis.com *.firebaseio.com wss://*.firebaseio.com firebasestorage.googleapis.com *.cloudfunctions.net *.google.com",
                            "font-src 'self' fonts.gstatic.com data:",
                            "frame-src 'self' blob: *.line.me accounts.google.com",
                            "frame-ancestors 'self'",
                        ].join('; '),
                    },
                ],
            },
        ];
    },
    experimental: {
        serverComponentsExternalPackages: ['undici'],
        optimizePackageImports: ['lucide-react', 'react-big-calendar']
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'firebasestorage.googleapis.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com', // Google profile images
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'www.gstatic.com', // Google favicon/icons
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'www.google.com', // Google favicon
                port: '',
                pathname: '/**',
            },
        ],
        // Image optimization settings
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60 * 60 * 24, // 24 hours
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                undici: false,
            };
            config.resolve.alias = {
                ...config.resolve.alias,
                undici: false,
                'firebase/auth': path.join(process.cwd(), 'node_modules/firebase/auth/dist/esm/index.esm.js'),
            };
        }
        return config;
    },
};

export default nextConfig;