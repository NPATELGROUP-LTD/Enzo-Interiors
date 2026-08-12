import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stepper } from './stepper';

const meta: Meta<typeof Stepper> = {
  title: 'Components/Stepper',
  component: Stepper,
};
export default meta;

type Story = StoryObj<typeof Stepper>;

export const BookingWizard: Story = {
  render: () => (
    <div style={{ width: 480 }}>
      <Stepper
        steps={[
          { id: 1, label: 'Service', status: 'complete' },
          { id: 2, label: 'Date', status: 'complete' },
          { id: 3, label: 'Time', status: 'current' },
          { id: 4, label: 'Contact', status: 'upcoming' },
          { id: 5, label: 'Confirm', status: 'upcoming' },
        ]}
      />
    </div>
  ),
};
