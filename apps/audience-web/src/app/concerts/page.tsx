/* eslint-disable @next/next/no-img-element */"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowClockwise, CalendarBlank, MapPin, MusicNotes, Ticket } from "@phosphor-icons/react";
import { Header } from "../../components/Header";
import { concertService } from "@/lib/services/concert.service";
import { PublicConcert } from "@/lib/types";
import { hasStoredSession } from "@/lib/auth-store";

type LoadState = "loading" | "ready" | "empty" | "error";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatSchedule(concert: PublicConcert) {
  const start = new Date(concert.startsAt);
  const end = new Date(concert.endsAt);
  return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function ConcertCard({ concert, index }: Readonly<{ concert: PublicConcert; index: number }>) {
  const hasBanner = Boolean(concert.bannerUrl);

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
        {hasBanner ? (
          <img
            src={concert.bannerUrl ?? ""}
            alt={concert.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#0f172a_42%,#020617_100%)]">
            <MusicNotes size={56} weight="light" className="text-white/70" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent" />

        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {' '}PUBLISHED
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/70">
            <CalendarBlank size={14} />
            {formatSchedule(concert)}
          </p>
          <h3 className="line-clamp-2 text-2xl font-semibold tracking-tight text-white">
            {concert.name}
          </h3>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">{concert.artist.name}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/65">
              {concert.description || "Đang cập nhật mô tả chương trình."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Thời lượng</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {timeFormatter.format(new Date(concert.startsAt))} - {timeFormatter.format(new Date(concert.endsAt))}
            </p>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-white/72">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="shrink-0 text-amber-300" />
            <span className="line-clamp-1">{concert.venue || "Địa điểm đang cập nhật"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Ticket size={16} className="shrink-0 text-sky-300" />
            <span>{concert.saleStartsAt ? `Mở bán từ ${formatSchedule({ ...concert, startsAt: concert.saleStartsAt, endsAt: concert.saleEndsAt ?? concert.saleStartsAt })}` : "Đang mở bán"}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <div className="aspect-[16/10 animate-pulse bg-white/10" />
      <div className="space-y-4 p-5">
        <div className="h-5 w-5/6 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
        <div className="grid gap-3">
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default function ConcertsPage() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<PublicConcert[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("Không thể tải danh sách concert.");

  const loadConcerts = useCallback(async () => {
    setState("loading");
    try {
      const data = await concertService.getPublishedConcerts();
      setConcerts(data);
      setState(data.length === 0 ? "empty" : "ready");
    } catch (error) {
      console.error("Failed to load published concerts", error);
      const status = typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      setConcerts([]);
      setErrorMessage(
        status === 401
          ? "Bạn cần đăng nhập để xem danh sách concert."
          : "Không thể kết nối API concert. Vui lòng thử lại."
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace("/login?next=/concerts");
      return;
    }

    const timer = window.setTimeout(() => {
      loadConcerts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConcerts, router]);

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />

        <section className="relative mx-auto max-w-[1400px] px-6 pb-16 pt-12 sm:pt-16 lg:px-8 lg:pt-20">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {' '}Concerts PUBLISHED từ API thật
              </div>

              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Danh sách concert đang mở bán, ảnh thật và thời gian thật.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                Trang audience lấy trực tiếp các concert trạng thái PUBLISHED từ API, hiển thị ảnh từ Object Storage và kèm thông tin thời gian, địa điểm để người xem quyết định nhanh hơn.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1400px] px-6 pb-24 lg:px-8">
          {state === "loading" && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`skeleton-${String(index)}`} />
              ))}
            </div>
          )}

          {state === "error" && (
            <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-200">Error</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Không tải được concert</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">
                {errorMessage}
              </p>
              <button
                onClick={() => void loadConcerts()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <ArrowClockwise size={16} weight="bold" />
                Thử lại
              </button>
            </div>
          )}

          {state === "empty" && (
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10">
                <MusicNotes size={32} className="text-white/70" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-white">Chưa có concert nào được public</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">
                Khi có concert trạng thái PUBLISHED trong API, trang này sẽ tự động hiển thị mà không cần dữ liệu giả ở local.
              </p>
            </div>
          )}

          {state === "ready" && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {concerts.map((concert, index) => (
                <ConcertCard key={concert.id} concert={concert} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
