/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Needed for docker
  // Shared workspace packages ship raw TS/TSX source; Next must transpile them.
  transpilePackages: ['@vectra/ui', '@vectra/auth', '@vectra/api-client', '@vectra/types'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

export default nextConfig
