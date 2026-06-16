"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { Ticket, User, UserPlus } from "@phosphor-icons/react";

export function Header() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 50) {
      setScrolled(true);
    } else {
      setScrolled(false);
    }
  });

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 shadow-sm"
          : "bg-transparent"
        }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className={`flex items-center gap-2 transition-colors ${scrolled ? 'text-zinc-950' : 'text-white'}`}>
          <Ticket weight="fill" className="w-8 h-8 text-emerald-500" />
          <span className="font-bold text-xl tracking-tight">TicketBox</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/login" className={`flex items-center gap-2 text-sm font-medium transition-colors ${scrolled ? 'text-zinc-600 hover:text-zinc-950' : 'text-zinc-300 hover:text-white'}`}>
            <User className="w-5 h-5" />
            <span>Đăng nhập</span>
          </Link>
          <Link href="/register" className={`flex items-center gap-2 text-sm font-medium transition-colors ${scrolled ? 'text-zinc-600 hover:text-zinc-950' : 'text-zinc-300 hover:text-white'}`}>
            <UserPlus className="w-5 h-5" />
            <span>Đăng ký</span>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
