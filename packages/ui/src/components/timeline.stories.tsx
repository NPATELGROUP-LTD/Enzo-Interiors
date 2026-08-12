import type { Meta, StoryObj } from '@storybook/react-vite';

import { Timeline } from './timeline';

const meta: Meta<typeof Timeline> = {
  title: 'Components/Timeline',
  component: Timeline,
};
export default meta;

type Story = StoryObj<typeof Timeline>;

export const ProjectTimeline: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <Timeline
        items={[
          { id: 1, label: 'Consultation', timestamp: '2 Jul', status: 'complete' },
          { id: 2, label: 'Design', timestamp: '18 Jul', status: 'complete' },
          { id: 3, label: 'Approval', timestamp: '', description: 'Awaiting your decision on the mood board', status: 'current' },
          { id: 4, label: 'Installation', status: 'upcoming' },
          { id: 5, label: 'Completed', status: 'upcoming' },
        ]}
      />
    </div>
  ),
};
