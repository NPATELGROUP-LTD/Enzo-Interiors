import type { Meta, StoryObj } from '@storybook/react-vite';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

const meta: Meta<typeof Command> = {
  title: 'Components/Command',
  component: Command,
};
export default meta;

type Story = StoryObj<typeof Command>;

export const GlobalSearch: Story = {
  render: () => (
    <Command style={{ width: 320, border: '1px solid var(--border)' }}>
      <CommandInput placeholder="Search clients, projects, quotes..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Clients">
          <CommandItem>Smith Residence</CommandItem>
          <CommandItem>Chen Family</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Projects">
          <CommandItem>Kitchen Renovation — Smith Residence</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
