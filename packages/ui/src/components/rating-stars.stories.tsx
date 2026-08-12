import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { RatingStars } from './rating-stars';

const meta: Meta<typeof RatingStars> = {
  title: 'Components/RatingStars',
  component: RatingStars,
};
export default meta;

type Story = StoryObj<typeof RatingStars>;

export const ReadOnly: Story = {
  args: { value: 4, max: 5, readOnly: true },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(3);
    return <RatingStars value={value} onChange={setValue} readOnly={false} />;
  },
};
