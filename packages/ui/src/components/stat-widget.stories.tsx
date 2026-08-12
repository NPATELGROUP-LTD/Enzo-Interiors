import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bar, BarChart } from 'recharts';

import { ChartContainer, type ChartConfig } from './chart';
import { StatWidget } from './stat-widget';

const meta: Meta<typeof StatWidget> = {
  title: 'Components/StatWidget',
  component: StatWidget,
};
export default meta;

type Story = StoryObj<typeof StatWidget>;

export const WithTrend: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <StatWidget eyebrow="Revenue this month" metric="£24.8k" trend={{ value: 12, direction: 'up', label: 'vs last month' }} />
    </div>
  ),
};

export const NegativeTrend: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <StatWidget eyebrow="Outstanding invoices" metric="£8.4k" accent="danger" trend={{ value: 8, direction: 'up', tone: 'danger', label: 'vs last month' }} />
    </div>
  ),
};

const sparkData = [{ v: 4 }, { v: 7 }, { v: 5 }, { v: 9 }, { v: 8 }, { v: 12 }];
const sparkConfig = { v: { label: 'Bookings', color: 'var(--primary)' } } satisfies ChartConfig;

export const WithChart: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <StatWidget
        eyebrow="Bookings"
        metric="24"
        trend={{ value: 6, direction: 'up' }}
        chart={
          <ChartContainer config={sparkConfig} style={{ height: 48 }}>
            <BarChart data={sparkData}>
              <Bar dataKey="v" fill="var(--color-v)" radius={2} />
            </BarChart>
          </ChartContainer>
        }
      />
    </div>
  ),
};
