/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
    serverComponentsExternalPackages: [
      '@whiskeysockets/baileys',
      'ws',
      'pino',
      'pg',
      'bull',
      'ioredis',
    ],
  },
};

export default nextConfig;
