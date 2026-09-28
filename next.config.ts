import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: '/dashboard/communications/gmail',
        destination: '/dashboard/communication/gmail',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
