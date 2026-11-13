import { Plus } from '@phosphor-icons/react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button, EmptyState, ErrorState, LoadingState, StatusTag, TableWrap, Td, Th } from '@/components/ui';
import { DesignEditor } from '@/components/quote-maker/DesignEditor';
import { PricingPane } from '@/components/quote-maker/PricingPane';
import { UnitLibrary } from '@/components/quote-maker/UnitLibrary';
import { CUSTOM_ROOM, ROOM_TYPES, type Design, type DesignSummary, type Pricing, type StockItem, type UnitTemplate } from '@/components/quote-maker/plan';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { date, money } from '@/lib/format';

/* Quote maker (Admin), apps/api modules/quote-maker. Its lists live as tabs on the Quotes page (pages/Quotes.tsx); this file keeps the design editor route. */
const range = (low: number | null, high: number | null) => (low === null || high === null ? 'Not priced' : `${money(low)} – ${money(high)}`);
const roomName = (id: string) => [...ROOM_TYPES, CUSTOM_ROOM].find((r) => r.id === id)?.name ?? id;

/** `/quote-maker/new` and `/quote-maker/:id` open the editor; the bare address (an old link) goes to the Quotes page. */
export function QuoteMakerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (id) return <EditorRoute id={id} />;
  const view = params.get('view');
  return <Navigate to={view === 'library' || view === 'pricing' ? `/quotes?tab=${view}` : '/quotes'} replace />;
}

function EditorRoute({ id }: { id: string }) {
  const navigate = useNavigate();
  const design = useQuery<Design>(id === 'new' ? null : `/quote-maker/designs/${id}`);
  if (id !== 'new') {
    if (design.error && !design.data) return <ErrorState message={design.error} onRetry={() => void design.refetch()} />;
    if (!design.data) return <LoadingState label="Loading design…" />;
  }
  return (
    <DesignEditor
      // A new design becomes the saved one; a quiet refresh never resets the editor.
      key={id === 'new' ? 'new' : design.data!.id}
      design={id === 'new' ? null : design.data}
      onSaved={(saved) => (id === 'new' ? navigate(`/quote-maker/${saved.id}`, { replace: true }) : design.setData(saved))}
    />
  );
}

export function DesignsView() {
  const navigate = useNavigate();
  const designs = useQuery<DesignSummary[]>('/quote-maker/designs');
  const { rows, header } = useSort(designs.data ?? [], {
    ref: (d) => d.ref,
    title: (d) => d.title ?? '',
    room: (d) => roomName(d.room_type),
    price: (d) => d.estimate_high ?? -1,
    updated: (d) => d.updated_at,
  });
  if (designs.error && !designs.data) return <ErrorState message={designs.error} onRetry={() => void designs.refetch()} />;
  if (!designs.data) return <LoadingState label="Loading designs…" />;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => navigate('/quote-maker/new')}>
          New design
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No designs yet" message="Draw a room from the front, or fill one from a few questions, and it is priced from Inventory as you go." />
      ) : (
        <TableWrap>
          <thead>
              <tr>
                <Th sort={header('ref')}>Ref</Th>
                <Th sort={header('title')}>Design</Th>
                <Th sort={header('room')}>Room</Th>
                <Th sort={header('price')}>Range</Th>
                <Th>Quotes</Th>
                <Th sort={header('updated')}>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="cursor-pointer border-t border-border hover:bg-surface-muted" onClick={() => navigate(`/quote-maker/${d.id}`)}>
                  <Td className="tabular font-semibold">
                    <Link to={`/quote-maker/${d.id}`} onClick={(e) => e.stopPropagation()} className="text-green-900 hover:underline">
                      {d.ref}
                    </Link>
                  </Td>
                  <Td>
                    {d.title ?? <span className="text-ink-muted">Untitled</span>}
                    <span className="block text-xs text-ink-muted">
                      {d.source === 'web' ? `Website · ${d.enquiry?.name ?? 'enquiry removed'}` : `By ${d.created_by ?? 'staff'}`} · {d.units} units
                    </span>
                  </Td>
                  <Td>{roomName(d.room_type)}</Td>
                  <Td className="tabular">{range(d.estimate_low, d.estimate_high)}</Td>
                  <Td>
                    {d.quotes.length ? (
                      <StatusTag tone={d.quotes.some((q) => q.status === 'Accepted') ? 'success' : 'info'}>{d.quotes.map((q) => q.number).join(', ')}</StatusTag>
                    ) : (
                      <span className="text-ink-muted">None</span>
                    )}
                  </Td>
                  <Td className="tabular">{date(d.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
        </TableWrap>
      )}
    </>
  );
}

export function LibraryView() {
  const templates = useQuery<UnitTemplate[]>('/quote-maker/templates');
  const items = useQuery<StockItem[]>('/inventory/items');
  if ((templates.error && !templates.data) || (items.error && !items.data))
    return <ErrorState message={templates.error ?? items.error ?? ''} onRetry={() => void Promise.all([templates.refetch(), items.refetch()])} />;
  if (!templates.data || !items.data) return <LoadingState label="Loading the unit library…" />;
  return <UnitLibrary templates={templates.data} items={items.data} onChanged={templates.refetch} />;
}

export function PricingView() {
  const pricing = useQuery<Pricing>('/quote-maker/pricing');
  const items = useQuery<StockItem[]>('/inventory/items');
  if ((pricing.error && !pricing.data) || (items.error && !items.data))
    return <ErrorState message={pricing.error ?? items.error ?? ''} onRetry={() => void Promise.all([pricing.refetch(), items.refetch()])} />;
  if (!pricing.data || !items.data) return <LoadingState label="Loading pricing…" />;
  return <PricingPane key={JSON.stringify(pricing.data)} pricing={pricing.data} items={items.data} onSaved={(p) => pricing.setData(p)} />;
}
