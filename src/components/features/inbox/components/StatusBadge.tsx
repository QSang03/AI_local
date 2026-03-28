import React from "react";

interface StatusBadgeProps {
  status: "open" | "pending" | "resolved" | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = "";
  let label = "";

  switch (status.toLowerCase()) {
    case "open":
      colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
      label = "Open";
      break;
    case "pending":
      colorClass = "bg-amber-100 text-amber-700 border-amber-200";
      label = "Pending";
      break;
    case "resolved":
    case "closed":
      colorClass = "bg-slate-100 text-slate-600 border-slate-200";
      label = "Resolved";
      break;
    default:
      colorClass = "bg-slate-100 text-slate-600 border-slate-200";
      label = status;
      break;
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass} tracking-wide uppercase shadow-sm whitespace-nowrap`}
    >
      {label}
    </span>
  );
}
