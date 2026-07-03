'use client';

import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  FloppyDisk,
  PencilSimple,
  Plus,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { concertService } from '@/lib/services/concert.service';
import { Concert, SeatMapResponse, TicketType } from '@/lib/types';
import { extractApiMessages } from '@/lib/api-errors';
import { hasStoredAdminSession } from '@/lib/auth-store';

const ticketTypeSchema = z.object({
  name: z.string().min(1, 'Ticket type name is required'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  totalQuantity: z.coerce.number().int().min(1, 'Total quantity must be at least 1'),
  maxPerUser: z.coerce.number().int().min(1, 'Max per user must be at least 1'),
  saleStartsAt: z.string().optional(),
  saleEndsAt: z.string().optional(),
}).superRefine((values, ctx) => {
  if (values.maxPerUser > values.totalQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxPerUser'],
      message: 'Max per user cannot exceed total quantity',
    });
  }
});

type TicketTypeFormValues = z.infer<typeof ticketTypeSchema>;

const emptyTicketTypeValues: TicketTypeFormValues = {
  name: '',
  price: 0,
  totalQuantity: 0,
  maxPerUser: 4,
  saleStartsAt: '',
  saleEndsAt: '',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function parseSvgZoneIds(svgText: string) {
  const zoneTags = new Set(['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'g']);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const ids = new Set<string>();

  doc.querySelectorAll<SVGElement>('[id]').forEach((element) => {
    if (zoneTags.has(element.tagName.toLowerCase())) {
      ids.add(element.id);
    }
  });

  return Array.from(ids);
}

function Panel({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function ConcertTicketingPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  const [concert, setConcert] = useState<Concert | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTicketTypeId, setEditingTicketTypeId] = useState<string | null>(null);
  const [isTicketTypeModalOpen, setIsTicketTypeModalOpen] = useState(false);
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgZoneIds, setSvgZoneIds] = useState<string[]>([]);
  const [zoneMapping, setZoneMapping] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [seatMapPreviewError, setSeatMapPreviewError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TicketTypeFormValues>({
    resolver: zodResolver(ticketTypeSchema),
    defaultValues: emptyTicketTypeValues,
  });

  const editingTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === editingTicketTypeId) ?? null,
    [editingTicketTypeId, ticketTypes],
  );
  const selectedSvgPreviewUrl = useMemo(
    () => (svgFile ? URL.createObjectURL(svgFile) : null),
    [svgFile],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);

    try {
      const [concertData, ticketTypeData, seatMapData] = await Promise.all([
        concertService.getConcert(id),
        concertService.getTicketTypes(id).catch(() => []),
        concertService.getSeatMap(id).catch(() => null),
      ]);

      setConcert(concertData);
      setTicketTypes(ticketTypeData);
      setSeatMap(seatMapData);
      setSeatMapPreviewError(false);
    } catch (error) {
      console.error('Failed to load ticketing page', error);
      setPageError('Could not load ticketing data. Please check the backend and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hasStoredAdminSession()) {
      router.replace(`/login?next=${encodeURIComponent(`/concerts/${id}/ticketing`)}`);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id, loadData, router]);

  useEffect(() => {
    if (!editingTicketType) {
      return;
    }

    reset({
      name: editingTicketType.name,
      price: editingTicketType.price,
      totalQuantity: editingTicketType.totalQuantity,
      maxPerUser: editingTicketType.maxPerUser,
      saleStartsAt: editingTicketType.saleStartsAt ? editingTicketType.saleStartsAt.slice(0, 16) : '',
      saleEndsAt: editingTicketType.saleEndsAt ? editingTicketType.saleEndsAt.slice(0, 16) : '',
    });
  }, [editingTicketType, reset]);

  useEffect(() => {
    return () => {
      if (selectedSvgPreviewUrl) {
        URL.revokeObjectURL(selectedSvgPreviewUrl);
      }
    };
  }, [selectedSvgPreviewUrl]);

  const closeTicketTypeModal = () => {
    setIsTicketTypeModalOpen(false);
    setEditingTicketTypeId(null);
    reset(emptyTicketTypeValues);
    setServerErrors([]);
  };

  const openCreateTicketTypeModal = () => {
    setEditingTicketTypeId(null);
    reset(emptyTicketTypeValues);
    setServerErrors([]);
    setIsTicketTypeModalOpen(true);
  };

  const openEditTicketTypeModal = (ticketTypeId: string) => {
    setEditingTicketTypeId(ticketTypeId);
    setServerErrors([]);
    setIsTicketTypeModalOpen(true);
  };

  const onSubmitTicketType = async (values: TicketTypeFormValues) => {
    if (!concert) return;
    setIsSaving(true);
    setServerErrors([]);

    try {
      const payload = {
        ...values,
        saleStartsAt: values.saleStartsAt || undefined,
        saleEndsAt: values.saleEndsAt || undefined,
      };

      if (editingTicketTypeId) {
        await concertService.updateTicketType(concert.id, editingTicketTypeId, payload);
      } else {
        await concertService.createTicketType(concert.id, payload);
      }

      closeTicketTypeModal();
      await loadData();
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Could not save the ticket type.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSvgFileChange = async (file: File | null) => {
    setSvgFile(file);
    setServerErrors([]);
    setPageError(null);
    setSeatMapPreviewError(false);

    if (!file) {
      setSvgZoneIds([]);
      setZoneMapping({});
      return;
    }

    const text = await file.text();
    const zoneIds = parseSvgZoneIds(text);
    setSvgZoneIds(zoneIds);

    setZoneMapping((current) => {
      const next: Record<string, string> = {};
      zoneIds.forEach((zoneId) => {
        next[zoneId] = current[zoneId] ?? ticketTypes[0]?.id ?? '';
      });
      return next;
    });
  };

  const handleUploadSeatMap = async () => {
    if (!concert || !svgFile) {
      setServerErrors(['Please choose an SVG file before uploading.']);
      return;
    }

    if (svgZoneIds.length === 0) {
      setServerErrors(['No zone IDs were found in the SVG.']);
      return;
    }

    const mapping = svgZoneIds.reduce<Record<string, string>>((acc, zoneId) => {
      const ticketTypeId = zoneMapping[zoneId];
      if (ticketTypeId) {
        acc[zoneId] = ticketTypeId;
      }
      return acc;
    }, {});

    if (Object.keys(mapping).length !== svgZoneIds.length) {
      setServerErrors(['Each zone in the SVG must be mapped to a ticket type.']);
      return;
    }

    setIsUploading(true);
    setServerErrors([]);

    try {
      await concertService.uploadSeatMap(concert.id, svgFile, mapping);
      setSvgFile(null);
      setSvgZoneIds([]);
      setZoneMapping({});
      setSeatMapPreviewError(false);
      await loadData();
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Could not upload the seat map.'));
    } finally {
      setIsUploading(false);
    }
  };

  if (!hasStoredAdminSession()) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link
          href={`/concerts/${id}/edit`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to concert edit
        </Link>

        <div className="flex flex-col gap-4 rounded-[32px] border border-border bg-surface p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Concert ticketing configuration</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
              {concert?.name || 'Loading concert...'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Manage ticket types, purchase limits, sale windows, and the real SVG seat map.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</p>
              <p className="mt-1 text-sm font-semibold text-primary">{concert?.status || '--'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Sale starts</p>
              <p className="mt-1 text-sm font-semibold text-primary">{formatDateTime(concert?.saleStartsAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {pageError ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {pageError}
        </div>
      ) : null}

      {serverErrors.length > 0 ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <WarningCircle size={18} />
            Backend Error
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {serverErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-[32px] border border-border bg-surface p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-[28px] bg-border/60" />
            <div className="h-56 animate-pulse rounded-[28px] bg-border/60" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Panel
            title="Ticket types"
            description="Keep the ticket type logic unchanged. Only move the create and edit forms into pop-ups."
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted">
                  Create ticket types first, then the SVG seat map below will map zones to the correct real ticket types from the backend.
                </div>
                <button
                  type="button"
                  onClick={openCreateTicketTypeModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90"
                >
                  <Plus size={16} />
                  Add ticket type
                </button>
              </div>

              {ticketTypes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-sm text-muted">
                  No ticket types yet. Create at least one ticket type before uploading a seat map.
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full whitespace-nowrap text-left text-sm">
                    <thead className="border-b border-border bg-background">
                      <tr className="text-muted">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Price</th>
                        <th className="px-4 py-3 font-medium">Total</th>
                        <th className="px-4 py-3 font-medium">Sold</th>
                        <th className="px-4 py-3 font-medium">Held</th>
                        <th className="px-4 py-3 font-medium">Max / user</th>
                        <th className="px-4 py-3 font-medium">Sale window</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ticketTypes.map((ticketType) => (
                        <tr key={ticketType.id} className="hover:bg-primary/5">
                          <td className="px-4 py-3 font-medium text-primary">{ticketType.name}</td>
                          <td className="px-4 py-3 text-muted">{formatCurrency(ticketType.price)}</td>
                          <td className="px-4 py-3 text-muted">{ticketType.totalQuantity}</td>
                          <td className="px-4 py-3 text-muted">{ticketType.soldQuantity}</td>
                          <td className="px-4 py-3 text-muted">{ticketType.heldQuantity}</td>
                          <td className="px-4 py-3 text-muted">{ticketType.maxPerUser}</td>
                          <td className="px-4 py-3 text-muted">
                            <div className="space-y-1">
                              <p>{formatDateTime(ticketType.saleStartsAt)}</p>
                              <p>{formatDateTime(ticketType.saleEndsAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditTicketTypeModal(ticketType.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                            >
                              <PencilSimple size={16} />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Seat map upload"
            description="Upload a real SVG, parse zone IDs from the file, map each zone to a ticket type, then send it to the backend."
          >
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div>
                  <label htmlFor="seatmap" className="mb-1.5 block text-sm font-medium text-primary">SVG file</label>
                  <input
                    id="seatmap"
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleSvgFileChange(file);
                    }}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-primary file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-surface"
                  />
                </div>

                <div className="rounded-[28px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Current seat map</p>
                  {selectedSvgPreviewUrl ? (
                    <img
                      src={selectedSvgPreviewUrl}
                      alt="Selected seat map preview"
                      className="mt-3 max-h-[360px] w-full rounded-2xl border border-border object-contain"
                    />
                  ) : seatMap?.svgUrl && !seatMapPreviewError ? (
                    <img
                      src={seatMap.svgUrl}
                      alt="Seat map preview"
                      className="mt-3 max-h-[360px] w-full rounded-2xl border border-border object-contain"
                      onError={() => setSeatMapPreviewError(true)}
                    />
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                      {seatMapPreviewError ? 'Could not load the current seat map.' : 'No seat map has been uploaded yet.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Parsed zone ids</p>
                      <p className="mt-1 text-sm text-primary">Mapping will follow the exact IDs read from the real SVG.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUploadSeatMap()}
                      disabled={isUploading || !svgFile}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUploading ? <SpinnerGap size={16} className="animate-spin" /> : <UploadSimple size={16} />}
                      Upload SVG
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {svgZoneIds.length > 0 ? svgZoneIds.map((zoneId) => (
                      <span
                        key={zoneId}
                        className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary"
                      >
                        {zoneId}
                      </span>
                    )) : (
                      <span className="text-sm text-muted">
                        No SVG file selected or the SVG does not contain zone IDs.
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {svgZoneIds.length > 0 ? svgZoneIds.map((zoneId) => (
                    <div key={zoneId} className="rounded-[24px] border border-border bg-surface p-4">
                      <label className="mb-2 block text-sm font-medium text-primary">
                        {zoneId}
                      </label>
                      <select
                        value={zoneMapping[zoneId] ?? ticketTypes[0]?.id ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setZoneMapping((current) => ({
                            ...current,
                            [zoneId]: nextValue,
                          }));
                        }}
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select ticket type</option>
                        {ticketTypes.map((ticketType) => (
                          <option key={ticketType.id} value={ticketType.id}>
                            {ticketType.name} - {formatCurrency(ticketType.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )) : (
                    <div className="rounded-[24px] border border-dashed border-border bg-background p-6 text-sm text-muted">
                      Choose an SVG file so the system can read the zone IDs and generate the zone mapping form.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {isTicketTypeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4">
          <div className="w-full max-w-4xl rounded-[28px] border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {editingTicketType ? 'Edit ticket type' : 'Create ticket type'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-primary">
                  {editingTicketType ? editingTicketType.name : 'New ticket type'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  The logic stays the same as the old form. You just enter it in a pop-up instead of directly on the page.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTicketTypeModal}
                className="rounded-full border border-border p-2 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitTicketType)} className="mt-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-primary">Name</label>
                  <input
                    id="name"
                    {...register('name')}
                    className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.name ? 'border-red-500' : 'border-border'}`}
                    placeholder="VIP"
                  />
                  {errors.name ? <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p> : null}
                </div>

                <div>
                  <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-primary">Price</label>
                  <input
                    id="price"
                    type="number"
                    step="1000"
                    {...register('price')}
                    className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.price ? 'border-red-500' : 'border-border'}`}
                    placeholder="1000000"
                  />
                  {errors.price ? <p className="mt-1.5 text-xs text-red-600">{errors.price.message}</p> : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="totalQuantity" className="mb-1.5 block text-sm font-medium text-primary">Total quantity</label>
                  <input
                    id="totalQuantity"
                    type="number"
                    min={0}
                    {...register('totalQuantity')}
                    className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.totalQuantity ? 'border-red-500' : 'border-border'}`}
                  />
                  {errors.totalQuantity ? <p className="mt-1.5 text-xs text-red-600">{errors.totalQuantity.message}</p> : null}
                </div>

                <div>
                  <label htmlFor="maxPerUser" className="mb-1.5 block text-sm font-medium text-primary">Max per user</label>
                  <input
                    id="maxPerUser"
                    type="number"
                    min={1}
                    {...register('maxPerUser')}
                    className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.maxPerUser ? 'border-red-500' : 'border-border'}`}
                  />
                  {errors.maxPerUser ? <p className="mt-1.5 text-xs text-red-600">{errors.maxPerUser.message}</p> : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="saleStartsAt" className="mb-1.5 block text-sm font-medium text-primary">Sale starts at</label>
                  <input
                    id="saleStartsAt"
                    type="datetime-local"
                    {...register('saleStartsAt')}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="saleEndsAt" className="mb-1.5 block text-sm font-medium text-primary">Sale ends at</label>
                  <input
                    id="saleEndsAt"
                    type="datetime-local"
                    {...register('saleEndsAt')}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeTicketTypeModal}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                  {editingTicketType ? 'Save changes' : 'Create ticket type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
