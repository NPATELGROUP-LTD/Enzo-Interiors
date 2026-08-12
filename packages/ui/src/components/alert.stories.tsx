import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Alert, AlertDescription, AlertTitle } from './alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
  argTypes: {
    variant: { control: 'select', options: ['info', 'warning', 'danger', 'offline'] },
  },
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  render: (args) => (
    <Alert {...args} style={{ width: 420 }}>
      <AlertTitle>Estimate is indicative</AlertTitle>
      <AlertDescription>This price range is indicative until a consultation and site measurement.</AlertDescription>
    </Alert>
  ),
  args: { variant: 'info' },
};

export const Warning: Story = {
  render: (args) => (
    <Alert {...args} style={{ width: 420 }}>
      <AlertTitle>Quote expires soon</AlertTitle>
      <AlertDescription>This quote expires in 3 days.</AlertDescription>
    </Alert>
  ),
  args: { variant: 'warning' },
};

export const Danger: Story = {
  render: (args) => (
    <Alert {...args} style={{ width: 420 }}>
      <AlertTitle>Couldn't save changes</AlertTitle>
      <AlertDescription>Check your connection and try again.</AlertDescription>
    </Alert>
  ),
  args: { variant: 'danger' },
};

export const Dismissible: Story = {
  render: (args) => {
    const [visible, setVisible] = useState(true);
    if (!visible) return <p style={{ fontSize: 13 }}>Dismissed.</p>;
    return (
      <Alert {...args} onDismiss={() => setVisible(false)} style={{ width: 420 }}>
        <AlertTitle>New enquiry received</AlertTitle>
        <AlertDescription>A new contact form submission is waiting for review.</AlertDescription>
      </Alert>
    );
  },
  args: { variant: 'info' },
};
