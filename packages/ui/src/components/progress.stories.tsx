import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  argTypes: {
    variant: { control: 'select', options: ['default', 'success', 'warning'] },
    value: { control: { type: 'range', min: 0, max: 100 } },
  },
};
export default meta;

type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: { value: 65 },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress {...args} />
    </div>
  ),
};

export const Success: Story = {
  args: { value: 100, variant: 'success' },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress {...args} />
    </div>
  ),
};

export const Warning: Story = {
  args: { value: 30, variant: 'warning' },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Progress {...args} />
    </div>
  ),
};
