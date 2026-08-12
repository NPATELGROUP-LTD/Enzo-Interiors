import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { KanbanBoard, type KanbanColumnData } from './kanban';

const meta: Meta<typeof KanbanBoard> = {
  title: 'Components/KanbanBoard',
  component: KanbanBoard,
};
export default meta;

type Story = StoryObj<typeof KanbanBoard>;

const initialColumns: KanbanColumnData[] = [
  {
    id: 'consultation',
    label: 'Consultation',
    cards: [{ id: '1', title: 'Kitchen Renovation', clientName: 'Smith Residence', dueDate: '14 Sep', assigneeName: 'Priya Patel' }],
  },
  {
    id: 'design',
    label: 'Design',
    cards: [{ id: '2', title: 'Media Wall', clientName: 'Chen Family', dueDate: '20 Sep', assigneeName: 'James Okafor' }],
  },
  { id: 'approval', label: 'Approval', cards: [] },
  { id: 'installation', label: 'Installation', cards: [] },
  { id: 'completed', label: 'Completed', cards: [] },
];

export const ProjectsBoard: Story = {
  render: () => {
    const [columns, setColumns] = useState(initialColumns);

    const handleMove = (cardId: string, from: string, to: string) => {
      setColumns((prev) => {
        const fromCol = prev.find((c) => c.id === from);
        const card = fromCol?.cards.find((c) => c.id === cardId);
        if (!card) return prev;
        return prev.map((col) => {
          if (col.id === from) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          if (col.id === to) return { ...col, cards: [...col.cards, card] };
          return col;
        });
      });
    };

    return <KanbanBoard columns={columns} onMoveCard={handleMove} />;
  },
};
