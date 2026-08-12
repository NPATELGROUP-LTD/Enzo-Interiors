import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { EmptyState } from './empty-state';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  argTypes: {
    variant: { control: 'select', options: ['empty', 'error', 'loading'] },
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Empty: Story = {
  args: {
    variant: 'empty',
    title: 'No clients yet',
    description: 'Clients you add will appear here.',
    action: <Button size="sm">Add client</Button>,
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    title: "Couldn't load invoices",
    description: 'Something went wrong fetching this data. Try again.',
    action: (
      <Button size="sm" variant="secondary">
        Retry
      </Button>
    ),
  },
};

export const Loading: Story = {
  args: {
    variant: 'loading',
    title: 'Loading projects…',
  },
};
