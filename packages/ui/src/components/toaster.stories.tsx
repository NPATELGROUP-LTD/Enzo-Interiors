import type { Meta, StoryObj } from '@storybook/react-vite';
import { toast } from 'sonner';

import { Button } from './button';
import { Toaster } from './toaster';

const meta: Meta<typeof Toaster> = {
  title: 'Components/Toaster',
  component: Toaster,
};
export default meta;

type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div>
      <Toaster />
      <Button onClick={() => toast('Quote sent to client')}>Trigger toast</Button>
    </div>
  ),
};
