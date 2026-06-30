import { fileURLToPath } from 'url'
import path from 'path'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Needed for docker
  // Trace from the monorepo root so standalone output bundles workspace packages.
  outputFileTracingRoot: repoRoot,
  // Shared workspace packages ship raw TS/TSX source; Next must transpile them.
  transpilePackages: ['@vectra/ui', '@vectra/auth', '@vectra/api-client', '@vectra/types', '@vectra/data'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

export default nextConfig
