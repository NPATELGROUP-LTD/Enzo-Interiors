import type { Meta, StoryObj } from '@storybook/react-vite';

import { TextLink } from './link';

const meta: Meta<typeof TextLink> = {
  title: 'Components/TextLink',
  component: TextLink,
};
export default meta;

type Story = StoryObj<typeof TextLink>;

export const Default: Story = {
  args: { children: 'View projects', href: '#' },
};

export const Disabled: Story = {
  args: { children: 'View projects', disabled: true },
};
