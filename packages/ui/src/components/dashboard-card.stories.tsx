import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';
import { DashboardCard } from './dashboard-card';
import { TextLink } from './link';

const meta: Meta<typeof DashboardCard> = {
  title: 'Components/DashboardCard',
  component: DashboardCard,
  argTypes: {
    accent: { control: 'select', options: ['primary', 'success', 'warning', 'danger', 'neutral'] },
  },
};
export default meta;

type Story = StoryObj<typeof DashboardCard>;

export const ActiveProjects: Story = {
  args: {
    eyebrow: 'Active projects',
    metric: '24',
    context: '16 on track; 3 need a decision',
    bottom: <TextLink href="#">View projects</TextLink>,
    accent: 'primary',
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <DashboardCard {...args} />
    </div>
  ),
};

export const OutstandingInvoices: Story = {
  args: {
    eyebrow: 'Outstanding invoices',
    metric: '£8.4k',
    context: '£1.2k due this week',
    bottom: <Badge variant="danger">1 overdue</Badge>,
    accent: 'danger',
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <DashboardCard {...args} />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    eyebrow: "Today's bookings",
    metric: '06',
    context: 'First appointment at 09:30',
    bottom: <Badge variant="warning">2 awaiting confirmation</Badge>,
    accent: 'success',
    interactive: true,
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <DashboardCard {...args} />
    </div>
  ),
};
