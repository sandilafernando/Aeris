import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-primary text-primary-foreground md:size-11",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-[78%]" fill="none">
        <circle cx="22" cy="10" r="4.5" fill="var(--tertiary-container)" />
        <path
          d="M6.8 20.6a5 5 0 0 1 5.1-4.9c.7 0 1.4.1 2 .4a6.6 6.6 0 0 1 11.9 1.1 5.3 5.3 0 0 1-.6 10.5H12A5.2 5.2 0 0 1 6.8 20.6Z"
          fill="currentColor"
        />
        <path
          d="M9.3 24.4h7.1"
          stroke="currentColor"
          strokeOpacity="0.48"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Brand({ className, compact = false }) {
  return (
    <Link
      href="/"
      aria-label="Aeris home"
      className={cn("group flex items-center gap-2.5 rounded-full", className)}
    >
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && (
        <span className="hidden font-display text-[1.35rem] font-semibold tracking-[-0.045em] sm:block">
          aeris
        </span>
      )}
    </Link>
  );
}
