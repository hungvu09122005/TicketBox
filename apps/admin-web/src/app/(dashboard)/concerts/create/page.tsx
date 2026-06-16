'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, SpinnerGap } from '@phosphor-icons/react';
import { concertService } from '@/lib/services/concert.service';
import { Artist, Venue } from '@/lib/types';

const concertSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  artistId: z.string().min(1, 'Please select an artist'),
  venueId: z.string().min(1, 'Please select a venue'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});

type ConcertFormValues = z.infer<typeof concertSchema>;

export default function CreateConcertPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConcertFormValues>({
    resolver: zodResolver(concertSchema),
  });

  useEffect(() => {
    async function loadMeta() {
      try {
        const [aData, vData] = await Promise.all([
          concertService.getArtists(),
          concertService.getVenues()
        ]);
        setArtists(aData);
        setVenues(vData);
      } catch (err) {
        console.error('Failed to load form metadata. Please ensure backend is running.', err);
      }
    }
    loadMeta();
  }, []);

  const onSubmit = async (data: ConcertFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await concertService.createConcert({
        ...data,
        status: 'DRAFT'
      });
      router.push('/concerts');
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link 
          href="/concerts"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to concerts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Create New Concert</h1>
        <p className="text-sm text-muted mt-1">Fill in the details to draft a new event.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-surface border border-border rounded-xl p-6 md:p-8 shadow-sm">
        {serverError && (
          <div className="p-4 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg">
            <strong>Backend Error:</strong> {serverError}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">Concert Title</label>
            <input 
              {...register('title')}
              className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                errors.title ? 'border-red-500' : 'border-border focus:border-primary'
              }`}
              placeholder="e.g. The Eras Tour"
            />
            {errors.title && <p className="mt-1.5 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Artist</label>
              <select 
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
              <label className="block text-sm font-medium text-primary mb-1.5">Venue</label>
              <select 
                {...register('venueId')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.venueId ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              >
                <option value="">Select Venue</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.capacity} seats)</option>
                ))}
              </select>
              {errors.venueId && <p className="mt-1.5 text-xs text-red-600">{errors.venueId.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">Start Time</label>
              <input 
                type="datetime-local"
                {...register('startTime')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.startTime ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.startTime && <p className="mt-1.5 text-xs text-red-600">{errors.startTime.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">End Time</label>
              <input 
                type="datetime-local"
                {...register('endTime')}
                className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                  errors.endTime ? 'border-red-500' : 'border-border focus:border-primary'
                }`}
              />
              {errors.endTime && <p className="mt-1.5 text-xs text-red-600">{errors.endTime.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">Description</label>
            <textarea 
              {...register('description')}
              rows={5}
              className={`w-full rounded-lg border py-2.5 px-3 text-sm bg-surface text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none ${
                errors.description ? 'border-red-500' : 'border-border focus:border-primary'
              }`}
              placeholder="Detailed description of the concert..."
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
            {isSubmitting ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
