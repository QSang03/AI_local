"use client";

import { useEffect, useState } from "react";
import { ChannelConfigForm } from "@/components/features/channels/channel-config-form";
import { PageHeader } from "@/components/ui/page-header";
import { getChannelConfigs } from "@/lib/api";
import { ChannelConfig } from "@/types/domain";

export default function ChannelsPage() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getChannelConfigs();
        if (!mounted) return;
        setConfigs(data ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Khong tai duoc configs.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Config Channel"
        subtitle="Quan ly channel qua backend /channels: xem danh sach, tao moi va xoa channel."
      />
      {loading ? <p className="text-sm text-slate-500">Dang tai configs...</p> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {!loading && !error ? <ChannelConfigForm configs={configs} /> : null}
    </div>
  );
}
