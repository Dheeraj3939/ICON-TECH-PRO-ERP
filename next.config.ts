import type { NextConfig } from "next";
import path from "node:path";

export function isUatEnvironment(erpEnv?: string): boolean {
  if (erpEnv !== undefined) {
    return erpEnv.trim().toUpperCase() === 'UAT';
  }
  if (process.env.UAT_MODE === 'true') {
    return true;
  }
  const envVal = process.env.NEXT_PUBLIC_ERP_ENV || process.env.ERP_ENV;
  return envVal?.trim().toUpperCase() === 'UAT';
}

export function getDistDir(erpEnv?: string): string {
  return isUatEnvironment(erpEnv) ? '.next-uat' : '.next';
}

const isUat = isUatEnvironment();

const nextConfig: NextConfig = {
  distDir: getDistDir(),
  reactStrictMode: true,
  webpack(config) {
    if (isUatEnvironment()) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@/lib/constants/erp-data$': path.resolve(process.cwd(), 'src/lib/constants/erp-data.uat.ts'),
        '@/lib/constants/hr-data$': path.resolve(process.cwd(), 'src/lib/constants/hr-data.uat.ts'),
      };
    }
    return config;
  },
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
