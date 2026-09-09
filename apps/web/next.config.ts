import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow LAN devices (e.g. homelab test VMs/phones) to load dev-mode
  // Next.js chunks. Dev-only — has no effect on production builds.
  allowedDevOrigins: ['10.20.0.195'],
  // apps/web never talks to the DB or S3 directly — all data comes from
  // apps/api. Remote image domains will be added here once the API's
  // signed-URL host is known (see docs/Enzo_Interiors_Storage_Schema_v1.md).
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
