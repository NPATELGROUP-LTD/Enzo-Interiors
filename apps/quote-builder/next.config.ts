import type { NextConfig } from 'next';

// A local prototype, deliberately outside the website's build and deploy.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['10.20.0.195'],
};

export default nextConfig;
