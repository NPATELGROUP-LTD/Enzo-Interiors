import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
  title: 'Components/Switch',
  component: Switch,
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Unchecked: Story = { args: {} };
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = { args: { 'aria-invalid': true } };
