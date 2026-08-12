import type { Meta, StoryObj } from '@storybook/react-vite';

import { ActionButtonGroup } from './action-button-group';

const meta: Meta<typeof ActionButtonGroup> = {
  title: 'Components/ActionButtonGroup',
  component: ActionButtonGroup,
};
export default meta;

type Story = StoryObj<typeof ActionButtonGroup>;

export const Default: Story = {
  args: {
    onApprove: () => {},
    onDecline: () => {},
  },
};

export const PendingApprove: Story = {
  args: {
    onApprove: () => {},
    onDecline: () => {},
    pending: 'approve',
  },
};
