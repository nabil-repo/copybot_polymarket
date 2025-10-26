/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Avoid optional deps causing resolution errors in SSR
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  env: {
    POLYMARKET_API_KEY: process.env.POLYMARKET_API_KEY,
  },
}

module.exports = nextConfig
