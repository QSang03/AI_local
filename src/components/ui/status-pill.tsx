interface StatusPillProps {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

const toneMap: Record<StatusPillProps["tone"], string> = {
  neutral: "bg-slate-200/80 text-slate-700",
  success: "bg-emerald-200/90 text-emerald-800",
  warning: "bg-amber-200/90 text-amber-900",
  danger: "bg-rose-200/90 text-rose-900",
};

export function StatusPill({ label, tone }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${toneMap[tone]}`}
    >
      {label}
    </span>
  );
}
