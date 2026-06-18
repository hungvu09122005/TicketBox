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
  SpinnerGap,
  UploadSimple,
  WarningCircle,
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
type TicketTypeFormInput = z.input<typeof ticketTypeSchema>;

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
  } = useForm<TicketTypeFormInput, undefined, TicketTypeFormValues>({
    resolver: zodResolver(ticketTypeSchema),
    defaultValues: emptyTicketTypeValues,
  });

  const editingTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === editingTicketTypeId) ?? null,
    [editingTicketTypeId, ticketTypes],
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
      setPageError('Không thể tải dữ liệu ticketing. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hasStoredAdminSession()) {
      router.replace(`/login?next=${encodeURIComponent(`/concerts/${id}/ticketing`)}`);
      return;
    }

    void loadData();
  }, [id, loadData, router]);

  useEffect(() => {
    if (editingTicketType) {
      reset({
        name: editingTicketType.name,
        price: editingTicketType.price,
        totalQuantity: editingTicketType.totalQuantity,
        maxPerUser: editingTicketType.maxPerUser,
        saleStartsAt: editingTicketType.saleStartsAt ? editingTicketType.saleStartsAt.slice(0, 16) : '',
        saleEndsAt: editingTicketType.saleEndsAt ? editingTicketType.saleEndsAt.slice(0, 16) : '',
      });
    }
  }, [editingTicketType, reset]);

  useEffect(() => {
    if (ticketTypes.length === 0) {
      return;
    }

    setZoneMapping((current) => {
      const next = { ...current };
      svgZoneIds.forEach((zoneId) => {
        if (!next[zoneId]) {
          next[zoneId] = ticketTypes[0].id;
        }
      });
      return next;
    });
  }, [svgZoneIds, ticketTypes]);

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

      setEditingTicketTypeId(null);
      reset(emptyTicketTypeValues);
      await loadData();
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Không thể lưu ticket type.'));
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
      setServerErrors(['Vui lòng chọn file SVG trước khi upload.']);
      return;
    }

    if (svgZoneIds.length === 0) {
      setServerErrors(['Không tìm thấy zone id nào trong SVG.']);
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
      setServerErrors(['Mỗi zone trong SVG phải được map với một ticket type.']);
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
      setServerErrors(extractApiMessages(error, 'Không thể upload seat map.'));
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
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition-colors"
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
              Quản lý loại vé, giới hạn mua, khung mở bán và sơ đồ chỗ ngồi.
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
            title={editingTicketType ? `Edit ${editingTicketType.name}` : 'Create ticket type'}
            description="Tạo hoặc cập nhật loại vé, rồi map từng zone vào đúng loại vé."
          >
            <form onSubmit={handleSubmit(onSubmitTicketType)} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-primary">Name</label>
                  <input
                    id="name"
                    {...register('name')}
                    className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.name ? 'border-red-500' : 'border-border'}`}
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
                    className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.price ? 'border-red-500' : 'border-border'}`}
                    placeholder="1000000"
                  />
                  {errors.price ? <p className="mt-1.5 text-xs text-red-600">{errors.price.message}</p> : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label htmlFor="totalQuantity" className="mb-1.5 block text-sm font-medium text-primary">Total quantity</label>
                  <input
                    id="totalQuantity"
                    type="number"
                    min={0}
                    {...register('totalQuantity')}
                    className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.totalQuantity ? 'border-red-500' : 'border-border'}`}
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
                    className={`w-full rounded-xl border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${errors.maxPerUser ? 'border-red-500' : 'border-border'}`}
                  />
                  {errors.maxPerUser ? <p className="mt-1.5 text-xs text-red-600">{errors.maxPerUser.message}</p> : null}
                </div>

                <div className="flex items-end gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                    {editingTicketType ? 'Save changes' : 'Create ticket type'}
                  </button>
                  {editingTicketType ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTicketTypeId(null);
                        reset(emptyTicketTypeValues);
                      }}
                      className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="saleStartsAt" className="mb-1.5 block text-sm font-medium text-primary">Sale starts at</label>
                  <input
                    id="saleStartsAt"
                    type="datetime-local"
                    {...register('saleStartsAt')}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label htmlFor="saleEndsAt" className="mb-1.5 block text-sm font-medium text-primary">Sale ends at</label>
                  <input
                    id="saleEndsAt"
                    type="datetime-local"
                    {...register('saleEndsAt')}
                    className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </form>
          </Panel>

          <Panel
            title="Ticket types"
            description="Chọn một loại vé để sửa hoặc theo dõi số lượng đã bán, đang giữ và còn lại."
          >
            {ticketTypes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-background p-8 text-sm text-muted">
                Chưa có loại vé nào. Hãy tạo ít nhất một loại vé trước khi tải sơ đồ.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
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
                            onClick={() => setEditingTicketTypeId(ticketType.id)}
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
          </Panel>

          <Panel
            title="Tải sơ đồ chỗ ngồi"
            description="Tải sơ đồ chỗ ngồi, đọc zone từ file rồi gán từng zone vào loại vé."
          >
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Step 1</p>
                  <label htmlFor="seatmap" className="mt-1 block text-sm font-medium text-primary">
                    Chọn file sơ đồ
                  </label>
                  <input
                    id="seatmap"
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void handleSvgFileChange(file);
                    }}
                    className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-primary file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-surface"
                  />
                  <p className="mt-2 text-xs leading-5 text-muted">
                    Đây chỉ là bước chọn file. Nút ở khung bên phải sẽ đọc zone và tải sơ đồ đã chọn.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                    {svgFile ? (
                      <span className="rounded-full border border-border bg-surface px-3 py-1 font-medium text-primary">
                        Selected: {svgFile.name}
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-surface px-3 py-1">
                        Chưa chọn file sơ đồ
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Sơ đồ chỗ ngồi hiện tại</p>
                  {seatMap?.svgUrl && !seatMapPreviewError ? (
                    <img
                      src={seatMap.svgUrl}
                      alt="Seat map preview"
                      className="mt-3 max-h-[360px] w-full rounded-2xl border border-border object-contain"
                      onError={() => setSeatMapPreviewError(true)}
                    />
                  ) : (
                    <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                      {seatMapPreviewError
                        ? 'Không thể tải sơ đồ chỗ ngồi.'
                        : 'Chưa có sơ đồ chỗ ngồi.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Step 2</p>
                      <p className="mt-1 text-sm text-primary">Parse zone ids rồi xác nhận upload file đã chọn.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleUploadSeatMap()}
                      disabled={isUploading || !svgFile}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUploading ? <SpinnerGap size={16} className="animate-spin" /> : <UploadSimple size={16} />}
                      Xác nhận tải sơ đồ
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
                        Chưa chọn file hoặc sơ đồ chưa có zone.
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
                      Chọn file sơ đồ để tự tạo danh sách zone và gán từng zone vào loại vé.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
