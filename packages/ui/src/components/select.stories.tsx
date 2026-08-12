import type { Meta, StoryObj } from '@storybook/react-vite';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger style={{ width: 220 }}>
        <SelectValue placeholder="Assign designer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="priya">Priya Patel</SelectItem>
        <SelectItem value="james">James Okafor</SelectItem>
        <SelectItem value="anya">Anya Kowalski</SelectItem>
      </SelectContent>
    </Select>
  ),
};
