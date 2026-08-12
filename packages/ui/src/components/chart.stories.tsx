import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './chart';

const meta: Meta<typeof ChartContainer> = {
  title: 'Components/Chart',
  component: ChartContainer,
};
export default meta;

type Story = StoryObj<typeof ChartContainer>;

const data = [
  { month: 'Mar', bookings: 18 },
  { month: 'Apr', bookings: 22 },
  { month: 'May', bookings: 27 },
  { month: 'Jun', bookings: 24 },
  { month: 'Jul', bookings: 31 },
];

const config = {
  bookings: { label: 'Bookings', color: 'var(--primary)' },
} satisfies ChartConfig;

export const BookingsTrend: Story = {
  render: () => (
    <ChartContainer config={config} style={{ width: 420, height: 240 }}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="bookings" fill="var(--color-bookings)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};
