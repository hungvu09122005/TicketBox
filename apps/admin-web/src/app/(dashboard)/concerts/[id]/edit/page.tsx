'use client';

import { Suspense, useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Sparkle, SpinnerGap, Ticket, UploadSimple } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { concertService } from '@/lib/services/concert.service';
import { operationsService } from '@/lib/services/operations.service';
import { Artist } from '@/lib/types';
import { extractApiMessages } from '@/lib/api-errors';
import { useToast } from '@/components/ui/ToastProvider';

const concertSchema = z.object({
  name: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  artistIds: z.array(z.string()).min(1, 'Please select at least one artist'),
  venue: z.string().min(1, 'Please enter a venue'),
  startsAt: z.string().min(1, 'Start time is required'),
  endsAt: z.string().min(1, 'End time is required'),
  saleStartsAt: z.string().min(1, 'Sale start time is required'),
  saleEndsAt: z.string().min(1, 'Sale end time is required'),
});

type ConcertFormValues = z.infer<typeof concertSchema>;

function formatDateTimeLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeDateTimeValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function EditConcertFormContent({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bioJobId = searchParams.get('bioJobId');
  const { id } = use(params);
  const admin = useAuthStore((state) => state.admin);
  
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const [bannerObjectKey, setBannerObjectKey] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConcertFormValues>({
    resolver: zodResolver(concertSchema),
    defaultValues: { artistIds: [] },
  });
  const selectedArtistIds = watch('artistIds');

  useEffect(() => {
    async function loadData() {
      try {
        const [aData, concertData] = await Promise.all([
          concertService.getArtists().catch(() => []),
          concertService.getConcert(id).catch(() => null)
        ]);
        
        setArtists(aData);
        
        if (concertData) {
          let description = concertData.description || '';

          if (bioJobId) {
            try {
              const aiJob = await operationsService.getAiBioJobStatus(bioJobId);
              if (aiJob?.draftContent) {
                description = aiJob.draftContent;
                setAiNotice(`Auto-filled concert description from AI job (${bioJobId.slice(0, 8)}). Save changes to publish.`);
              }
            } catch (err) {
              console.warn('Failed to load AI bio draft for concert pre-fill', err);
            }
          }

          reset({
            name: concertData.name || '',
            description,
            artistIds: concertData.artists?.map((artist) => artist.id) || [],
            venue: concertData.venue || '',
            startsAt: formatDateTimeLocalInput(concertData.startsAt),
            endsAt: formatDateTimeLocalInput(concertData.endsAt),
            saleStartsAt: formatDateTimeLocalInput(concertData.saleStartsAt),
            saleEndsAt: formatDateTimeLocalInput(concertData.saleEndsAt),
          });
          setBannerObjectKey(concertData.bannerObjectKey ?? null);
          setBannerPreviewUrl(concertData.bannerUrl ?? null);
        }
      } catch (err) {
        console.error('Failed to load data', err);
        setServerErrors(['Could not load the event details. Please try again.']);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [bioJobId, id, reset]);

  const toggleArtist = (artistId: string) => {
    const current = selectedArtistIds || [];
    const next = current.includes(artistId)
      ? current.filter((id) => id !== artistId)
      : [...current, artistId];
    setValue('artistIds', next, { shouldValidate: true, shouldDirty: true });
  };

  const { toast } = useToast();

  const handleBannerUpload = async (file?: File) => {
    if (!file) return;
    setIsUploadingBanner(true);
    setServerErrors(null);
    if (bannerPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreviewUrl);
    }
    setBannerPreviewUrl(URL.createObjectURL(file));
    try {
      const objectKey = await concertService.uploadBannerAsset(file);
      setBannerFileName(file.name);
      setBannerObjectKey(objectKey);
      toast.success('Banner image uploaded successfully.');
    } catch (err: unknown) {
      const msgs = extractApiMessages(err, 'Could not upload the banner.');
      setServerErrors(msgs);
      toast.error(msgs[0] || 'Could not upload the banner.');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const onSubmit = async (data: ConcertFormValues) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      await concertService.updateConcert(admin, id, {
        ...data,
        startsAt: normalizeDateTimeValue(data.startsAt),
        endsAt: normalizeDateTimeValue(data.endsAt),
        saleStartsAt: normalizeDateTimeValue(data.saleStartsAt),
        saleEndsAt: normalizeDateTimeValue(data.saleEndsAt),
        ...(bannerObjectKey ? { bannerObjectKey } : {}),
      });
      toast.success('Concert details updated successfully.');
      router.push('/concerts');
    } catch (err: unknown) {
      const msgs = extractApiMessages(err, 'An unexpected error occurred while saving.');
      setServerErrors(msgs);
      toast.error(msgs[0] || 'Failed to save concert details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <SpinnerGap size={32} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/concerts"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} />
            Back to concerts
          </Link>
          <Link
            href={`/concerts/${id}/ticketing`}
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <Ticket size={16} />
            Ticketing
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Edit Concert</h1>
        <p className="text-sm text-muted mt-1">Update the details of this event.</p>
      </div>

      {aiNotice ? (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-900">
          <Sparkle size={18} className="shrink-0 text-sky-600" />
          <span>{aiNotice}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-surface border border-border rounded-xl p-6 md:p-8 shadow-sm">
        {serverErrors && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            <strong>Backend Error:</strong>
            <ul className="list-disc space-y-1 pl-5 font-normal">
              {serverErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-primary mb-1.5">Concert Title</label>
            <input 
              id="name"
              {...register('name')}
              className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                errors.name ? 'border-red-500' : 'border-border focus:border-primary'
              }`}
            />
            {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Artists</label>
              <div className={`rounded-lg border p-3 space-y-2 max-h-36 overflow-y-auto ${
                errors.artistIds ? 'border-red-500' : 'border-border'
              }`}>
                {artists.length === 0 && <p className="text-xs text-muted">No artists available</p>}
                {artists.map((artist) => (
                  <label key={artist.id} className="flex items-center gap-2 cursor-pointer text-sm text-primary hover:bg-primary/5 rounded px-2 py-1.5 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedArtistIds?.includes(artist.id) || false}
                      onChange={() => toggleArtist(artist.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    {artist.name}
                  </label>
                ))}
              </div>
              {errors.artistIds && <p className="mt-1.5 text-xs text-red-600">{errors.artistIds.message}</p>}
            </div>

            <div className="flex h-full flex-col">
              <label htmlFor="venue" className="block text-sm font-medium text-primary mb-1.5">Venue</label>
              <textarea
                id="venue"
                {...register('venue')}
                rows={3}
                className={`w-full min-h-36 rounded-lg border py-2 px-3 text-sm leading-6 bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none ${
                  errors.venue ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
                placeholder="e.g. Wembley Stadium"
              />
              {errors.venue && <p className="mt-1.5 text-xs text-red-600">{errors.venue.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="startsAt" className="block text-sm font-medium text-primary mb-1.5">Start Time</label>
              <input 
                id="startsAt"
                type="datetime-local"
                {...register('startsAt')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.startsAt ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.startsAt && <p className="mt-1.5 text-xs text-red-600">{errors.startsAt.message}</p>}
            </div>

            <div>
              <label htmlFor="endsAt" className="block text-sm font-medium text-primary mb-1.5">End Time</label>
              <input 
                id="endsAt"
                type="datetime-local"
                {...register('endsAt')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.endsAt ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.endsAt && <p className="mt-1.5 text-xs text-red-600">{errors.endsAt.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="saleStartsAt" className="block text-sm font-medium text-primary mb-1.5">Sale Starts At</label>
              <input 
                id="saleStartsAt"
                type="datetime-local"
                {...register('saleStartsAt')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.saleStartsAt ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.saleStartsAt && <p className="mt-1.5 text-xs text-red-600">{errors.saleStartsAt.message}</p>}
            </div>

            <div>
              <label htmlFor="saleEndsAt" className="block text-sm font-medium text-primary mb-1.5">Sale Ends At</label>
              <input 
                id="saleEndsAt"
                type="datetime-local"
                {...register('saleEndsAt')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.saleEndsAt ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.saleEndsAt && <p className="mt-1.5 text-xs text-red-600">{errors.saleEndsAt.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-primary mb-1.5">Description</label>
            <textarea 
              id="description"
              {...register('description')}
              rows={5}
              className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none ${
                errors.description ? 'border-red-500' : 'border-border focus:border-primary'
              }`}
            />
            {errors.description && <p className="mt-1.5 text-xs text-red-600">{errors.description.message}</p>}
          </div>

          <div>
            <label htmlFor="banner" className="block text-sm font-medium text-primary mb-1.5">Banner image</label>
            <div className="rounded-lg border border-dashed border-border bg-surface/60 p-4">
              <input
                id="banner"
                type="file"
                accept="image/*"
                onChange={(event) => handleBannerUpload(event.target.files?.[0])}
                className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-surface hover:file:opacity-90"
              />
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
                {bannerPreviewUrl ? (
                  <img src={bannerPreviewUrl} alt="Banner preview" className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center px-4 text-center text-sm text-muted">
                    The current cover image will appear here after reloading.
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                {isUploadingBanner ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    <span>Loading cover image...</span>
                  </>
                ) : bannerObjectKey ? (
                  <>
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span>Selected cover image: {bannerFileName}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-primary">
                      {bannerObjectKey}
                    </span>
                  </>
                ) : (
                  <>
                    <UploadSimple size={14} />
                    <span>Choose a new cover image if the event does not have one yet.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col-reverse md:flex-row justify-end gap-3">
          <Link 
            href="/concerts"
            className="w-full md:w-auto text-center px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg border border-border transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full md:w-auto justify-center items-center gap-2 px-5 py-2.5 text-sm font-medium text-surface bg-primary rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : null}
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditConcertPage(props: Readonly<{ params: Promise<{ id: string }> }>) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-muted">
            <SpinnerGap size={32} className="animate-spin" />
          </div>
        </div>
      }
    >
      <EditConcertFormContent params={props.params} />
    </Suspense>
  );
}
