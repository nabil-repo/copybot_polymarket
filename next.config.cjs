/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    POLYMARKET_API_KEY: process.env.POLYMARKET_API_KEY,
  },
}

module.exports = nextConfig
