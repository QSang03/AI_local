"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
      <h2 className="text-lg font-bold text-rose-900">Da xay ra loi tren giao dien</h2>
      <p className="mt-2 text-sm text-rose-700">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
      >
        Thu tai lai
      </button>
    </div>
  );
}
