import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from './badge';
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
