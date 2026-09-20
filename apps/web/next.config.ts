import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle with only the node_modules it
  // actually imports, which is what the Docker image copies. Without this the
  // runtime stage would need the whole dependency tree.
  output: 'standalone',
  // Allow LAN devices (e.g. homelab test VMs/phones) to load dev-mode
  // Next.js chunks. Dev-only — has no effect on production builds.
  allowedDevOrigins: ['10.20.0.195'],
  // apps/web never talks to the DB or S3 directly — all data comes from
  // apps/api. Images uploaded through the CMS are served from the public
  // object-storage bucket, whose host differs per environment, so it is read
  // from the same variable the API signs uploads against rather than hard-coded
  // (see docs/Enzo_Interiors_Storage_Schema_v1.md).
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_MEDIA_BASE_URL
      ? [
          {
            protocol: new URL(process.env.NEXT_PUBLIC_MEDIA_BASE_URL).protocol.replace(
              ':',
              '',
            ) as 'http' | 'https',
            hostname: new URL(process.env.NEXT_PUBLIC_MEDIA_BASE_URL).hostname,
            port: new URL(process.env.NEXT_PUBLIC_MEDIA_BASE_URL).port || undefined,
            pathname: '/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
