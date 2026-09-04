import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  eslint: {
    // Lint is not a deploy gate: the existing `any` backlog would block every
    // build. Run it explicitly with `npm run lint` and burn the backlog down.
    // Type errors DO block the build (see typescript.ignoreBuildErrors below).
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors fail the build. Keep this false.
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    // Use native file watching on macOS (more memory-efficient than polling)
    config.watchOptions = {
      ignored: ['**/node_modules', '**/.git', '**/.next'],
    }
    return config
  }
};

export default nextConfig;
