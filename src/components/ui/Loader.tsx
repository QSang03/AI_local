"use client";

export function Loader() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="flex items-center space-x-2 rounded-md bg-white/90 px-4 py-3 shadow">
        <svg className="h-5 w-5 animate-spin text-slate-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <span className="text-sm font-medium text-slate-800">Đang lưu...</span>
      </div>
    </div>
  );
}

export default Loader;
