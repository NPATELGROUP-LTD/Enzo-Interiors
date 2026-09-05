import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

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
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { submissionTone } from '@/lib/status';
import type {
  ContactSubmission,
  PortfolioItem,
  ServiceType,
  SubmissionStatus,
  Testimonial,
} from '@/types/api';
import { SERVICE_LABELS, SERVICE_TYPES, SUBMISSION_STATUSES } from '@/types/api';

/** Written star rating — the tag itself always carries the number too. */
function Rating({ value }: { value: number }) {
  return (
    <span className="tabular text-ink" aria-label={`${value} out of 5`}>
      {value}/5
    </span>
  );
}

export function ContentPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const testimonials = useQuery<Testimonial[]>('/testimonials');
  const portfolio = useQuery<PortfolioItem[]>('/portfolio-items');
  const submissions = useQuery<ContactSubmission[]>('/contact-submissions');

  const [tab, setTab] = useState('submissions');

  /* ---- Testimonials ---- */
  const [testimonialModal, setTestimonialModal] = useState<Testimonial | 'new' | null>(null);
  const [testimonialForm, setTestimonialForm] = useState({
    client_name: '',
    rating: 5,
    review_text: '',
    is_published: false,
  });
  const [testimonialError, setTestimonialError] = useState<string | null>(null);
  const [testimonialSaving, setTestimonialSaving] = useState(false);
  const [deletingTestimonial, setDeletingTestimonial] = useState<Testimonial | null>(null);

  const openTestimonial = (entry: Testimonial | 'new') => {
    setTestimonialForm(
      entry === 'new'
        ? { client_name: '', rating: 5, review_text: '', is_published: false }
        : {
            client_name: entry.client_name,
            rating: entry.rating,
            review_text: entry.review_text,
            is_published: entry.is_published,
          },
    );
    setTestimonialError(null);
    setTestimonialModal(entry);
  };

  const submitTestimonial = async (event: FormEvent) => {
    event.preventDefault();
    setTestimonialError(null);
    if (testimonialForm.client_name.trim().length < 2) {
      return setTestimonialError('Enter the client’s name.');
    }
    if (testimonialForm.review_text.trim().length < 10) {
      return setTestimonialError('A review needs at least a sentence.');
    }

    setTestimonialSaving(true);
    try {
      const payload = {
        client_name: testimonialForm.client_name.trim(),
        rating: testimonialForm.rating,
        review_text: testimonialForm.review_text.trim(),
        is_published: testimonialForm.is_published,
      };
      if (testimonialModal === 'new') {
        await api.post('/testimonials', payload);
        toast.success('Testimonial added.');
      } else if (testimonialModal) {
        await api.put(`/testimonials/${testimonialModal.id}`, payload);
        toast.success('Testimonial updated.');
      }
      setTestimonialModal(null);
      await testimonials.refetch();
    } catch (caught) {
      setTestimonialError(
        caught instanceof ApiError ? caught.message : 'Could not save this testimonial.',
      );
    } finally {
      setTestimonialSaving(false);
    }
  };

  const togglePublish = async (entry: Testimonial) => {
    try {
      await api.put(`/testimonials/${entry.id}`, { is_published: !entry.is_published });
      toast.success(entry.is_published ? 'Unpublished.' : 'Published to the website.');
      await testimonials.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not change this.');
    }
  };

  /* ---- Portfolio ---- */
  const [portfolioModal, setPortfolioModal] = useState<PortfolioItem | 'new' | null>(null);
  const [portfolioForm, setPortfolioForm] = useState({
    title: '',
    category: 'Kitchen' as ServiceType,
    location: '',
    year: new Date().getFullYear(),
    duration_weeks: 6,
    description: '',
    materials_used: '',
    image_urls: '',
    is_published: true,
  });
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [deletingPortfolio, setDeletingPortfolio] = useState<PortfolioItem | null>(null);

  const openPortfolio = (entry: PortfolioItem | 'new') => {
    setPortfolioForm(
      entry === 'new'
        ? {
            title: '',
            category: 'Kitchen',
            location: '',
            year: new Date().getFullYear(),
            duration_weeks: 6,
            description: '',
            materials_used: '',
            image_urls: '',
            is_published: true,
          }
        : {
            title: entry.title,
            category: entry.category,
            location: entry.location ?? '',
            year: entry.year ?? new Date().getFullYear(),
            duration_weeks: entry.duration_weeks ?? 6,
            description: entry.description ?? '',
            materials_used: entry.materials_used ?? '',
            image_urls: entry.image_urls.join('\n'),
            is_published: entry.is_published,
          },
    );
    setPortfolioError(null);
    setPortfolioModal(entry);
  };

  const submitPortfolio = async (event: FormEvent) => {
    event.preventDefault();
    setPortfolioError(null);
    if (portfolioForm.title.trim().length < 2) return setPortfolioError('Enter a title.');

    const images = portfolioForm.image_urls
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (images.length === 0) return setPortfolioError('Add at least one image URL.');

    setPortfolioSaving(true);
    try {
      const payload = {
        title: portfolioForm.title.trim(),
        category: portfolioForm.category,
        location: portfolioForm.location.trim() || null,
        year: portfolioForm.year,
        duration_weeks: portfolioForm.duration_weeks,
        description: portfolioForm.description.trim() || null,
        materials_used: portfolioForm.materials_used.trim() || null,
        image_urls: images,
        is_published: portfolioForm.is_published,
      };
      if (portfolioModal === 'new') {
        await api.post('/portfolio-items', payload);
        toast.success('Portfolio item added.');
      } else if (portfolioModal) {
        await api.put(`/portfolio-items/${portfolioModal.id}`, payload);
        toast.success('Portfolio item updated.');
      }
      setPortfolioModal(null);
      await portfolio.refetch();
    } catch (caught) {
      setPortfolioError(caught instanceof ApiError ? caught.message : 'Could not save this item.');
    } finally {
      setPortfolioSaving(false);
    }
  };

  /* ---- Submissions ---- */
  const setSubmissionStatus = async (entry: ContactSubmission, status: SubmissionStatus) => {
    try {
      await api.put(`/contact-submissions/${entry.id}`, { status });
      toast.success(`Enquiry marked ${status}.`);
      await submissions.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update this enquiry.');
    }
  };

  return (
    <>
      <PageHeader
        title="Content Manager"
        description="Enquiries from the website, plus the testimonials and portfolio it publishes."
      />

      <Tabs
        tabs={[
          { id: 'submissions', label: 'Enquiries', count: submissions.data?.length },
          { id: 'testimonials', label: 'Testimonials', count: testimonials.data?.length },
          { id: 'portfolio', label: 'Portfolio', count: portfolio.data?.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ---- Enquiries ---- */}
      {tab === 'submissions' ? (
        submissions.error ? (
          <ErrorState message={submissions.error} onRetry={submissions.refetch} />
        ) : submissions.loading ? (
          <Card className="p-0">
            <TableSkeleton rows={4} columns={4} />
          </Card>
        ) : (submissions.data ?? []).length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No enquiries"
              message="Contact form submissions from the website will appear here."
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {(submissions.data ?? []).map((entry) => (
              <Card
                key={entry.id}
                accent={entry.status === 'New' ? 'warning' : 'none'}
                className={entry.status === 'New' ? 'pl-5' : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{entry.name}</p>
                    <p className="text-xs text-ink-muted">
                      {entry.email}
                      {entry.phone ? ` · ${entry.phone}` : ''}
                      {entry.service_interest ? ` · interested in ${entry.service_interest}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusTag tone={submissionTone(entry.status)}>{entry.status}</StatusTag>
                    <span className="text-xs text-ink-muted">{dateTime(entry.created_at)}</span>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{entry.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label htmlFor={`status-${entry.id}`} className="label-eyebrow">
                    Set status
                  </label>
                  <select
                    id={`status-${entry.id}`}
                    value={entry.status}
                    onChange={(event) =>
                      void setSubmissionStatus(entry, event.target.value as SubmissionStatus)
                    }
                    className="min-h-11 rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900"
                  >
                    {SUBMISSION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <a href={`mailto:${entry.email}`} className="text-link">
                    Reply by email
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {/* ---- Testimonials ---- */}
      {tab === 'testimonials' ? (
        <>
          {isAdmin ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => openTestimonial('new')}
              >
                Add testimonial
              </Button>
            </div>
          ) : null}

          {testimonials.error ? (
            <ErrorState message={testimonials.error} onRetry={testimonials.refetch} />
          ) : testimonials.loading ? (
            <Card className="p-0">
              <TableSkeleton rows={5} columns={4} />
            </Card>
          ) : (testimonials.data ?? []).length === 0 ? (
            <Card className="p-0">
              <EmptyState title="No testimonials" message="Add a client review to publish it." />
            </Card>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Rating</Th>
                  <Th>Review</Th>
                  <Th>Published</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {(testimonials.data ?? []).map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-muted/40">
                    <Td className="font-medium text-ink">{entry.client_name}</Td>
                    <Td>
                      <Rating value={entry.rating} />
                    </Td>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 text-ink-muted">{entry.review_text}</p>
                    </Td>
                    <Td>
                      <StatusTag tone={entry.is_published ? 'success' : 'neutral'}>
                        {entry.is_published ? 'Published' : 'Draft'}
                      </StatusTag>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {isAdmin ? (
                          <>
                            <Button
                              variant="secondary"
                              className="min-h-9 px-2 text-xs"
                              onClick={() => void togglePublish(entry)}
                            >
                              {entry.is_published ? 'Unpublish' : 'Publish'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => openTestimonial(entry)}
                              aria-label={`Edit ${entry.client_name}'s testimonial`}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-green-900"
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTestimonial(entry)}
                              aria-label={`Delete ${entry.client_name}'s testimonial`}
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-danger"
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
          )}
        </>
      ) : null}

      {/* ---- Portfolio ---- */}
      {tab === 'portfolio' ? (
        <>
          {isAdmin ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="primary"
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => openPortfolio('new')}
              >
                Add portfolio item
              </Button>
            </div>
          ) : null}

          {portfolio.error ? (
            <ErrorState message={portfolio.error} onRetry={portfolio.refetch} />
          ) : portfolio.loading ? (
            <Card className="p-0">
              <TableSkeleton rows={4} columns={4} />
            </Card>
          ) : (portfolio.data ?? []).length === 0 ? (
            <Card className="p-0">
              <EmptyState title="No portfolio items" message="Add a completed project to the gallery." />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(portfolio.data ?? []).map((item) => (
                <Card key={item.id} className="flex flex-col p-0">
                  <img
                    src={item.image_urls[0]}
                    alt={`${item.title} — completed ${SERVICE_LABELS[item.category].toLowerCase()} project`}
                    loading="lazy"
                    className="h-40 w-full rounded-t-card object-cover"
                  />
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-ink">{item.title}</p>
                      <StatusTag tone={item.is_published ? 'success' : 'neutral'}>
                        {item.is_published ? 'Live' : 'Draft'}
                      </StatusTag>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {SERVICE_LABELS[item.category]}
                      {item.location ? ` · ${item.location}` : ''}
                      {item.year ? ` · ${item.year}` : ''}
                    </p>
                    {item.description ? (
                      <p className="mt-2 line-clamp-2 text-ink-muted">{item.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-muted">
                      {item.image_urls.length} image{item.image_urls.length === 1 ? '' : 's'}
                    </p>
                    {isAdmin ? (
                      <div className="mt-auto flex gap-1 pt-3">
                        <Button
                          variant="secondary"
                          className="min-h-9 flex-1 px-2 text-xs"
                          onClick={() => openPortfolio(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          className="min-h-9 px-2 text-xs"
                          onClick={() => setDeletingPortfolio(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* ---- Modals ---- */}
      <Modal
        open={testimonialModal !== null}
        onClose={() => setTestimonialModal(null)}
        title={testimonialModal === 'new' ? 'Add testimonial' : 'Edit testimonial'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTestimonialModal(null)} disabled={testimonialSaving}>
              Cancel
            </Button>
            <Button type="submit" form="testimonial-form" variant="primary" loading={testimonialSaving}>
              Save
            </Button>
          </>
        }
      >
        <form id="testimonial-form" onSubmit={submitTestimonial} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Client name"
              value={testimonialForm.client_name}
              onChange={(event) =>
                setTestimonialForm({ ...testimonialForm, client_name: event.target.value })
              }
              required
            />
            <Select
              label="Rating"
              value={String(testimonialForm.rating)}
              onChange={(event) =>
                setTestimonialForm({ ...testimonialForm, rating: Number(event.target.value) })
              }
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} out of 5
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Review"
            value={testimonialForm.review_text}
            onChange={(event) =>
              setTestimonialForm({ ...testimonialForm, review_text: event.target.value })
            }
            required
          />
          <Toggle
            label="Publish on the website"
            description="Only published testimonials appear on the public site."
            checked={testimonialForm.is_published}
            onChange={(next) => setTestimonialForm({ ...testimonialForm, is_published: next })}
          />
          {testimonialError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {testimonialError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={portfolioModal !== null}
        onClose={() => setPortfolioModal(null)}
        title={portfolioModal === 'new' ? 'Add portfolio item' : 'Edit portfolio item'}
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPortfolioModal(null)} disabled={portfolioSaving}>
              Cancel
            </Button>
            <Button type="submit" form="portfolio-form" variant="primary" loading={portfolioSaving}>
              Save
            </Button>
          </>
        }
      >
        <form id="portfolio-form" onSubmit={submitPortfolio} className="flex flex-col gap-4" noValidate>
          <Input
            label="Title"
            value={portfolioForm.title}
            onChange={(event) => setPortfolioForm({ ...portfolioForm, title: event.target.value })}
            required
          />
          <div className="grid gap-4 sm:grid-cols-4">
            <Select
              label="Category"
              value={portfolioForm.category}
              onChange={(event) =>
                setPortfolioForm({ ...portfolioForm, category: event.target.value as ServiceType })
              }
            >
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SERVICE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Input
              label="Location"
              value={portfolioForm.location}
              onChange={(event) =>
                setPortfolioForm({ ...portfolioForm, location: event.target.value })
              }
              placeholder="Wigston, Leicester"
            />
            <Input
              label="Year"
              type="number"
              min={1990}
              max={2100}
              value={portfolioForm.year}
              onChange={(event) =>
                setPortfolioForm({ ...portfolioForm, year: Number(event.target.value) })
              }
            />
            <Input
              label="Duration (weeks)"
              type="number"
              min={1}
              value={portfolioForm.duration_weeks}
              onChange={(event) =>
                setPortfolioForm({ ...portfolioForm, duration_weeks: Number(event.target.value) })
              }
            />
          </div>
          <Textarea
            label="Description"
            value={portfolioForm.description}
            onChange={(event) =>
              setPortfolioForm({ ...portfolioForm, description: event.target.value })
            }
          />
          <Input
            label="Materials used"
            value={portfolioForm.materials_used}
            onChange={(event) =>
              setPortfolioForm({ ...portfolioForm, materials_used: event.target.value })
            }
            placeholder="Hand-painted tulipwood, granite worktop, brushed brass"
          />
          <Textarea
            label="Image URLs"
            value={portfolioForm.image_urls}
            onChange={(event) =>
              setPortfolioForm({ ...portfolioForm, image_urls: event.target.value })
            }
            hint="One URL per line. The first is used as the cover image."
            placeholder={'https://picsum.photos/seed/example-1/1400/1000'}
            required
          />
          <Toggle
            label="Publish in the gallery"
            checked={portfolioForm.is_published}
            onChange={(next) => setPortfolioForm({ ...portfolioForm, is_published: next })}
          />
          {portfolioError ? (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
              {portfolioError}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingTestimonial !== null}
        title="Delete this testimonial?"
        message={`${deletingTestimonial?.client_name ?? 'This'}'s review will be removed permanently.`}
        confirmLabel="Delete testimonial"
        onConfirm={async () => {
          if (!deletingTestimonial) return;
          try {
            await api.delete(`/testimonials/${deletingTestimonial.id}`);
            toast.success('Testimonial deleted.');
            await testimonials.refetch();
          } catch (caught) {
            toast.error(caught instanceof ApiError ? caught.message : 'Could not delete.');
          }
          setDeletingTestimonial(null);
        }}
        onCancel={() => setDeletingTestimonial(null)}
      />

      <ConfirmDialog
        open={deletingPortfolio !== null}
        title="Delete this portfolio item?"
        message={`"${deletingPortfolio?.title ?? ''}" will be removed from the gallery permanently.`}
        confirmLabel="Delete item"
        onConfirm={async () => {
          if (!deletingPortfolio) return;
          try {
            await api.delete(`/portfolio-items/${deletingPortfolio.id}`);
            toast.success('Portfolio item deleted.');
            await portfolio.refetch();
          } catch (caught) {
            toast.error(caught instanceof ApiError ? caught.message : 'Could not delete.');
          }
          setDeletingPortfolio(null);
        }}
        onCancel={() => setDeletingPortfolio(null)}
      />
    </>
  );
}
