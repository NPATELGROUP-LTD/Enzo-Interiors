import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: 'client@example.com', type: 'email' } };
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true } };
export const Error: Story = { args: { placeholder: 'Invalid value', 'aria-invalid': true } };
export const Success: Story = { args: { defaultValue: 'client@example.com', success: true } };
