import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table';

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
};
export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Recent invoices</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>INV-2026-0041</TableCell>
          <TableCell>Smith Residence</TableCell>
          <TableCell>£4,200.00</TableCell>
          <TableCell>
            <Badge variant="success">Paid</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>INV-2026-0042</TableCell>
          <TableCell>Chen Family</TableCell>
          <TableCell>£1,850.00</TableCell>
          <TableCell>
            <Badge variant="warning">Outstanding</Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>INV-2026-0043</TableCell>
          <TableCell>Okafor Household</TableCell>
          <TableCell>£950.00</TableCell>
          <TableCell>
            <Badge variant="danger">Overdue</Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const Loading: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3].map((row) => (
          <TableRow key={row}>
            <TableCell>
              <Skeleton style={{ height: 16, width: 100 }} />
            </TableCell>
            <TableCell>
              <Skeleton style={{ height: 16, width: 140 }} />
            </TableCell>
            <TableCell>
              <Skeleton style={{ height: 16, width: 80 }} />
            </TableCell>
            <TableCell>
              <Skeleton style={{ height: 16, width: 60 }} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      variant="empty"
      title="No invoices yet"
      description="Invoices you create will appear here."
      action={<Button size="sm">Create invoice</Button>}
    />
  ),
};

export const ErrorState: Story = {
  render: () => (
    <EmptyState
      variant="error"
      title="Couldn't load invoices"
      description="Something went wrong fetching this data."
      action={
        <Button size="sm" variant="secondary">
          Retry
        </Button>
      }
    />
  ),
};
