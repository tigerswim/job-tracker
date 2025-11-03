import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true
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
