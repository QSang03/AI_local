export function ConversationListSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-3 px-3 py-3 rounded-lg border border-slate-100 bg-white">
          <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-slate-200 rounded w-2/3 animate-pulse" />
            <div className="h-2.5 bg-slate-100 rounded w-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {[1, 2, 3].map((i) => {
        const isRight = i % 2 !== 0;
        return (
          <div key={i} className={`flex gap-3 ${isRight ? "flex-row-reverse" : ""}`}>
            {!isRight && <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse shrink-0" />}
            <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
              {!isRight && <div className="h-2 w-16 bg-slate-200 rounded animate-pulse mb-1 ml-1" />}
              <div
                className={`h-[60px] w-[200px] sm:w-[350px] bg-slate-200 rounded-2xl animate-pulse ${
                  isRight ? "rounded-tr-sm bg-blue-50" : "rounded-tl-sm bg-white border border-slate-100"
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
