

interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-slate-600 md:text-base">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        {action ? <div>{action}</div> : null}
      </div>
    </header>
  );
}
