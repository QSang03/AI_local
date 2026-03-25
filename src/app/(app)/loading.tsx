export default function AppLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-52 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
