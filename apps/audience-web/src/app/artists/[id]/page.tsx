"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, MusicNotes, SpinnerGap } from "@phosphor-icons/react";
import { Header } from "../../../components/Header";
import { concertService } from "@/lib/services/concert.service";
import { PublicArtistDetail } from "@/lib/types";
import { hasStoredSession } from "@/lib/auth-store";

export default function ArtistDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  const [artist, setArtist] = useState<PublicArtistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace(`/login?next=/artists/${id}`);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await concertService.getArtist(id);
        setArtist(data);
      } catch (error) {
        console.error("Failed to load artist detail", error);
        setErrorMessage("Không thể tải thông tin nghệ sĩ.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id, router]);

  if (!hasStoredSession()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <section className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          {isLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <SpinnerGap size={18} className="animate-spin" />
                Đang tải nghệ sĩ...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-xl">
              <h1 className="text-2xl font-semibold text-white">Không tải được nghệ sĩ</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">{errorMessage}</p>
              <Link
                href="/concerts"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <ArrowLeft size={16} weight="bold" />
                Về danh sách concert
              </Link>
            </div>
          ) : artist ? (
            <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="grid gap-0 lg:grid-cols-[minmax(460px,0.98fr)_1.02fr]">
                <div className="relative min-h-[360px] bg-zinc-900 lg:min-h-[640px]">
                  {artist.avatarUrl ? (
                    <img
                      src={artist.avatarUrl}
                      alt={artist.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[360px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.95)_0%,_rgba(15,23,42,0.95)_52%,_rgba(2,6,23,1)_100%)] lg:min-h-[640px]">
                      <MusicNotes size={96} weight="light" className="text-white/70" />
                    </div>
                  )}
                </div>

                <div className="flex min-h-[360px] flex-col justify-center p-6 sm:p-8 lg:min-h-[640px] lg:p-12">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Artist profile</p>
                  <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {artist.name}
                  </h1>
                  <p className="mt-5 max-w-3xl text-base leading-8 text-white/72 sm:text-lg lg:text-xl">
                    {artist.shortBio?.trim() || artist.description?.trim() || "Nghệ sĩ này chưa có bio công khai."}
                  </p>

                  <div className="mt-12 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/concerts"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 sm:w-auto"
                    >
                      <ArrowLeft size={16} weight="bold" />
                      Về concert
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 sm:w-auto"
                    >
                      Quay lại
                      <ArrowRight size={16} weight="bold" />
                    </button>
                  </div>

                  <div className="mt-10 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Public bio</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        {artist.shortBio?.trim() ? "Biographical summary is available for audience viewing." : "Bio công khai đang được cập nhật."}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Artwork</p>
                      <p className="mt-2 text-sm leading-6 text-white/70">
                        {artist.avatarUrl ? "Ảnh đại diện sẵn sàng cho màn hình lớn." : "Chưa có ảnh đại diện công khai."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
