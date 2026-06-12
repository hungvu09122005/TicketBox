"use client";
import { Header } from "../components/Header";
import { motion } from "motion/react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white selection:bg-emerald-500/30">
      <Header />
      <main>
        <section className="relative min-h-[100dvh] flex items-center pt-20 overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/hero_bg.png"
              alt="Live concert crowd"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-zinc-950/60 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
          </div>

          <div className="relative z-10 max-w-[1400px] mx-auto px-6 w-full pb-24">
            <div className="max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-medium uppercase tracking-wide mb-8">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Đang diễn ra
                </div>

                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tighter leading-[1.1] mb-6">
                  Những sự kiện đỉnh cao, <br className="hidden md:block" />
                  chỉ cách bạn một tấm vé.
                </h1>

                <p className="text-lg md:text-xl text-zinc-300 max-w-[500px] leading-relaxed mb-10">
                  Khám phá các buổi hòa nhạc, thể thao và sân khấu gần bạn. Giữ ngay chỗ ngồi cho những trải nghiệm được mong đợi nhất trong năm.
                </p>
              </motion.div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
