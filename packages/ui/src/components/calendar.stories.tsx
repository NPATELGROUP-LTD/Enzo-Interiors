import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Calendar } from './calendar';

const meta: Meta<typeof Calendar> = {
  title: 'Components/Calendar',
  component: Calendar,
};
export default meta;

type Story = StoryObj<typeof Calendar>;

export const SingleDate: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return <Calendar mode="single" selected={date} onSelect={setDate} />;
  },
};

export const DateRange: Story = {
  render: () => <Calendar mode="range" />,
};
