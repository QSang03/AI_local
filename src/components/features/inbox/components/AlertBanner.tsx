import { AlertTriangle, X } from "lucide-react";

interface AlertBannerProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
  onClose?: () => void;
}

export function AlertBanner({ message, actionText, onAction, onClose }: AlertBannerProps) {
  return (
    <div className="mx-6 mt-4 -mb-2 z-10">
      <div className="bg-[#FFFBEB] border border-amber-300 rounded-lg p-3 flex items-start sm:items-center gap-3 shadow-sm">
        <div className="shrink-0 mt-0.5 sm:mt-0">
          <AlertTriangle size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 text-[13px] text-amber-800 font-medium">
          {message}
          {actionText && (
            <button
              onClick={onAction}
              className="ml-2 underline font-semibold text-amber-900 hover:text-black transition"
            >
              {actionText}
            </button>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-amber-500 hover:text-amber-800 rounded-md transition hover:bg-amber-100 shrink-0"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
