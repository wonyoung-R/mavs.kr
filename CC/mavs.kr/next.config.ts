import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: 's.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'nycoldtrqbkevvgoajlq.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'thesmokingcuban.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.vox-cdn.com',
      },
      {
        protocol: 'https',
        hostname: 'www.mavsmoneyball.com',
      },
      {
        protocol: 'https',
        hostname: 'platform.mavsmoneyball.com',
      },
      {
        protocol: 'https',
        hostname: 'images2.minutemediacdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.sbnation.com',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
