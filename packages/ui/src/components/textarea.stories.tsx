import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
};
export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = { args: { placeholder: 'Project notes...' } };
export const Disabled: Story = { args: { placeholder: 'Disabled', disabled: true } };
export const Error: Story = { args: { placeholder: 'Project notes...', 'aria-invalid': true } };
export const Success: Story = { args: { defaultValue: 'Site measurement booked for 14 Sept.', success: true } };
