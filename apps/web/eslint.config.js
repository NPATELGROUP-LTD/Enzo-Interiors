import nextConfig from 'eslint-config-next';
import rootConfig from '../../eslint.config.js';

const config = [
  ...rootConfig,
  ...nextConfig,
  {
    ignores: ['.next/**'],
  },
];

export default config;
