'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, CloudArrowUp, FileMagnifyingGlass, SpinnerGap } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function JobsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewJobs = permissions.includes(Permission.VIP_IMPORT) || permissions.includes(Permission.AI_GENERATE_BIO);
  const [csvJobId, setCsvJobId] = useState('');
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const lookupCsvStatus = async () => {
    if (!csvJobId.trim()) {
      setCsvError('Please enter a CSV job ID.');
      return;
    }

    setCsvLoading(true);
    setCsvError(null);

    try {
      const status = await operationsService.getCsvImportStatus(csvJobId.trim());
      setCsvMessage(status.status ? `CSV job status: ${status.status}` : 'CSV job status loaded.');
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Unable to load CSV job status.');
    } finally {
      setCsvLoading(false);
    }
  };

  const createAiRequest = async () => {
    if (!pdfFile) {
      setAiError('Please choose a PDF file.');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const result = await operationsService.createAiBioRequest(pdfFile);
      setAiMessage(result.status ? `AI bio request created: ${result.status}` : 'AI bio request created.');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Unable to create AI bio request.');
    } finally {
      setAiLoading(false);
    }
  };

  if (!canViewJobs) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        You do not have access to job monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Request 16</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Background job monitor</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                CSV imports, AI bio jobs, and queue state are exposed here through real APIs and the backend Bull Board.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <FileMagnifyingGlass size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">CSV import status</h2>
              <p className="text-sm text-muted">Reads `/imports/:jobId/status` from the backend.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-primary">Job ID</span>
              <input
                value={csvJobId}
                onChange={(event) => setCsvJobId(event.target.value)}
                placeholder="csv-job-id"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              onClick={lookupCsvStatus}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface"
            >
              {csvLoading ? <SpinnerGap size={16} className="animate-spin" /> : <FileMagnifyingGlass size={16} />}
              Lookup status
            </button>
            {csvJobId.trim() ? (
              <Link
                href={`/operations/jobs/${encodeURIComponent(csvJobId.trim())}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary"
              >
                Open detail view
              </Link>
            ) : null}
            {csvMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{csvMessage}</div> : null}
            {csvError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{csvError}</div> : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <CloudArrowUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">AI bio request</h2>
              <p className="text-sm text-muted">Creates a real multipart request to `/api/artist-bio`.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <span className="truncate">{pdfFile ? pdfFile.name : 'Choose PDF'}</span>
              </label>
              <button
                type="button"
                onClick={createAiRequest}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface"
              >
                {aiLoading ? <SpinnerGap size={16} className="animate-spin" /> : <CloudArrowUp size={16} />}
                Create AI job
              </button>
            </div>
            {aiMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{aiMessage}</div> : null}
            {aiError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{aiError}</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Queue dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Retry, failed status, and queue depth stay in the real Bull Board instead of being reimplemented in the frontend.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <iframe title="Bull Board queue dashboard" src={queueDashboardHref} className="h-[640px] w-full" />
        </div>
      </section>
    </div>
  );
}
