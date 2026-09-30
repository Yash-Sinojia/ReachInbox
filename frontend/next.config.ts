import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for production builds — Tailwind v4 CSS (@layer properties)
  // causes a "dangling combinator" parse error in the Turbopack CSS parser.
  // Webpack handles the same CSS correctly.
  experimental: {
    turbopack: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
