import { FileOutput, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Tabs,
  Td,
  Textarea,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, money } from '@/lib/format';
import { quoteTone } from '@/lib/status';
import type {
  BusinessSettings,
  Client,
  ComponentCategory,
  ComponentItem,
  Project,
  Quote,
  QuoteType,
  ServiceType,
} from '@/types/api';
import { CATEGORY_LABELS, COMPONENT_CATEGORIES, SERVICE_LABELS, SERVICE_TYPES } from '@/types/api';

interface BuilderLine {
  component_id: string;
  quantity: number;
}

export function QuotesPage() {
  const { isAdmin, can } = useAuth();
  const toast = useToast();
  const quotes = useQuery<Quote[]>('/quotes');
  const clients = useQuery<Client[]>('/clients');
  const projects = useQuery<Project[]>('/projects');
  const components = useQuery<ComponentItem[]>('/components?includeInactive=true');
  const settings = useQuery<BusinessSettings>('/business-settings');

  const [tab, setTab] = useState('quotes');

  /* ---- Quote builder ---- */
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [builder, setBuilder] = useState({
    client_id: '',
    service_id: 'Kitchen' as ServiceType,
    type: 'Detailed' as QuoteType,
    design_fee: 0,
    simple_subtotal: 0,
    lines: [] as BuilderLine[],
  });

  const vatRate = settings.data?.vat_rate ?? 20;
  const activeComponents = useMemo(
    () => (components.data ?? []).filter((component) => component.is_active),
    [components.data],
  );

  /**
   * Live running total, recomputed on every change.
   *
   * This mirrors the server's arithmetic exactly (line totals, then design fee
   * into the subtotal, then VAT on the whole subtotal). The server remains the
   * authority — this is a preview, and the saved quote uses the API's figures.
   */
  const preview = useMemo(() => {
    const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const lineRows = builder.lines.map((line) => {
      const component = activeComponents.find((entry) => entry.id === line.component_id);
      const unitPrice = component?.unit_price ?? 0;
      return {
        ...line,
        name: component?.name ?? 'Unknown component',
        unit_price: unitPrice,
        line_total: round(line.quantity * unitPrice),
      };
    });
    const net =
      builder.type === 'Detailed'
        ? round(lineRows.reduce((sum, row) => sum + row.line_total, 0))
        : round(builder.simple_subtotal);
    const subtotal = round(net + builder.design_fee);
    const vat = round(subtotal * (vatRate / 100));
    return { lineRows, net, subtotal, vat, total: round(subtotal + vat) };
  }, [builder, activeComponents, vatRate]);

  const resetBuilder = () => {
    setBuilder({
      client_id: '',
      service_id: 'Kitchen',
      type: 'Detailed',
      design_fee: 0,
      simple_subtotal: 0,
      lines: [],
    });
    setBuilderError(null);
  };

  const submitQuote = async (event: FormEvent) => {
    event.preventDefault();
    setBuilderError(null);
    if (!builder.client_id) return setBuilderError('Choose a client.');
    if (builder.type === 'Detailed' && builder.lines.length === 0) {
      return setBuilderError('Add at least one line item, or switch to a Simple quote.');
    }
    if (builder.type === 'Detailed' && builder.lines.some((line) => line.quantity <= 0)) {
      return setBuilderError('Every line needs a quantity greater than zero.');
    }
    if (builder.type === 'Simple' && builder.simple_subtotal <= 0) {
      return setBuilderError('Enter the estimated amount for this quote.');
    }

    setSaving(true);
    try {
      await api.post<Quote>('/quotes', {
        client_id: builder.client_id,
        service_id: builder.service_id,
        type: builder.type,
        design_fee: builder.design_fee,
        ...(builder.type === 'Detailed'
          ? { lines: builder.lines }
          : { subtotal: builder.simple_subtotal }),
      });
      toast.success('Quote saved as a draft.');
      setBuilding(false);
      resetBuilder();
      await quotes.refetch();
    } catch (caught) {
      setBuilderError(caught instanceof ApiError ? caught.message : 'Could not save this quote.');
    } finally {
      setSaving(false);
    }
  };

  const sendQuote = async (quote: Quote) => {
    try {
      await api.post(`/quotes/${quote.id}/send`);
      toast.success(`Quote sent to ${quote.client_name}.`);
      await quotes.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send this quote.');
    }
  };

  /* ---- Convert to invoice ---- */
  const [converting, setConverting] = useState<Quote | null>(null);
  const [convertProjectId, setConvertProjectId] = useState('');
  const [convertDays, setConvertDays] = useState(30);
  const [convertPending, setConvertPending] = useState(false);

  const doConvert = async () => {
    if (!converting) return;
    setConvertPending(true);
    try {
      const invoice = await api.post<{ number: string }>(
        `/quotes/${converting.id}/convert-to-invoice`,
        { project_id: convertProjectId || null, due_in_days: convertDays },
      );
      toast.success(`Invoice ${invoice.number} created from this quote.`);
      setConverting(null);
      setConvertProjectId('');
      await quotes.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not convert this quote.');
    } finally {
      setConvertPending(false);
    }
  };

  /* ---- Delete ---- */
  const [deletingQuote, setDeletingQuote] = useState<Quote | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const doDeleteQuote = async () => {
    if (!deletingQuote) return;
    setDeletePending(true);
    try {
      await api.delete(`/quotes/${deletingQuote.id}`);
      toast.success('Quote deleted.');
      setDeletingQuote(null);
      await quotes.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this quote.');
      setDeletingQuote(null);
    } finally {
      setDeletePending(false);
    }
  };

  /* ---- Component library ---- */
  const [componentModal, setComponentModal] = useState<ComponentItem | 'new' | null>(null);
  const [componentSaving, setComponentSaving] = useState(false);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [componentForm, setComponentForm] = useState({
    name: '',
    category: 'Worktop' as ComponentCategory,
    unit_price: 0,
    description: '',
    is_active: true,
  });
  const [deletingComponent, setDeletingComponent] = useState<ComponentItem | null>(null);

  const openComponent = (component: ComponentItem | 'new') => {
    if (component === 'new') {
      setComponentForm({ name: '', category: 'Worktop', unit_price: 0, description: '', is_active: true });
    } else {
      setComponentForm({
        name: component.name,
        category: component.category,
        unit_price: component.unit_price,
        description: component.description ?? '',
        is_active: component.is_active,
      });
    }
    setComponentError(null);
    setComponentModal(component);
  };

  const submitComponent = async (event: FormEvent) => {
    event.preventDefault();
    setComponentError(null);
    if (componentForm.name.trim().length < 2) return setComponentError('Enter a component name.');
    if (componentForm.unit_price < 0) return setComponentError('Unit price cannot be negative.');

    setComponentSaving(true);
    try {
      const payload = {
        name: componentForm.name.trim(),
        category: componentForm.category,
        unit_price: componentForm.unit_price,
        description: componentForm.description.trim() || null,
        is_active: componentForm.is_active,
      };
      if (componentModal === 'new') {
        await api.post('/components', payload);
        toast.success('Component added to the library.');
      } else if (componentModal) {
        await api.put(`/components/${componentModal.id}`, payload);
        toast.success('Component updated. Existing quotes keep their original prices.');
      }
      setComponentModal(null);
      await components.refetch();
    } catch (caught) {
      setComponentError(
        caught instanceof ApiError ? caught.message : 'Could not save this component.',
      );
    } finally {
      setComponentSaving(false);
    }
  };

  const doDeleteComponent = async () => {
    if (!deletingComponent) return;
    try {
      await api.delete(`/components/${deletingComponent.id}`);
      toast.success('Component deleted.');
      setDeletingComponent(null);
      await components.refetch();
    } catch (caught) {
      // The API refuses when quotes reference it and explains why.
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete this component.');
      setDeletingComponent(null);
    }
  };

  const clientProjects = (projects.data ?? []).filter(
    (project) => project.client_id === converting?.client_id,
  );

  return (
    <>
      <PageHeader
        title="Quotes & Pricing"
        description="Build quotes from the component library and convert accepted ones into invoices."
        actions={
          can('Admin', 'Designer') ? (
            <Button
              variant="primary"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => {
                resetBuilder();
                setBuilding(true);
              }}
            >
              New quote
            </Button>
          ) : null
        }
      />

      <Tabs
        tabs={[
          { id: 'quotes', label: 'Quotes', count: quotes.data?.length },
          { id: 'library', label: 'Pricing library', count: components.data?.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'quotes' ? (
        quotes.error ? (
          <ErrorState message={quotes.error} onRetry={quotes.refetch} />
        ) : quotes.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={6} columns={6} />
          </Card>
        ) : (quotes.data ?? []).length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No quotes yet"
              message="Build a quote from the component library to send a client a price."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    resetBuilder();
                    setBuilding(true);
                  }}
                >
                  New quote
                </Button>
              }
            />
          </Card>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Service</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(quotes.data ?? []).map((quote) => (
                <tr key={quote.id} className="hover:bg-surface-muted/40">
                  <Td className="font-medium text-ink">{quote.client_name}</Td>
                  <Td className="text-ink-muted">{SERVICE_LABELS[quote.service_id]}</Td>
                  <Td>
                    <StatusTag tone="neutral">{quote.type}</StatusTag>
                    {quote.lines.length > 0 ? (
                      <span className="ml-1.5 text-xs text-ink-muted">
                        {quote.lines.length} line{quote.lines.length === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusTag tone={quoteTone(quote.status)}>{quote.status}</StatusTag>
                    {quote.invoice_id ? (
                      <span className="ml-1.5 text-xs text-ink-muted">invoiced</span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{date(quote.created_at)}</Td>
                  <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                    {money(quote.total)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {quote.status === 'Draft' && can('Admin', 'Designer') ? (
                        <button
                          type="button"
                          onClick={() => void sendQuote(quote)}
                          aria-label={`Send quote to ${quote.client_name}`}
                          title="Send to client"
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                        >
                          <Send size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      {quote.status === 'Accepted' && !quote.invoice_id && isAdmin ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConverting(quote);
                            setConvertProjectId('');
                            setConvertDays(30);
                          }}
                          aria-label={`Convert ${quote.client_name}'s quote to an invoice`}
                          title="Convert to invoice"
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                        >
                          <FileOutput size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setDeletingQuote(quote)}
                          aria-label={`Delete ${quote.client_name}'s quote`}
                          className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {tab === 'library' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-ink-muted">
              Prices here apply to <strong className="font-semibold text-ink">new</strong> quotes
              only. Existing quotes keep the price captured when they were built.
            </p>
            {isAdmin ? (
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => openComponent('new')}
              >
                Add component
              </Button>
            ) : null}
          </div>

          {components.error ? (
            <ErrorState message={components.error} onRetry={components.refetch} />
          ) : components.loading ? (
            <Card className="p-0">
              <TableSkeleton rows={8} columns={4} />
            </Card>
          ) : (components.data ?? []).length === 0 ? (
            <Card className="p-0">
              <EmptyState
                title="Pricing library is empty"
                message="Add components so the quote builder has something to price."
              />
            </Card>
          ) : (
            COMPONENT_CATEGORIES.map((category) => {
              const rows = (components.data ?? []).filter(
                (component) => component.category === category,
              );
              if (rows.length === 0) return null;
              return (
                <div key={category} className="mb-4">
                  <h2 className="label-eyebrow mb-2">{CATEGORY_LABELS[category]}</h2>
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>Component</Th>
                        <Th>Description</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Unit price</Th>
                        <Th className="text-right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((component) => (
                        <tr key={component.id} className="hover:bg-surface-muted/40">
                          <Td className="font-medium text-ink">{component.name}</Td>
                          <Td className="max-w-md text-ink-muted">{component.description ?? '—'}</Td>
                          <Td>
                            <StatusTag tone={component.is_active ? 'success' : 'neutral'}>
                              {component.is_active ? 'Active' : 'Inactive'}
                            </StatusTag>
                          </Td>
                          <Td className="tabular whitespace-nowrap text-right font-semibold text-ink">
                            {money(component.unit_price)}
                          </Td>
                          <Td>
                            <div className="flex justify-end gap-1">
                              {isAdmin ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openComponent(component)}
                                    aria-label={`Edit ${component.name}`}
                                    className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-green-900"
                                  >
                                    <Pencil size={16} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingComponent(component)}
                                    aria-label={`Delete ${component.name}`}
                                    className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                                  >
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-ink-muted">Admin only</span>
                              )}
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              );
            })
          )}
        </>
      ) : null}

      {/* ---- Quote builder ---- */}
      <Modal
        open={building}
        onClose={() => setBuilding(false)}
        title="Build a quote"
        description="Simple quotes carry a single estimated figure. Detailed quotes itemise the components."
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBuilding(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="quote-form" variant="primary" loading={saving}>
              Save as draft
            </Button>
          </>
        }
      >
        <form id="quote-form" onSubmit={submitQuote} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Client"
              value={builder.client_id}
              onChange={(event) => setBuilder({ ...builder, client_id: event.target.value })}
              required
            >
              <option value="">Choose…</option>
              {(clients.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Select
              label="Service"
              value={builder.service_id}
              onChange={(event) =>
                setBuilder({ ...builder, service_id: event.target.value as ServiceType })
              }
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SERVICE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Select
              label="Quote type"
              value={builder.type}
              onChange={(event) =>
                setBuilder({ ...builder, type: event.target.value as QuoteType })
              }
            >
              <option value="Detailed">Detailed (itemised)</option>
              <option value="Simple">Simple (single figure)</option>
            </Select>
          </div>

          {builder.type === 'Simple' ? (
            <Input
              label="Estimated amount (excluding VAT)"
              type="number"
              min={0}
              step="0.01"
              value={builder.simple_subtotal || ''}
              onChange={(event) =>
                setBuilder({ ...builder, simple_subtotal: Number(event.target.value) })
              }
              hint="Typically carried over from the website calculator."
              required
            />
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Line items</p>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus size={15} aria-hidden="true" />}
                  onClick={() =>
                    setBuilder({
                      ...builder,
                      lines: [
                        ...builder.lines,
                        { component_id: activeComponents[0]?.id ?? '', quantity: 1 },
                      ],
                    })
                  }
                >
                  Add line
                </Button>
              </div>

              {builder.lines.length === 0 ? (
                <p className="rounded-card border border-dashed border-border px-3 py-6 text-center text-ink-muted">
                  No lines yet. Add components to build the quote.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {builder.lines.map((line, index) => {
                    const row = preview.lineRows[index];
                    return (
                      <li
                        key={index}
                        className="flex flex-wrap items-end gap-2 rounded-card border border-border p-2"
                      >
                        <div className="min-w-48 flex-1">
                          <label className="label-eyebrow" htmlFor={`line-component-${index}`}>
                            Component
                          </label>
                          <select
                            id={`line-component-${index}`}
                            value={line.component_id}
                            onChange={(event) => {
                              const next = [...builder.lines];
                              next[index] = { ...line, component_id: event.target.value };
                              setBuilder({ ...builder, lines: next });
                            }}
                            className="mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900"
                          >
                            {activeComponents.map((component) => (
                              <option key={component.id} value={component.id}>
                                {component.name} — {money(component.unit_price)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="label-eyebrow" htmlFor={`line-qty-${index}`}>
                            Qty
                          </label>
                          <input
                            id={`line-qty-${index}`}
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={line.quantity}
                            onChange={(event) => {
                              const next = [...builder.lines];
                              next[index] = { ...line, quantity: Number(event.target.value) };
                              setBuilder({ ...builder, lines: next });
                            }}
                            className="tabular mt-1 min-h-11 w-full rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900"
                          />
                        </div>
                        <div className="w-28 text-right">
                          <p className="label-eyebrow">Line total</p>
                          <p className="tabular mt-1 min-h-11 pt-3 font-semibold text-ink">
                            {money(row?.line_total ?? 0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setBuilder({
                              ...builder,
                              lines: builder.lines.filter((_, i) => i !== index),
                            })
                          }
                          aria-label={`Remove line ${index + 1}`}
                          className="mb-1 flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted transition-colors hover:text-danger"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <Input
            label="3D design & visualisation fee"
            type="number"
            min={0}
            step="0.01"
            value={builder.design_fee || ''}
            onChange={(event) => setBuilder({ ...builder, design_fee: Number(event.target.value) })}
            hint="Priced separately from the components. Leave at 0 if not applicable."
          />

          {/* Live running total — the brief asks for this alongside the builder. */}
          <Card accent="primary" className="pl-5">
            <p className="label-eyebrow">Running total</p>
            <dl className="mt-2 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <dt className="text-ink-muted">
                  {builder.type === 'Detailed' ? 'Line items' : 'Estimate'}
                </dt>
                <dd className="tabular font-medium text-ink">{money(preview.net)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Design fee</dt>
                <dd className="tabular font-medium text-ink">{money(builder.design_fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular font-medium text-ink">{money(preview.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">VAT at {vatRate}%</dt>
                <dd className="tabular font-medium text-ink">{money(preview.vat)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="tabular text-lg font-bold text-green-900">{money(preview.total)}</dd>
              </div>
            </dl>
          </Card>

          {builderError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {builderError}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* ---- Convert to invoice ---- */}
      <Modal
        open={converting !== null}
        onClose={() => setConverting(null)}
        title="Convert quote to invoice"
        description={
          converting
            ? `${converting.client_name} · ${money(converting.total)} including VAT`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConverting(null)} disabled={convertPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doConvert} loading={convertPending}>
              Create invoice
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            Every line carries across without re-entry. The invoice is created as a draft so you
            can review it before sending.
          </p>
          <Select
            label="Attach to project"
            value={convertProjectId}
            onChange={(event) => setConvertProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {clientProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Input
            label="Payment terms (days)"
            type="number"
            min={0}
            value={convertDays}
            onChange={(event) => setConvertDays(Number(event.target.value))}
            hint="The due date is calculated from today."
          />
        </div>
      </Modal>

      {/* ---- Component editor ---- */}
      <Modal
        open={componentModal !== null}
        onClose={() => setComponentModal(null)}
        title={componentModal === 'new' ? 'Add component' : 'Edit component'}
        description="Changing a price never alters quotes that have already been built."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setComponentModal(null)}
              disabled={componentSaving}
            >
              Cancel
            </Button>
            <Button type="submit" form="component-form" variant="primary" loading={componentSaving}>
              Save component
            </Button>
          </>
        }
      >
        <form id="component-form" onSubmit={submitComponent} className="flex flex-col gap-4" noValidate>
          <Input
            label="Name"
            value={componentForm.name}
            onChange={(event) => setComponentForm({ ...componentForm, name: event.target.value })}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              value={componentForm.category}
              onChange={(event) =>
                setComponentForm({
                  ...componentForm,
                  category: event.target.value as ComponentCategory,
                })
              }
            >
              {COMPONENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
            <Input
              label="Unit price (£)"
              type="number"
              min={0}
              step="0.01"
              value={componentForm.unit_price}
              onChange={(event) =>
                setComponentForm({ ...componentForm, unit_price: Number(event.target.value) })
              }
              required
            />
          </div>
          <Textarea
            label="Description"
            value={componentForm.description}
            onChange={(event) =>
              setComponentForm({ ...componentForm, description: event.target.value })
            }
            placeholder="Engineered quartz, 20mm, per m². Includes template and polished edges."
          />
          <Select
            label="Availability"
            value={componentForm.is_active ? 'active' : 'inactive'}
            onChange={(event) =>
              setComponentForm({ ...componentForm, is_active: event.target.value === 'active' })
            }
            hint="Inactive components disappear from the quote builder but stay on historical quotes."
          >
            <option value="active">Active — available in the quote builder</option>
            <option value="inactive">Inactive — withdrawn from the range</option>
          </Select>
          {componentError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {componentError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingQuote !== null}
        title="Delete this quote?"
        message="This removes the quote and its line items. Clients, invoices and the pricing library are not affected."
        confirmLabel="Delete quote"
        pending={deletePending}
        onConfirm={doDeleteQuote}
        onCancel={() => setDeletingQuote(null)}
      />

      <ConfirmDialog
        open={deletingComponent !== null}
        title={`Delete ${deletingComponent?.name ?? 'component'}?`}
        message="If any quote uses this component the deletion will be refused — mark it inactive instead so historical quotes stay intact."
        confirmLabel="Delete component"
        onConfirm={doDeleteComponent}
        onCancel={() => setDeletingComponent(null)}
      />
    </>
  );
}
