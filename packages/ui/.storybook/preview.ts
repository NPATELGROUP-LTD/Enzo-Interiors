import type { Preview } from '@storybook/react-vite';

import '../src/styles/tokens.css';

/**
 * Renders stories against the real Brief v6 tokens (green-900 primary,
 * canvas background, Inter, 8px/12px radii) — not unstyled markup — so
 * Storybook doubles as visual QA against docs/Enzo_Interiors_UI_UX_Brief_v6.md.
 */
const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'canvas',
      values: [{ name: 'canvas', value: '#F7F5F0' }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
