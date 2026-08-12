import * as React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';

import { cn } from '../lib/utils';
import { Avatar, AvatarFallback } from './avatar';
import { Badge } from './badge';
import { Card } from './card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Button } from './button';

const KANBAN_ITEM_TYPE = 'kanban-card';

export interface KanbanCardData {
  id: string;
  title: string;
  clientName?: string;
  dueDate?: string;
  assigneeName?: string;
}

export interface KanbanColumnData {
  id: string;
  label: string;
  cards: KanbanCardData[];
}

export interface KanbanBoardProps {
  columns: KanbanColumnData[];
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  /** Set false if the consuming app already wraps its tree in a react-dnd `DndProvider` — avoids nested providers. */
  withDndProvider?: boolean;
}

interface DragItem {
  id: string;
  fromColumnId: string;
}

function KanbanCard({
  card,
  columnId,
  columns,
  onMove,
}: {
  card: KanbanCardData;
  columnId: string;
  columns: KanbanColumnData[];
  onMove: KanbanBoardProps['onMoveCard'];
}) {
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>(() => ({
    type: KANBAN_ITEM_TYPE,
    item: { id: card.id, fromColumnId: columnId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  return (
    <div ref={drag as unknown as React.Ref<HTMLDivElement>} className={cn(isDragging && 'opacity-40')}>
      <Card className="gap-2 p-3">
        <p className="text-sm font-semibold">{card.title}</p>
        {card.clientName ? <p className="text-[13px] text-muted-foreground">{card.clientName}</p> : null}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {card.dueDate ? <Badge variant="neutral">{card.dueDate}</Badge> : null}
            {card.assigneeName ? (
              <Avatar size="sm">
                <AvatarFallback>
                  {card.assigneeName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
            ) : null}
          </div>
          {/* Mandatory non-drag alternative to drag-and-drop, per the brief's Kanban a11y requirement. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary">
                Move to…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns
                .filter((c) => c.id !== columnId)
                .map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => onMove(card.id, columnId, c.id)}>
                    {c.label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
}

function KanbanColumn({
  column,
  columns,
  onMove,
}: {
  column: KanbanColumnData;
  columns: KanbanColumnData[];
  onMove: KanbanBoardProps['onMoveCard'];
}) {
  const [{ isOver }, drop] = useDrop<DragItem, unknown, { isOver: boolean }>(() => ({
    accept: KANBAN_ITEM_TYPE,
    drop: (item) => {
      if (item.fromColumnId !== column.id) onMove(item.id, item.fromColumnId, column.id);
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  }));

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={cn('flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted p-3', isOver && 'ring-2 ring-primary')}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{column.label}</span>
        <Badge variant="neutral">{column.cards.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {column.cards.map((card) => (
          <KanbanCard key={card.id} card={card} columnId={column.id} columns={columns} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

/**
 * 5-stage project board — drag-and-drop with a mandatory non-drag alternative.
 *
 * Used by: apps/admin (Projects Kanban — Consultation → Design → Approval →
 * Installation → Completed).
 * Variants: none — `columns` defines the stages and their cards; `onMoveCard`
 * fires from EITHER interaction path (drag-drop or the "Move to…" menu on
 * each card) with the same signature, so the app only needs one handler.
 * A11y: drag-and-drop is progressive enhancement only — every card's
 * "Move to…" menu is the required accessible alternative per the brief's
 * explicit Kanban requirement ("Move to… alongside drag-and-drop"), not an
 * afterthought. `withDndProvider` defaults true; set false if the app
 * already has a `DndProvider` higher in its tree.
 * Brief v6 deviations: none — new composition, not ported. Uses `react-dnd`
 * + `react-dnd-html5-backend` (the drag-and-drop library already present
 * as a dependency on the `Boilerplate` branch) rather than introducing a
 * different DnD library.
 */
function KanbanBoard({ columns, onMoveCard, withDndProvider = true }: KanbanBoardProps) {
  const content = (
    <div data-slot="kanban-board" className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <KanbanColumn key={column.id} column={column} columns={columns} onMove={onMoveCard} />
      ))}
    </div>
  );

  if (!withDndProvider) return content;

  return <DndProvider backend={HTML5Backend}>{content}</DndProvider>;
}

export { KanbanBoard, KanbanCard, KanbanColumn };
