'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { ArrowLeft, FloppyDisk, SpinnerGap, UploadSimple } from '@phosphor-icons/react';
import { operationsService, type AiBioRequestResult } from '@/lib/services/operations.service';

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AiBioReviewPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const [job, setJob] = useState<AiBioRequestResult | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const data = await operationsService.getAiBioJobStatus(id);
        if (!isActive) return;
        setJob(data);
        setDraftContent(data.draftContent ?? '');
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not load the AI bio request.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleSave = async () => {
    if (!draftContent.trim()) {
      setErrorMessage('Draft content is required.');
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const next = await operationsService.updateAiBioDraft(id, draftContent);
      setJob(next);
      setDraftContent(next.draftContent ?? draftContent);
      setStatusMessage('Saved the AI bio draft.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save the draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const next = await operationsService.publishAiBioDraft(id);
      setJob(next);
      setDraftContent(next.draftContent ?? draftContent);
      setStatusMessage('Published the bio to the real artist.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not publish the draft.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/operations/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft size={16} />
        Back to job monitor
      </Link>

      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">AI bio review</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Review press-kit draft</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          View, edit, and publish AI-generated copy for the selected target.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[28px] border border-border bg-surface p-6 text-sm text-muted">
          <div className="inline-flex items-center gap-2">
            <SpinnerGap size={16} className="animate-spin" />
            Loading AI bio request...
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {job ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-border bg-background p-3 text-primary">
                <UploadSimple size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-primary">Draft content</h2>
                <p className="text-sm text-muted">Edit before publishing to the target record.</p>
              </div>
            </div>
            <textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              rows={18}
              className="mt-5 w-full rounded-[24px] border border-border bg-background p-4 text-sm leading-7 text-primary outline-none focus:border-primary"
              placeholder="AI draft content..."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-60"
              >
                {isSaving ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isPublishing || !draftContent.trim()}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-60"
              >
                {isPublishing ? <SpinnerGap size={16} className="animate-spin" /> : <UploadSimple size={16} />}
                {job?.targetType === 'CONCERT' ? 'Publish to concert' : 'Publish to artist'}
              </button>
            </div>
            {statusMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{statusMessage}</div> : null}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-primary">Request metadata</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-muted">
                <p>Status: {job.status ?? '--'}</p>
                <p>Target type: {job.targetType ?? '--'}</p>
                <p>Target ID: {job.targetId ?? job.artistId ?? '--'}</p>
                <p>Requested by: {job.requestedBy ?? '--'}</p>
                <p>Created: {formatDateTime(job.createdAt)}</p>
                <p>Updated: {formatDateTime(job.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-primary">How it behaves</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                DRAFT stays hidden from the audience until an admin publishes it. Publishing writes to `artist.shortBio` for artist targets and to `concert.description` for concert targets.
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
