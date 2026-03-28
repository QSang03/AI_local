import { Mailbox } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] h-full text-slate-400">
      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 border border-slate-100">
        <Mailbox size={32} className="text-violet-400" />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-800 mb-1">
        Chọn một hội thoại để bắt đầu
      </h3>
      <p className="text-[13px] text-slate-500 max-w-[250px] text-center mb-6">
        Bạn có thể xem nội dung, phản hồi hoặc gán hội thoại vào Project.
      </p>
      <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
          lên/xuống để chọn
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
          enter để mở
        </span>
      </div>
    </div>
  );
}
