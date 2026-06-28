"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Info,
  MusicNotes,
  Ticket,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { Header } from "../../../components/Header";
import { concertService } from "@/lib/services/concert.service";
import {
  CreateOrderPayload,
  OrderSummary,
  PublicConcert,
  PublicTicketType,
  SeatMapResponse,
  TicketSummary,
} from "@/lib/types";
import { extractApiMessages } from "@/lib/api-errors";
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

function formatDateTime(isoString: string) {
  const date = new Date(isoString);
  return `${dateFormatter.format(date)} • ${timeFormatter.format(date)}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: PublicConcert["status"]) {
  switch (status) {
    case "PUBLISHED":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "CANCELLED":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    case "COMPLETED":
      return "border-sky-400/30 bg-sky-400/10 text-sky-200";
    default:
      return "border-white/15 bg-white/5 text-white/70";
  }
}

function summarizeByTicketType(
  orders: OrderSummary[],
  tickets: TicketSummary[],
  ticketTypeId: string,
) {
  const paid = orders.reduce((total, order) => {
    if (order.ticketTypeId !== ticketTypeId || order.status !== "PAID") {
      return total;
    }

    return total + order.quantity;
  }, 0);

  const held = orders.reduce((total, order) => {
    if (order.ticketTypeId !== ticketTypeId || order.status !== "PENDING_PAYMENT") {
      return total;
    }

    return total + order.quantity;
  }, 0);

  const activeTickets = tickets.filter(
    (ticket) => ticket.ticketTypeId === ticketTypeId && ticket.status === "ACTIVE",
  ).length;

  return {
    paid,
    held,
    activeTickets,
  };
}

function InlineStateCard({
  title,
  description,
  icon,
  action,
}: Readonly<{
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
}>) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/10 text-white/80">
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export default function ConcertDetailClient({ id }: Readonly<{ id: string }>) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const [concert, setConcert] = useState<PublicConcert | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [ticketTypes, setTicketTypes] = useState<PublicTicketType[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [svgError, setSvgError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("Không thể tải concert.");
  const [submitError, setSubmitError] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [paymentReviewHref, setPaymentReviewHref] = useState<string | null>(null);
  const checkoutLockRef = useRef<string | null>(null);

  const selectedTicketType = useMemo(
    () => ticketTypes.find((item) => item.id === selectedTicketTypeId) ?? null,
    [selectedTicketTypeId, ticketTypes],
  );

  const selectedZone = useMemo(
    () => seatMap?.zones.find((item) => item.id === selectedZoneId) ?? null,
    [seatMap, selectedZoneId],
  );

  const loadConcert = useCallback(async () => {
    setState("loading");
    setSubmitError([]);
    setSubmitSuccess(null);
    setBannerError(false);

    try {
      const concertData = await concertService.getConcert(id);
      if (concertData.status === "CANCELLED") {
        setConcert(concertData);
        setSeatMap(null);
        setTicketTypes([]);
        setOrders([]);
        setTickets([]);
        setSvgMarkup(null);
        setSvgError(false);
        setBannerError(false);
        setState("empty");
        setErrorMessage("Concert này đã bị hủy.");
        return;
      }

      if (concertData.status !== "PUBLISHED") {
        throw Object.assign(new Error("Concert is not published"), {
          response: { status: 404 },
        });
      }

      const [seatMapData, ticketTypeData, orderData, ticketData] = await Promise.all([
        concertService.getSeatMap(id).catch(() => null),
        concertService.getAvailability(id).catch(() => []),
        concertService.getMyOrders().catch(() => []),
        concertService.getMyTickets().catch(() => []),
      ]);

      setConcert(concertData);
      setSeatMap(seatMapData);
      setTicketTypes(ticketTypeData);
      setOrders(orderData.filter((order) => order.concertId === concertData.id));
      setTickets(ticketData.filter((ticket) => ticket.concertId === concertData.id));
      setSvgError(false);
      setState("ready");

      const firstTicketTypeId =
        ticketTypeData.find((item) => item.status === "AVAILABLE")?.id ??
        ticketTypeData[0]?.id ??
        null;
      setSelectedTicketTypeId(firstTicketTypeId);
      setSelectedZoneId(seatMapData?.zones[0]?.id ?? null);
      setQuantity(1);
    } catch (error) {
      console.error("Failed to load concert detail", error);
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      setConcert(null);
      setSeatMap(null);
      setTicketTypes([]);
      setOrders([]);
      setTickets([]);
      setSvgMarkup(null);
      setSvgError(false);
      setBannerError(false);
      setState("error");
      setErrorMessage(
        status === 404
          ? "Concert không tồn tại."
          : "Không thể kết nối API concert. Vui lòng thử lại.",
      );
    }
  }, [id]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!hasStoredSession()) {
      router.replace(`/login?next=/concerts/${id}`);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadConcert();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id, loadConcert, mounted, router]);

  useEffect(() => {
    let isCancelled = false;
    const loadSvg = async () => {
      if (!seatMap?.svgUrl) {
        setSvgMarkup(null);
        setSvgError(false);
        return;
      }

      try {
        const response = await fetch(seatMap.svgUrl);
        if (!response.ok) {
          throw new Error(`SVG fetch failed with ${response.status}`);
        }

        const markup = await response.text();
        if (!isCancelled) {
          setSvgMarkup(markup);
          setSvgError(false);
        }
      } catch (error) {
        console.error("Failed to load SVG markup", error);
        if (!isCancelled) {
          setSvgMarkup(null);
          setSvgError(true);
        }
      }
    };

    void loadSvg();

    return () => {
      isCancelled = true;
    };
  }, [seatMap?.svgUrl]);

  useEffect(() => {
    if (state !== "ready") {
      return;
    }

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const [availability, orderData, ticketData] = await Promise.all([
            concertService.getAvailability(id).catch(() => []),
            concertService.getMyOrders().catch(() => []),
            concertService.getMyTickets().catch(() => []),
          ]);

          setTicketTypes(availability);
          setOrders(orderData.filter((order) => order.concertId === id));
          setTickets(ticketData.filter((ticket) => ticket.concertId === id));
        } catch (error) {
          console.error("Failed to refresh availability", error);
        }
      })();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [id, state]);

  useEffect(() => {
    if (!seatMap || !svgMarkup || !svgContainerRef.current) {
      return;
    }

    const activeIds = new Set(seatMap.zones.map((zone) => zone.id));
    const nodes = Array.from(svgContainerRef.current.querySelectorAll<SVGElement>("[id]"));
    const cleanup: Array<() => void> = [];

    nodes.forEach((node) => {
      const zoneId = node.id;
      if (!activeIds.has(zoneId)) {
        return;
      }

      const zone = seatMap.zones.find((item) => item.id === zoneId);
      if (!zone) {
        return;
      }

      const handleClick = () => {
        setSelectedZoneId(zoneId);
        setPaymentReviewHref(null);
        if (zone.ticketTypeId) {
          setSelectedTicketTypeId(zone.ticketTypeId);
        }
      };

      node.style.cursor = "pointer";
      node.style.transition = "opacity 180ms ease, filter 180ms ease, transform 180ms ease";
      node.addEventListener("click", handleClick);
      cleanup.push(() => node.removeEventListener("click", handleClick));
    });

    return () => {
      cleanup.forEach((fn) => fn());
    };
  }, [seatMap, svgMarkup]);

  useEffect(() => {
    if (!seatMap || !svgContainerRef.current) {
      return;
    }

    const elements = Array.from(svgContainerRef.current.querySelectorAll<SVGElement>("[id]"));
    elements.forEach((element) => {
      const zone = seatMap.zones.find((item) => item.id === element.id);
      if (!zone) {
        return;
      }

      const isSelected = zone.id === selectedZoneId;
      const shouldDim = selectedZoneId !== null && !isSelected;

      element.style.opacity = shouldDim ? "0.36" : "1";
      element.style.filter = isSelected ? "drop-shadow(0 0 16px rgba(251, 191, 36, 0.45))" : "none";
      element.style.stroke = isSelected ? "rgba(251, 191, 36, 1)" : element.style.stroke || "";
      element.style.strokeWidth = isSelected ? "3" : "1.5";
      element.style.transformOrigin = "center";
      element.style.transform = isSelected ? "scale(1.01)" : "scale(1)";
    });
  }, [seatMap, selectedZoneId, svgMarkup]);

  const selectedSummary = selectedTicketType
    ? summarizeByTicketType(orders, tickets, selectedTicketType.id)
    : null;

  const userLimit = selectedTicketType
    ? Math.max(
        0,
        selectedTicketType.maxPerUser - (selectedSummary?.paid ?? 0) - (selectedSummary?.held ?? 0),
      )
    : 0;

  const maxSelectable = selectedTicketType
    ? Math.min(userLimit, selectedTicketType.availableQuantity)
    : 0;
  const displayQuantity = selectedTicketType ? Math.min(quantity, maxSelectable || 1) : quantity;

  const buildCheckoutKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const extractPaymentUrl = (result: Awaited<ReturnType<typeof concertService.initiatePayment>>) =>
    result.paymentUrl ?? result.redirectUrl ?? result.url ?? null;

  const buildWaitingRoomHref = (queueToken: string) => {
    const params = new URLSearchParams({
      ticketTypeId: selectedTicketType?.id ?? '',
      quantity: String(quantity),
      queueToken,
    });

    return `/concerts/${concert?.id ?? id}/waiting-room?${params.toString()}`;
  };

  const handleCreateOrder = async () => {
    if (!selectedTicketType || !concert || quantity < 1 || checkoutLockRef.current) {
      return;
    }

    const checkoutIdempotencyKey = buildCheckoutKey();
    checkoutLockRef.current = checkoutIdempotencyKey;

    const payload: CreateOrderPayload = {
      concertId: concert.id,
      ticketTypeId: selectedTicketType.id,
      quantity,
    };

    setIsSubmitting(true);
    setSubmitError([]);
    setSubmitSuccess(null);
    setPaymentReviewHref(null);

    try {
      const response = await concertService.createOrder(payload, checkoutIdempotencyKey);
      if ('id' in response) {
        const paymentResult = await concertService.initiatePayment(response.id, checkoutIdempotencyKey);
        const paymentUrl = extractPaymentUrl(paymentResult);

        setSubmitSuccess(`Đã tạo đơn giữ vé ${response.id}. Đang chuyển sang cổng thanh toán thật.`);
        await loadConcert();

        if (paymentUrl) {
          window.location.assign(paymentUrl);
          return;
        }

        setPaymentReviewHref(`/payments/return?orderId=${encodeURIComponent(response.id)}&status=pending`);
        setSubmitSuccess(
          `Đã tạo order ${response.id}. Backend chưa trả payment URL, bạn có thể kiểm tra lại trạng thái trên trang return.`,
        );
        return;
      }

      if (response.status === 'QUEUED') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(
            `ticketbox:waiting-room:${concert.id}`,
            JSON.stringify({
              concertId: concert.id,
              ticketTypeId: selectedTicketType.id,
              quantity,
              queueToken: response.queueToken ?? '',
              idempotencyKey: checkoutIdempotencyKey,
            }),
          );
        }

        setSubmitSuccess(
          response.message ??
            'Đơn của bạn đang ở hàng đợi. Bạn sẽ được chuyển sang waiting room để tự động tạo order khi đến lượt.',
        );
        router.push(buildWaitingRoomHref(response.queueToken ?? ''));
      }
    } catch (error) {
      setSubmitError(extractApiMessages(error, "Không thể giữ vé hoặc khởi tạo thanh toán lúc này."));
    } finally {
      setIsSubmitting(false);
      checkoutLockRef.current = null;
    }
  };

  if (!mounted) {
    return null;
  }

  if (!hasStoredSession()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.24),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.2),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />

        <section className="relative mx-auto max-w-[1400px] px-6 pb-12 pt-10 lg:px-8 lg:pt-16">
          <Link
            href="/concerts"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} />
            Quay lại concert
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              {concert?.status ? (
                <div
                  className={`mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${getStatusBadge(concert.status)}`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {concert.status}
                </div>
              ) : null}

              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                {concert?.name ?? "Đang tải concert"}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                {concert?.description ||
                  "Mở sự kiện để xem nghệ sĩ, sơ đồ chỗ ngồi, loại vé khả dụng và giữ vé theo giới hạn mua."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Thời gian</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {concert ? formatDateTime(concert.startsAt) : "--"}
                </p>
                <p className="mt-1 text-sm text-white/65">
                  {concert ? formatDateTime(concert.endsAt) : "--"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Venue</p>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-white">
                  {concert?.venue || "Đang cập nhật venue"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-[1400px] px-6 pb-8 lg:px-8">
          {state === "loading" && (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="h-8 w-1/2 animate-pulse rounded-full bg-white/10" />
                <div className="aspect-[16/9] animate-pulse rounded-[24px] bg-white/10" />
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="h-16 animate-pulse rounded-[20px] bg-white/10" />
                  <div className="h-16 animate-pulse rounded-[20px] bg-white/10" />
                  <div className="h-16 animate-pulse rounded-[20px] bg-white/10" />
                </div>
              </div>
              <div className="space-y-4 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="h-6 w-1/3 animate-pulse rounded-full bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
                <div className="h-28 animate-pulse rounded-[24px] bg-white/10" />
                <div className="h-14 animate-pulse rounded-[20px] bg-white/10" />
              </div>
            </div>
          )}

          {state === "error" && (
            <InlineStateCard
              title="Không tải được concert"
              description={errorMessage}
              icon={<WarningCircle size={32} />}
              action={
                <button
                  type="button"
                  onClick={() => void loadConcert()}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
                >
                  <ArrowClockwise size={16} weight="bold" />
                  Thử lại
                </button>
              }
            />
          )}

          {state === "empty" && concert?.status === "CANCELLED" && (
            <InlineStateCard
              title="Concert đã bị hủy"
              description="Concert này không còn mở bán. Dữ liệu chi tiết vẫn được giữ để khách tham khảo nhưng không thể đặt vé mới."
              icon={<XCircle size={32} />}
              action={
                <Link
                  href="/concerts"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Về danh sách
                </Link>
              }
            />
          )}

          {state === "ready" && concert && (
          <div className="grid gap-6 xl:grid-cols-[1.42fr_0.58fr]">
              <div className="space-y-6">
                <article className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                  <div className="relative aspect-[16/9] bg-zinc-900">
                    {concert.bannerUrl && !bannerError ? (
                      <img
                        src={concert.bannerUrl}
                        alt={concert.name}
                        className="h-full w-full object-cover"
                        onError={() => setBannerError(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#0f172a_42%,#020617_100%)]">
                        <MusicNotes size={64} weight="light" className="text-white/70" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

                    <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Đang mở bán
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/70">
                        <CalendarBlank size={14} />
                        {formatDateTime(concert.startsAt)}
                      </p>
                      <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        {concert.name}
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Artist</p>
                      <p className="mt-2 text-sm font-semibold text-white">{concert.artists?.map(a => a.name).join(', ') || 'Nghệ sĩ đang cập nhật'}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Venue</p>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                        {concert.venue || "Đang cập nhật"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Sơ đồ chỗ ngồi</p>
                      <div className="mt-2 flex min-h-[56px] items-center justify-center rounded-[16px] border border-white/10 bg-black/20 px-3 py-2 text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">
                          {seatMap?.zones.length ? `${seatMap.zones.length} khu vực` : "Chưa có"}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <Info size={22} className="text-white/85" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Nghệ sĩ tham gia</h3>
                      <p className="text-sm text-white/60">Hiển thị toàn bộ nghệ sĩ công khai của concert này.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(concert.artists?.length ? concert.artists : []).map((artistItem) => (
                      <Link
                        key={artistItem.id}
                        href={`/artists/${artistItem.id}`}
                        className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/5 transition-transform hover:-translate-y-0.5"
                      >
                        <div className="aspect-[4/3] bg-zinc-900">
                          {artistItem.avatarUrl ? (
                            <img
                              src={artistItem.avatarUrl}
                              alt={artistItem.name}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#0f172a_52%,#020617_100%)]">
                              <MusicNotes size={36} weight="light" className="text-white/70" />
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 p-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Nghệ sĩ</p>
                            <h4 className="mt-2 text-lg font-semibold text-white">{artistItem.name}</h4>
                          </div>
                          <p className="text-sm leading-6 text-white/68">
                            Nhấn để xem chi tiết nghệ sĩ, gồm short bio và ảnh đại diện.
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {!concert.artists?.length ? (
                    <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm leading-6 text-white/68">
                      Concert này chưa có nghệ sĩ công khai.
                    </div>
                  ) : null}
                </article>

                <article className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">Sơ đồ chỗ ngồi tương tác</h3>
                      <p className="mt-1 text-sm text-white/60">
                        Chọn khu vực trực tiếp trên sơ đồ hoặc từ danh sách bên dưới để xem loại vé, giá và giới hạn mua.
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
                      {seatMap?.zones.length ?? 0} zones
                    </div>
                  </div>

                  <div className="mt-5 space-y-5">
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/70">
                      {svgMarkup ? (
                        <div
                          ref={svgContainerRef}
                          className="min-h-[520px] w-full overflow-auto p-5 [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full [&_svg]:min-h-[520px]"
                          dangerouslySetInnerHTML={{ __html: svgMarkup }}
                        />
                      ) : seatMap?.svgUrl && !svgError ? (
                        <img
                          src={seatMap.svgUrl}
                          alt="Seat map"
                          className="h-full min-h-[520px] w-full object-contain"
                          onError={() => setSvgError(true)}
                        />
                      ) : (
                        <div className="flex min-h-[520px] items-center justify-center bg-white/5 text-white/55">
                          {svgError ? "Không thể hiển thị sơ đồ chỗ ngồi." : "Chưa có sơ đồ chỗ ngồi"}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {seatMap?.zones.length ? (
                        seatMap.zones.map((zone) => {
                          const ticketType = ticketTypes.find((item) => item.id === zone.ticketTypeId) ?? null;
                          const isActive = zone.id === selectedZoneId;

                          return (
                            <button
                              key={zone.id}
                              type="button"
                              onClick={() => {
                                setSelectedZoneId(zone.id);
                                setPaymentReviewHref(null);
                                if (zone.ticketTypeId) {
                                  setSelectedTicketTypeId(zone.ticketTypeId);
                                }
                              }}
                              className={`w-full rounded-[20px] border p-4 text-left transition-colors ${
                                isActive
                                  ? "border-amber-400/40 bg-amber-400/10"
                                  : "border-white/10 bg-white/5 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-semibold text-white">{zone.name}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                                    {zone.id}
                                  </p>
                                </div>
                                <div className="min-w-[96px] rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-white/60">
                                  {ticketType?.name ?? "Chưa gán"}
                                </div>
                              </div>

                              {ticketType ? (
                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/68">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                    {formatCurrency(ticketType.price)}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                    Còn {ticketType.availableQuantity}
                                  </span>
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/60">
                          Chưa có khu vực nào được cấu hình cho sơ đồ này.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </div>

              <aside className="space-y-6">
                <article className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                      <Ticket size={22} className="text-white/85" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">Chọn vé</h3>
                      <p className="text-sm text-white/60">Chọn số lượng trong giới hạn cho phép và tồn kho hiện có.</p>
                    </div>
                  </div>

                  {selectedTicketType ? (
                    <div className="mt-5 space-y-4">
                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Loại vé</p>
                        <p className="mt-2 text-lg font-semibold text-white">{selectedTicketType.name}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            {formatCurrency(selectedTicketType.price)}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            Max/user {selectedTicketType.maxPerUser}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                            Còn {selectedTicketType.availableQuantity}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Đã mua</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{selectedSummary?.paid ?? 0}</p>
                          <p className="mt-1 text-xs text-white/55">Từ các đơn đã thanh toán</p>
                        </div>
                        <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Đang giữ</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{selectedSummary?.held ?? 0}</p>
                          <p className="mt-1 text-xs text-white/55">Đơn chờ thanh toán</p>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-white">Số lượng</span>
                          <span className="text-xs text-white/55">Tối đa còn mua: {maxSelectable}</span>
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentReviewHref(null);
                              setQuantity((current) => Math.max(1, current - 1));
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={maxSelectable || 1}
                            value={displayQuantity}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              if (Number.isNaN(nextValue)) {
                                return;
                              }

                              const clamped = Math.max(1, Math.min(nextValue, Math.max(1, maxSelectable || 1)));
                              setPaymentReviewHref(null);
                              setQuantity(clamped);
                            }}
                            className="h-11 w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 text-center text-base font-semibold text-white outline-none ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentReviewHref(null);
                              setQuantity((current) => Math.min(Math.max(1, maxSelectable || 1), current + 1));
                            }}
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                          >
                            +
                          </button>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-white/55">
                          {userLimit === 0
                            ? "Bạn đã chạm giới hạn mua hoặc ticket type đã hết."
                            : `Bạn còn có thể mua thêm ${userLimit} vé ở ticket type này.`}
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-white/65">Tổng tiền</span>
                          <span className="text-xl font-semibold text-white">
                            {formatCurrency(selectedTicketType.price * displayQuantity)}
                          </span>
                        </div>
                      </div>

                      {selectedZone ? (
                        <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                          <p className="font-semibold">Zone đang chọn: {selectedZone.name}</p>
                          <p className="mt-1 text-amber-100/75">
                            {selectedZone.ticketTypeId ? "Zone này đã được gán loại vé." : "Zone chưa được gán."}
                          </p>
                        </div>
                      ) : null}

                      {submitError.length > 0 ? (
                        <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                          <p className="font-semibold">Lỗi</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {submitError.map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {submitSuccess ? (
                        <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                          {submitSuccess}
                        </div>
                      ) : null}

                      {paymentReviewHref ? (
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
                          <p className="font-semibold text-white">Không nhận được payment URL từ backend.</p>
                          <p className="mt-2">Bạn vẫn có thể kiểm tra trạng thái order thật trên trang return.</p>
                          <Link
                            href={paymentReviewHref}
                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
                          >
                            Mở payment return
                          </Link>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void handleCreateOrder()}
                        disabled={isSubmitting || maxSelectable < 1 || quantity > maxSelectable}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmitting ? <ArrowClockwise size={16} className="animate-spin" /> : null}
                        {isSubmitting ? "Đang giữ vé..." : "Giữ vé"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/60">
                      Chưa có loại vé khả dụng. Vui lòng chờ admin cấu hình thêm.
                    </div>
                  )}
                </article>

                <article className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <h3 className="text-xl font-semibold text-white">Số lượng vé còn lại</h3>
                  <p className="mt-2 text-sm text-white/60">Thông tin này được cập nhật theo dữ liệu mới nhất.</p>

                  <div className="mt-5 space-y-3">
                    {ticketTypes.length ? (
                      ticketTypes.map((ticketType) => {
                        const summary = summarizeByTicketType(orders, tickets, ticketType.id);
                        const remainingForYou = Math.max(0, ticketType.maxPerUser - summary.paid - summary.held);
                        const isSelected = ticketType.id === selectedTicketTypeId;

                        return (
                          <button
                            key={ticketType.id}
                            type="button"
                            onClick={() => {
                              setPaymentReviewHref(null);
                              setSelectedTicketTypeId(ticketType.id);
                            }}
                            className={`w-full rounded-[20px] border p-4 text-left transition-colors ${
                              isSelected
                                ? "border-emerald-400/30 bg-emerald-400/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-white">{ticketType.name}</p>
                                <p className="mt-1 text-xs text-white/50">
                                  {ticketType.status === "AVAILABLE" ? "Còn vé" : "Hết vé"}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-white">{formatCurrency(ticketType.price)}</p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Còn {ticketType.availableQuantity}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Đã mua {summary.paid}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Đang giữ {summary.held}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Tối đa còn {remainingForYou}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-5 text-sm text-white/60">
                        API chưa trả ticket type availability cho concert này.
                      </div>
                    )}
                  </div>
                </article>
              </aside>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
