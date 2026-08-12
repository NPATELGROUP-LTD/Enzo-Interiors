import type { Meta, StoryObj } from '@storybook/react-vite';

import { OfflineBanner } from './offline-banner';

const meta: Meta<typeof OfflineBanner> = {
  title: 'Components/OfflineBanner',
  component: OfflineBanner,
  argTypes: {
    status: { control: 'select', options: ['offline', 'reconnecting', 'restored'] },
  },
};
export default meta;

type Story = StoryObj<typeof OfflineBanner>;

export const Offline: Story = {
  args: { status: 'offline' },
  render: (args) => (
    <div style={{ position: 'relative', height: 120 }}>
      <OfflineBanner {...args} />
    </div>
  ),
};

export const Reconnecting: Story = {
  args: { status: 'reconnecting' },
  render: (args) => (
    <div style={{ position: 'relative', height: 120 }}>
      <OfflineBanner {...args} />
    </div>
  ),
};

export const Restored: Story = {
  args: { status: 'restored' },
  render: (args) => (
    <div style={{ position: 'relative', height: 120 }}>
      <OfflineBanner {...args} />
    </div>
  ),
};
