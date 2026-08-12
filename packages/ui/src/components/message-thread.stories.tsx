import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar, AvatarFallback } from './avatar';
import { MessageThread } from './message-thread';

const meta: Meta<typeof MessageThread> = {
  title: 'Components/MessageThread',
  component: MessageThread,
};
export default meta;

type Story = StoryObj<typeof MessageThread>;

export const Conversation: Story = {
  render: () => (
    <div style={{ width: 360, height: 320, border: '1px solid var(--border)', borderRadius: 12 }}>
      <MessageThread
        style={{ height: '100%' }}
        typing
        items={[
          {
            id: 1,
            dateDivider: 'Today',
            sender: 'other',
            body: 'Hi! Just confirming the site measurement for Tuesday at 10am.',
            timestamp: '10:02',
            avatar: (
              <Avatar size="sm">
                <AvatarFallback>PP</AvatarFallback>
              </Avatar>
            ),
          },
          { id: 2, sender: 'self', body: 'That works for us, see you then!', timestamp: '10:05', read: true },
        ]}
      />
    </div>
  ),
};
