import { Ticket } from "@phosphor-icons/react";

type LogoProps = {
  variant?: "admin" | "audience" | "mobile";
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 font-black tracking-tighter text-2xl text-primary ${className}`}>
      <Ticket weight="fill" style={{ width: "32px", height: "32px", flexShrink: 0 }} />
      <span className="leading-none">TicketBox</span>
    </div>
  );
}
