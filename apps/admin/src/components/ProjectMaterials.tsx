import { X } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';

import { Button, Card, Input, Select, StatusTag, TableWrap, Td, Th } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';

/* Project stock (apps/api modules/inventory/project-stock.ts). Remove the feature: this file and its line in ProjectDetail. */
interface Line {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  needed: number;
  reserved: number;
  issued: number;
  available: number;
  /** Admin only. */
  cost?: number;
}
interface StockItem {
  id: string;
  sku: string;
  name: string;
  active: boolean;
}

const ACTIONS = { reserve: 'Hold', release: 'Let go', issue: 'Use', return: 'Return' } as const;
type Action = keyof typeof ACTIONS;

/**
 * What a project needs, holds and has used. The Admin sets needs and holds stock; an Installer
 * on the project books what they use and return; a Designer reads it. Cost is the Admin's only.
 */
export function ProjectMaterials({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { isAdmin, can } = useAuth();
  const canBook = can('Admin', 'Installer');
  const base = `/inventory/projects/${projectId}`;
  const { data, setData } = useQuery<Line[]>(base + '/materials');
  const items = useQuery<StockItem[]>(isAdmin ? '/inventory/items' : null);
  const cost = useQuery<{ used: number; quoted: number | null }>(isAdmin ? base + '/cost' : null);
  const [adding, setAdding] = useState({ item_id: '', needed: '' });
  const [move, setMove] = useState<{ item_id: string; action: Action; quantity: string }>({ item_id: '', action: isAdmin ? 'reserve' : 'issue', quantity: '' });
  const [busy, setBusy] = useState(false);

  const run = async (request: () => Promise<Line[] | void>, done: string) => {
    setBusy(true);
    try {
      const next = await request();
      setData(next ?? (await api.get<Line[]>(base + '/materials')));
      toast.success(done);
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;
  const lines = data;
  const onList = new Set(lines.map((line) => line.item_id));
  const total = lines.reduce((sum, line) => sum + (line.cost ?? 0), 0);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await run(() => api.put<Line[]>(`${base}/materials/${adding.item_id}`, { needed: Number(adding.needed) }), 'Added.')) setAdding({ item_id: '', needed: '' });
  };
  const book = async (event: FormEvent) => {
    event.preventDefault();
    const itemId = move.item_id || lines[0]!.item_id;
    if (await run(() => api.post<Line[]>(`${base}/materials/${itemId}/${move.action}`, { quantity: Number(move.quantity) }), 'Booked.')) setMove({ ...move, quantity: '' });
  };
  const setNeeded = (line: Line, value: string) => {
    const needed = Number(value);
    if (value.trim() !== '' && needed !== line.needed) void run(() => api.put<Line[]>(`${base}/materials/${line.item_id}`, { needed }), 'Saved.');
  };

  if (!lines.length && !isAdmin) return null;

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label-eyebrow">Materials</p>
        {isAdmin && lines.length ? (
          <Button variant="secondary" loading={busy} onClick={() => void run(() => api.post<Line[]>(`${base}/reserve-all`), 'Held what is free.')}>
            Hold what is needed
          </Button>
        ) : null}
      </div>

      {lines.length ? (
        <TableWrap className="mt-3">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Needed</Th>
              <Th className="text-right">Held</Th>
              <Th className="text-right">Used</Th>
              <Th className="text-right max-sm:hidden">Free in stock</Th>
              {isAdmin ? <Th className="text-right max-sm:hidden">Cost</Th> : null}
              {isAdmin ? <Th className="w-8"><span className="sr-only">Remove</span></Th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const short = line.needed - line.issued - line.reserved;
              return (
                <tr key={line.item_id}>
                  <Td>
                    <span className="font-semibold text-ink">{line.name}</span> <span className="text-ink-muted">{line.sku}</span>
                    {short > 0 ? <span className="ml-2"><StatusTag tone="warning">{short} short</StatusTag></span> : null}
                  </Td>
                  <Td className="tabular text-right">
                    {isAdmin ? (
                      <input
                        key={line.needed}
                        aria-label={`Needed of ${line.name}`}
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={line.needed}
                        onBlur={(event) => setNeeded(line, event.target.value)}
                        className="w-16 rounded-control border border-line bg-transparent px-2 py-1 text-right"
                      />
                    ) : (
                      line.needed
                    )}{' '}
                    {line.unit}
                  </Td>
                  <Td className="tabular text-right">{line.reserved}</Td>
                  <Td className="tabular text-right">{line.issued}</Td>
                  <Td className="tabular text-right max-sm:hidden">{line.available}</Td>
                  {isAdmin ? <Td className="tabular text-right max-sm:hidden">{money(line.cost ?? 0)}</Td> : null}
                  {isAdmin ? (
                    <Td>
                      {line.issued === 0 ? (
                        <button
                          type="button"
                          aria-label={`Remove ${line.name}`}
                          className="text-ink-muted hover:text-ink"
                          onClick={() => void run(() => api.delete(`${base}/materials/${line.item_id}`), 'Removed.')}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Nothing listed yet. Add what this project needs from stock.</p>
      )}

      {isAdmin && lines.length ? (
        <p className="tabular mt-2 text-right text-sm font-semibold text-ink">
          Materials used so far {money(total)}
          {cost.data?.quoted != null ? <span className="font-normal text-ink-muted"> · accepted quote at cost {money(cost.data.quoted)}</span> : null}
        </p>
      ) : null}

      {canBook && lines.length ? (
        <form onSubmit={book} className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_6rem_auto] sm:items-end">
          <Select label="Item" value={move.item_id || lines[0]!.item_id}onChange={(event) => setMove({ ...move, item_id: event.target.value })}>
            {lines.map((line) => (
              <option key={line.item_id} value={line.item_id}>
                {line.name}
              </option>
            ))}
          </Select>
          <Select label="Book" value={move.action} onChange={(event) => setMove({ ...move, action: event.target.value as Action })}>
            {(Object.keys(ACTIONS) as Action[])
              .filter((action) => isAdmin || action === 'issue' || action === 'return')
              .map((action) => (
                <option key={action} value={action}>
                  {ACTIONS[action]}
                </option>
              ))}
          </Select>
          <Input label="How many" type="number" min={1} step={1} required value={move.quantity} onChange={(event) => setMove({ ...move, quantity: event.target.value })} />
          <Button type="submit" variant="primary" loading={busy}>
            Book
          </Button>
        </form>
      ) : null}

      {isAdmin ? (
        <form onSubmit={add} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
          <Select label="Add from stock" required value={adding.item_id} onChange={(event) => setAdding({ ...adding, item_id: event.target.value })}>
            <option value="">Choose an item</option>
            {(items.data ?? [])
              .filter((item) => item.active && !onList.has(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
          </Select>
          <Input label="Needed" type="number" min={1} step={1} required value={adding.needed} onChange={(event) => setAdding({ ...adding, needed: event.target.value })} />
          <Button type="submit" variant="secondary" loading={busy}>
            Add
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
