import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar, AvatarFallback } from './avatar';
import { MessageBubble } from './message-bubble';

const meta: Meta<typeof MessageBubble> = {
  title: 'Components/MessageBubble',
  component: MessageBubble,
};
export default meta;

type Story = StoryObj<typeof MessageBubble>;

export const FromOther: Story = {
  args: {
    sender: 'other',
    body: 'Hi! Just confirming the site measurement for Tuesday at 10am.',
    timestamp: '10:02',
    avatar: (
      <Avatar size="sm">
        <AvatarFallback>PP</AvatarFallback>
      </Avatar>
    ),
  },
};

export const FromSelfRead: Story = {
  args: {
    sender: 'self',
    body: 'That works for us, see you then!',
    timestamp: '10:05',
    read: true,
  },
};
