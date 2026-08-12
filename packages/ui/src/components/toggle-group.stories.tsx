import type { Meta, StoryObj } from '@storybook/react-vite';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const meta: Meta<typeof ToggleGroup> = {
  title: 'Components/ToggleGroup',
  component: ToggleGroup,
};
export default meta;

type Story = StoryObj<typeof ToggleGroup>;

export const CategoryFilter: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="kitchens" variant="outline">
      <ToggleGroupItem value="kitchens">Kitchens</ToggleGroupItem>
      <ToggleGroupItem value="bedrooms">Bedrooms</ToggleGroupItem>
      <ToggleGroupItem value="media-walls">Media Walls</ToggleGroupItem>
      <ToggleGroupItem value="wardrobes">Wardrobes</ToggleGroupItem>
    </ToggleGroup>
  ),
};
