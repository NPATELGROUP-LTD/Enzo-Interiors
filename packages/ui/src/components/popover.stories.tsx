import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
};
export default meta;

type Story = StoryObj<typeof Popover>;

export const MoveTo: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          Move to…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Move to stage</p>
          {['Consultation', 'Design', 'Approval', 'Installation', 'Completed'].map((stage) => (
            <button
              key={stage}
              type="button"
              style={{ textAlign: 'left', fontSize: 13, padding: '6px 8px', borderRadius: 6 }}
              className="hover:bg-muted"
            >
              {stage}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  ),
};
