import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }}>
      <CardHeader>
        <CardTitle>Kitchen Renovation — Smith Residence</CardTitle>
        <CardDescription>Consultation stage, assigned to Priya Patel</CardDescription>
        <CardAction>
          <Button size="sm" variant="secondary">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Site measurement booked for 14 Sept. Awaiting mood board approval.</p>
      </CardContent>
      <CardFooter>
        <Button variant="primary">View project</Button>
      </CardFooter>
    </Card>
  ),
};
