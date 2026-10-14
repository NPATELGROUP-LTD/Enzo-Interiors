import nextConfig from 'eslint-config-next';

// Self-contained: eslint-config-next already brings typescript-eslint, and
// importing the repo root's config as well registered that plugin twice
// ("Cannot redefine plugin").
const config = [
  ...nextConfig,
  {
    ignores: ['.next/**'],
  },
];

export default config;
