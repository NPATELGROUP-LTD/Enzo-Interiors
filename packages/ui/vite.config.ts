import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Picked up automatically by @storybook/react-vite (and by any consuming
// app's own Vite config that imports this package) so tokens.css's
// Tailwind v4 @theme/@import directives actually get compiled — without
// this, `bg-primary`/`rounded-md`/etc. are just unrecognized class names
// and every component renders unstyled.
export default defineConfig({
  plugins: [tailwindcss()],
});
