import { fileURLToPath } from 'url'
import path from 'path'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Trace from the monorepo root so standalone output bundles workspace packages.
  outputFileTracingRoot: repoRoot,
  transpilePackages: ['@vectra/ui', '@vectra/auth', '@vectra/api-client', '@vectra/types', '@vectra/data'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
