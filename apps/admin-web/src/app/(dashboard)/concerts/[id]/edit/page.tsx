'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, SpinnerGap, Ticket } from '@phosphor-icons/react';
import { concertService } from '@/lib/services/concert.service';
import { Artist } from '@/lib/types';
import { extractApiMessages } from '@/lib/api-errors';

const concertSchema = z.object({
  name: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  artistId: z.string().min(1, 'Please select an artist'),
  venue: z.string().min(1, 'Please enter a venue'),
  startsAt: z.string().min(1, 'Start time is required'),
  endsAt: z.string().min(1, 'End time is required'),
  saleStartsAt: z.string().min(1, 'Sale start time is required'),
  saleEndsAt: z.string().min(1, 'Sale end time is required'),
});

type ConcertFormValues = z.infer<typeof concertSchema>;

export default function EditConcertPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConcertFormValues>({
    resolver: zodResolver(concertSchema),
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [aData, concertData] = await Promise.all([
          concertService.getArtists().catch(() => []),
          concertService.getConcert(id).catch(() => null)
        ]);
        
        setArtists(aData);
        
        if (concertData) {
          const formatForInput = (isoString: string) => {
            if (!isoString) return '';
            const d = new Date(isoString);
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          };

          reset({
            name: concertData.name || '',
            description: concertData.description || '',
            artistId: concertData.artist?.id || '',
            venue: concertData.venue || '',
            startsAt: concertData.startsAt ? formatForInput(concertData.startsAt) : '',
            endsAt: concertData.endsAt ? formatForInput(concertData.endsAt) : '',
            saleStartsAt: concertData.saleStartsAt ? formatForInput(concertData.saleStartsAt) : '',
            saleEndsAt: concertData.saleEndsAt ? formatForInput(concertData.saleEndsAt) : '',
          });
        }
      } catch (err) {
        console.error('Failed to load data', err);
        setServerErrors(['Failed to load concert details. Please ensure backend is running.']);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id, reset]);

  const onSubmit = async (data: ConcertFormValues) => {
    setIsSubmitting(true);
    setServerErrors(null);
    try {
      await concertService.updateConcert(id, data);
      router.push('/concerts');
    } catch (err: unknown) {
      setServerErrors(extractApiMessages(err, 'An unexpected error occurred while saving.'));
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/concerts"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} />
            Back to concerts
          </Link>
          <Link
            href={`/concerts/${id}/ticketing`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <Ticket size={16} />
            Ticketing
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Edit Concert</h1>
        <p className="text-sm text-muted mt-1">Update the details of this event.</p>
      </div>

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
              <label htmlFor="artistId" className="block text-sm font-medium text-primary mb-1.5">Artist</label>
              <select 
                id="artistId"
                {...register('artistId')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.artistId ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              >
                <option value="">Select Artist</option>
                {artists.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              {errors.artistId && <p className="mt-1.5 text-xs text-red-600">{errors.artistId.message}</p>}
            </div>

            <div>
              <label htmlFor="venue" className="block text-sm font-medium text-primary mb-1.5">Venue</label>
              <input 
                id="venue"
                {...register('venue')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
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
