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
  // Every image is served straight from the public media bucket (plain <img>,
  // no next/image), so there is no image config to keep in step with it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // No script-src: Next's inline hydration scripts would need a nonce,
          // which would make every page dynamic. These are the directives that
          // cost nothing: no framing (clickjacking), no <base> hijack, no
          // plugins, and forms may only post to this origin.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
