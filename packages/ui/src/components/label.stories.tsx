import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = { args: { children: 'Email address', htmlFor: 'email' } };

export const WithInput: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 280 }}>
      <Label htmlFor="client-email">Email address</Label>
      <Input id="client-email" type="email" placeholder="client@example.com" />
    </div>
  ),
};
