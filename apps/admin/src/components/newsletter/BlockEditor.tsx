import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowDown, ArrowUp, DotsSixVertical, Image as ImageIcon, Plus, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState, type ReactNode } from 'react';

import { Button, FIELD_BASE } from '@/components/ui';

import { BLOCK_TYPES, emptyBlock, linkOf, type Block, type BlockType } from './blocks';

const LABEL: Record<Block['type'], string> = {
  heading: 'Heading',
  text: 'Text',
  image: 'Image',
  button: 'Button',
  columns: 'Two columns',
  divider: 'Divider',
  legacy: 'Earlier content',
};

const AREA = clsx(FIELD_BASE, 'min-h-[5.5rem] resize-y py-2 leading-relaxed');

/**
 * The newsletter's blocks, typed into directly: no HTML anywhere. A block is dragged by its handle
 * (or moved with the arrow buttons, which also serve a phone and the keyboard) and removed with the
 * bin. Choosing an image is the page's job (`onPickImage`), since it owns the media library.
 */
export function BlockEditor({
  blocks,
  onChange,
  onPickImage,
}: {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  onPickImage: (id: string) => void;
}) {
  // A small drag distance, so a tap on the handle's neighbours never starts one.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const patch = (id: string, changes: Partial<Block>) =>
    onChange(blocks.map((block) => (block.id === id ? ({ ...block, ...changes } as Block) : block)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = blocks.slice();
    next.splice(to, 0, next.splice(from, 1)[0]!);
    onChange(next);
  };
  const add = (type: BlockType) => onChange([...blocks, emptyBlock(type)]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      blocks.findIndex((block) => block.id === active.id),
      blocks.findIndex((block) => block.id === over.id),
    );
  };

  return (
    <div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <ol className="flex flex-col gap-3">
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              first={index === 0}
              last={index === blocks.length - 1}
              onMove={(by) => move(index, index + by)}
              onRemove={() => onChange(blocks.filter((row) => row.id !== block.id))}
            >
              <BlockFields block={block} patch={(changes) => patch(block.id, changes)} onPickImage={() => onPickImage(block.id)} />
            </BlockRow>
          ))}
        </ol>
      </DndContext>

      {blocks.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-ink-muted">
          Nothing here yet. Add the first block below.
        </p>
      ) : null}

      <div className="mt-4 rounded-card border border-dashed border-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted">
          <Plus size={14} aria-hidden="true" /> Add a block
        </p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map(({ type, label }) => (
            <Button key={type} onClick={() => add(type)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockRow({
  block,
  first,
  last,
  onMove,
  onRemove,
  children,
}: {
  block: Block;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const drag = useDraggable({ id: block.id });
  const drop = useDroppable({ id: block.id });
  const tool =
    'flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent pointer-coarse:h-11 pointer-coarse:w-11';
  return (
    <li
      ref={drop.setNodeRef}
      className={clsx(
        'rounded-card bg-surface p-3 shadow-soft transition-shadow',
        drop.isOver && !drag.isDragging && 'ring-2 ring-green-900/40',
        drag.isDragging && 'opacity-60',
      )}
    >
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          aria-label={`Drag the ${LABEL[block.type].toLowerCase()} block to move it`}
          className={clsx(tool, 'cursor-grab touch-none active:cursor-grabbing')}
        >
          <DotsSixVertical size={18} weight="bold" aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-muted">{LABEL[block.type]}</span>
        <button type="button" aria-label="Move up" disabled={first} onClick={() => onMove(-1)} className={tool}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Move down" disabled={last} onClick={() => onMove(1)} className={tool}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Remove the ${LABEL[block.type].toLowerCase()} block`} onClick={onRemove} className={clsx(tool, 'hover:text-danger')}>
          <Trash size={16} aria-hidden="true" />
        </button>
      </div>
      {children}
    </li>
  );
}

function BlockFields({
  block,
  patch,
  onPickImage,
}: {
  block: Block;
  patch: (changes: Partial<Block>) => void;
  onPickImage: () => void;
}) {
  const [touchedLink, setTouchedLink] = useState(false);
  switch (block.type) {
    case 'heading':
      return (
        <input
          aria-label="Heading"
          value={block.text}
          maxLength={200}
          placeholder="A heading"
          onChange={(event) => patch({ text: event.target.value })}
          className={clsx(FIELD_BASE, 'text-lg font-semibold')}
        />
      );
    case 'text':
      return (
        <textarea
          aria-label="Text"
          value={block.text}
          placeholder="Write your text. A blank line starts a new paragraph."
          onChange={(event) => patch({ text: event.target.value })}
          className={clsx(AREA, 'min-h-[7rem]')}
        />
      );
    case 'image':
      return (
        <div className="flex flex-col gap-2">
          {block.src ? (
            <img src={block.src} alt={block.alt} className="max-h-48 w-full rounded-control bg-surface-muted object-cover" />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button icon={<ImageIcon size={16} />} onClick={onPickImage}>
              {block.src ? 'Change image' : 'Choose an image'}
            </Button>
            {block.src ? (
              <Button variant="ghost" onClick={() => patch({ src: '', alt: '' })}>
                Clear
              </Button>
            ) : null}
          </div>
          {block.src ? (
            <input
              aria-label="Describe the image (for people who cannot see it)"
              value={block.alt}
              maxLength={200}
              placeholder="Describe the image"
              onChange={(event) => patch({ alt: event.target.value })}
              className={FIELD_BASE}
            />
          ) : (
            <p className="text-[13px] text-ink-muted">No image yet. This block is left out of the email until you choose one.</p>
          )}
        </div>
      );
    case 'button':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Button text"
            value={block.label}
            maxLength={80}
            placeholder="Button text"
            onChange={(event) => patch({ label: event.target.value })}
            className={FIELD_BASE}
          />
          <input
            aria-label="Where the button goes (web address)"
            value={block.url}
            inputMode="url"
            autoCapitalize="off"
            placeholder="enzointeriors.co.uk/booking"
            onChange={(event) => patch({ url: event.target.value })}
            onBlur={() => setTouchedLink(true)}
            className={FIELD_BASE}
          />
          {touchedLink && !linkOf(block.url) ? (
            <p className="text-[13px] text-warning sm:col-span-2">Add a web address, or this button is left out of the email.</p>
          ) : null}
        </div>
      );
    case 'columns':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <textarea aria-label="Left column" value={block.left} placeholder="Left column" onChange={(event) => patch({ left: event.target.value })} className={AREA} />
          <textarea aria-label="Right column" value={block.right} placeholder="Right column" onChange={(event) => patch({ right: event.target.value })} className={AREA} />
        </div>
      );
    case 'divider':
      return <hr className="my-3 border-border" />;
    case 'legacy':
      return (
        <p className="text-sm text-ink-muted">
          This part was written before the block editor and is kept exactly as it was (see the preview). Remove it to start again
          with blocks.
        </p>
      );
  }
}
