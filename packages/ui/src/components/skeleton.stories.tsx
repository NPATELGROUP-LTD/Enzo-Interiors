import type { Meta, StoryObj } from '@storybook/react-vite';

import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => <Skeleton style={{ width: 240, height: 20 }} />,
};

export const CardLoading: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 240 }}>
      <Skeleton style={{ width: '60%', height: 12 }} />
      <Skeleton style={{ width: '100%', height: 32 }} />
      <Skeleton style={{ width: '80%', height: 12 }} />
    </div>
  ),
};
