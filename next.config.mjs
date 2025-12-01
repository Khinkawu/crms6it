import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['undici']
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
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