"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from 'next/image';
import { ChannelConfig } from "@/types/domain";
import { deleteChannelConfig, saveChannelConfig, startZaloQrLogin, startWhatsAppQrLogin } from "@/lib/api";

interface ChannelConfigFormProps {
  configs: ChannelConfig[];
}

const ZALO_PROVIDER = "zalo_personal";
const WHATSAPP_PROVIDER = "whatsapp_personal";
type ChannelProvider = "email" | typeof ZALO_PROVIDER | typeof WHATSAPP_PROVIDER;

export function ChannelConfigForm({ configs }: ChannelConfigFormProps) {
  const [localConfigs, setLocalConfigs] = useState<ChannelConfig[]>(configs);
  const [provider, setProvider] = useState<ChannelProvider>("email");
  const [server, setServer] = useState("192.168.117.200:143");
  const [password, setPassword] = useState("");
  const [useTls, setUseTls] = useState(false);
  const [serverLocked, setServerLocked] = useState(true);
  const [tlsLocked, setTlsLocked] = useState(true);
  const [statusMessage, setStatusMessage] = useState("San sang tao channel.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [zaloChannelId, setZaloChannelId] = useState("");
  const [startingZaloLogin, setStartingZaloLogin] = useState(false);
  const [zaloStatus, setZaloStatus] = useState("Chua khoi tao dang nhap Zalo.");
  const [zaloError, setZaloError] = useState<string | null>(null);
  const [zaloQrImage, setZaloQrImage] = useState<string | null>(null);
  const [showZaloQr, setShowZaloQr] = useState(false);
  const [zaloLoginSuccess, setZaloLoginSuccess] = useState(false);
  
  const [whatsappChannelId, setWhatsappChannelId] = useState("");
  const [startingWhatsappLogin, setStartingWhatsappLogin] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState("Chua khoi tao dang nhap WhatsApp.");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappQrImage, setWhatsappQrImage] = useState<string | null>(null);
  const [whatsappQrText, setWhatsappQrText] = useState<string | null>(null);
  const [showWhatsappQr, setShowWhatsappQr] = useState(false);
  const [whatsappLoginSuccess, setWhatsappLoginSuccess] = useState(false);
  const whatsappCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);

  const hintByChannel: Record<ChannelProvider, string> = {
    email: "Email can server, password va tuy chon TLS.",
    zalo_personal: "Tao channel Zalo Personal, sau do bat dau dang nhap QR.",
    whatsapp_personal: "Tao channel WhatsApp Personal, sau do bat dau dang nhap QR.",
  };

  const existingProviders = new Set(localConfigs.map((c) => String(c.provider)));
  const zaloConfigs = useMemo(
    () => localConfigs.filter((config) => String(config.provider).toLowerCase().includes("zalo")),
    [localConfigs],
  );
  const hasZaloChannel = zaloConfigs.length > 0;
  
  const whatsappConfigs = useMemo(
    () => localConfigs.filter((config) => String(config.provider).toLowerCase().includes("whatsapp")),
    [localConfigs],
  );
  const hasWhatsappChannel = whatsappConfigs.length > 0;

  function normalizeQrSource(rawQr: string) {
    let sanitized = String(rawQr || "").trim();

    // Nếu bao quanh bằng dấu nháy (đôi hoặc đơn), loại bỏ.
    if ((sanitized.startsWith('"') && sanitized.endsWith('"')) || (sanitized.startsWith("'") && sanitized.endsWith("'"))) {
      sanitized = sanitized.slice(1, -1).trim();
    }

    if (!sanitized) return "";

    // Nếu đã là Data URL chuẩn
    if (sanitized.startsWith("data:")) {
      return sanitized;
    }

    // Nếu URI http(s)
    if (/^https?:\/\//i.test(sanitized)) {
      return sanitized;
    }

    // Có thể backend trả raw base64 (không có tiền tố data:)
    if (/^[A-Za-z0-9+/=\s]+$/.test(sanitized)) {
      sanitized = sanitized.replace(/\s+/g, "");
      return `data:image/png;base64,${sanitized}`;
    }

    // fallback: giữ nguyên
    return sanitized;
  }

  type WebSocketPayload = {
    type?: string;
    data?: string;
    qr_base64?: string;
    qr?: string;
    qrcode?: string;
    code?: string;
    message?: string;
    error?: string;
  };

  function tryParseSocketPayload(eventData: unknown) {
    const rawText = typeof eventData === "string" ? eventData.trim() : "";
    if (!rawText) {
      return { rawText: "", data: null as null | WebSocketPayload };
    }

    try {
      const parsed = JSON.parse(rawText) as WebSocketPayload;
      return { rawText, data: parsed };
    } catch {
      return { rawText, data: null as null | WebSocketPayload };
    }
  }

  function resolveZaloWsUrl(rawUrl: string) {
    const wsOverride = process.env.NEXT_PUBLIC_ZALO_LOGIN_WS_BASE_URL?.trim();

    try {
      const source = new URL(rawUrl);
      const isLocalHost = source.hostname === "localhost" || source.hostname === "127.0.0.1";

      // Only override if backend returned localhost AND env override is set
      if (isLocalHost && wsOverride) {
        const base = new URL(wsOverride);
        base.pathname = source.pathname;
        base.search = source.search;
        return base.toString();
      }

      // If localhost but no env override, try API base URL or window hostname
      if (isLocalHost) {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
        if (apiBase) {
          const api = new URL(apiBase);
          source.hostname = api.hostname;
          if (!source.port && api.port) {
            source.port = api.port;
          }
        } else if (typeof window !== "undefined") {
          source.hostname = window.location.hostname;
        }

        if (typeof window !== "undefined" && window.location.protocol === "https:") {
          source.protocol = "wss:";
        }
      }

      return source.toString();
    } catch {
      return rawUrl;
    }
  }

  const closeProviderSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  type ProviderWsConfig = {
    providerName: string;
    setStatus: React.Dispatch<React.SetStateAction<string>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    setLoginSuccess: React.Dispatch<React.SetStateAction<boolean>>;
    setShowQr: React.Dispatch<React.SetStateAction<boolean>>;
    setQrImage: React.Dispatch<React.SetStateAction<string | null>>;
    setQrText?: React.Dispatch<React.SetStateAction<string | null>>;
    setStartingLogin: React.Dispatch<React.SetStateAction<boolean>>;
  };

  function connectProviderSocket(url: string, config: ProviderWsConfig) {
    closeProviderSocket();

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      config.setStatus(`Da ket noi ${config.providerName} WebSocket. Dang cho QR...`);
    };

    ws.onmessage = (event) => {
      const { rawText, data } = tryParseSocketPayload(event.data);
      const eventType = data?.type ?? rawText;

      if (eventType === "qr_update") {
        const rawQr = data?.data || data?.qr || data?.qr_base64 || data?.qrcode || data?.code || "";
        if (!rawQr) return;

        // Nếu là data URL hoặc raw base64 -> ảnh (Zalo/WhatsApp trực tiếp)
        if (rawQr.trim().startsWith("data:") || /^[A-Za-z0-9+/=]+$/.test(rawQr.trim())) {
          config.setQrImage(normalizeQrSource(rawQr));
          config.setQrText?.(null);
        } else {
          // nếu là text cần decode QR (WhatsApp flow)
          config.setQrText?.(rawQr);
          config.setQrImage(null);
        }

        config.setShowQr(true);
        config.setStatus(`Vui long quet QR bang ung dung ${config.providerName}.`);
        config.setError(null);
        return;
      }

      if (!data && rawText && rawText !== "login_success" && rawText !== "login_failed") {
        config.setQrText?.(rawText);
        config.setQrImage(null);
        config.setShowQr(true);
        config.setStatus(`Vui long quet QR bang ung dung ${config.providerName}.`);
        config.setError(null);
        return;
      }

      if (eventType === "login_success") {
        config.setStatus(`Dang nhap ${config.providerName} thanh cong.`);
        config.setError(null);
        config.setStartingLogin(false);
        config.setLoginSuccess(true);
        config.setShowQr(false);
        closeProviderSocket();
        return;
      }

      if (eventType === "login_failed") {
        const payload = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
        config.setError(
          (payload.error as string | undefined) ?? (payload.message as string | undefined) ?? "Dang nhap that bai. Vui long thu lai."
        );
        config.setStatus(`Dang nhap ${config.providerName} that bai.`);
        config.setStartingLogin(false);
        closeProviderSocket();
      }
    };

    ws.onerror = () => {
      config.setError(`Khong ket noi duoc WebSocket cua ${config.providerName} login.`);
      config.setStatus("Loi ket noi WebSocket.");
      config.setStartingLogin(false);
    };

    ws.onclose = () => {
      wsRef.current = null;
      config.setStartingLogin(false);
    };
  }

  function connectZaloSocket(url: string) {
    connectProviderSocket(url, {
      providerName: "Zalo",
      setStatus: setZaloStatus,
      setError: setZaloError,
      setLoginSuccess: setZaloLoginSuccess,
      setShowQr: setShowZaloQr,
      setQrImage: setZaloQrImage,
      setStartingLogin: setStartingZaloLogin,
    });
  }

  function resolveWhatsAppWsUrl(rawUrl: string) {
    const wsOverride = process.env.NEXT_PUBLIC_WHATSAPP_LOGIN_WS_BASE_URL?.trim();

    try {
      const source = new URL(rawUrl);
      const isLocalHost = source.hostname === "localhost" || source.hostname === "127.0.0.1";

      // Only override if backend returned localhost AND env override is set
      if (isLocalHost && wsOverride) {
        const base = new URL(wsOverride);
        base.pathname = source.pathname;
        base.search = source.search;
        return base.toString();
      }

      // If localhost but no env override, try API base URL or window hostname
      if (isLocalHost) {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
        if (apiBase) {
          const api = new URL(apiBase);
          source.hostname = api.hostname;
          if (!source.port && api.port) {
            source.port = api.port;
          }
        } else if (typeof window !== "undefined") {
          source.hostname = window.location.hostname;
        }

        if (typeof window !== "undefined" && window.location.protocol === "https:") {
          source.protocol = "wss:";
        }
      }

      return source.toString();
    } catch {
      return rawUrl;
    }
  }

  const closeWhatsAppSocket = useCallback(() => {
    closeProviderSocket();
  }, [closeProviderSocket]);

  function connectWhatsAppSocket(url: string) {
    connectProviderSocket(url, {
      providerName: "WhatsApp",
      setStatus: setWhatsappStatus,
      setError: setWhatsappError,
      setLoginSuccess: setWhatsappLoginSuccess,
      setShowQr: setShowWhatsappQr,
      setQrImage: setWhatsappQrImage,
      setQrText: setWhatsappQrText,
      setStartingLogin: setStartingWhatsappLogin,
    });
  }

  useEffect(() => {
    if (existingProviders.has(provider) && provider !== ZALO_PROVIDER && provider !== WHATSAPP_PROVIDER) {
      const firstAvailable = (["email", ZALO_PROVIDER, WHATSAPP_PROVIDER] as ChannelProvider[]).find(
        (opt) => !existingProviders.has(opt),
      );
      if (firstAvailable) setProvider(firstAvailable);
    }
    // Only respond to changes in available configs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localConfigs.length]);

  useEffect(() => {
    if (provider !== ZALO_PROVIDER) {
      closeProviderSocket();
      setStartingZaloLogin(false);
      setShowZaloQr(false);
      setZaloQrImage(null);
      setZaloError(null);
      setZaloLoginSuccess(false);
      setZaloStatus("Chua khoi tao dang nhap Zalo.");
      return;
    }

    if (zaloChannelId.trim()) {
      return;
    }

    if (zaloConfigs.length > 0) {
      setZaloChannelId(String(zaloConfigs[0].id));
    }
  }, [provider, zaloChannelId, zaloConfigs, closeProviderSocket]);

  useEffect(() => {
    if (provider !== WHATSAPP_PROVIDER) {
      closeWhatsAppSocket();
      setStartingWhatsappLogin(false);
      setShowWhatsappQr(false);
      setWhatsappQrImage(null);
      setWhatsappQrText(null);
      setWhatsappError(null);
      setWhatsappLoginSuccess(false);
      setWhatsappStatus("Chua khoi tao dang nhap WhatsApp.");
      return;
    }

    if (whatsappChannelId.trim()) {
      return;
    }

    if (whatsappConfigs.length > 0) {
      setWhatsappChannelId(String(whatsappConfigs[0].id));
    }
  }, [provider, whatsappChannelId, whatsappConfigs, closeWhatsAppSocket]);

  useEffect(() => {
    if (whatsappQrText && whatsappCanvasRef.current) {
      const renderQr = async () => {
        // sử dụng thư viện QRCode qua window.QRCode (tương tự HTML test) nếu có
        const win = window as Window & { QRCode?: { toCanvas: (canvas: HTMLCanvasElement, text: string, options?: { width: number }) => Promise<void> } };
        const canvas = whatsappCanvasRef.current;
        if (typeof window !== "undefined" && win.QRCode?.toCanvas && canvas) {
          try {
            await win.QRCode.toCanvas(canvas, whatsappQrText, { width: 256 });
            return;
          } catch (error) {
            console.error("QRCode library failed:", error);
          }
        }

        // fallback: mã QR không thể render, hiển thị text
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, 256, 256);
            ctx.fillStyle = "#000";
            ctx.font = "12px sans-serif";
            ctx.fillText(whatsappQrText, 10, 20);
          }
        }
      };

      void renderQr();
    }
  }, [whatsappQrText]);

  useEffect(() => {
    return () => {
      closeProviderSocket();
      closeWhatsAppSocket();
    };
  }, [closeProviderSocket, closeWhatsAppSocket]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (provider === "email") {
      if (server.trim().length < 3) {
        setErrorMessage("Server khong hop le.");
        return;
      }

      if (password.trim().length < 3) {
        setErrorMessage("Password khong hop le.");
        return;
      }
    }

    if (existingProviders.has(provider)) {
      setErrorMessage("Provider này đã tồn tại cho tài khoản. Vui lòng chọn loại khác.");
      return;
    }

    setSaving(true);

    const payload =
      provider === "email"
        ? {
            provider,
            auth_config: {
              server,
              password,
              use_tls: useTls,
            },
          }
        : {
            provider,
            auth_config: {},
          };

    const result = await saveChannelConfig(payload);

    if (result.ok) {
      setStatusMessage(result.message);
      if (result.channel) {
        const createdChannel = result.channel;
        setLocalConfigs((prev) => [createdChannel, ...prev.filter((item) => item.id !== createdChannel.id)]);
        if (String(createdChannel.provider).toLowerCase().includes("zalo")) {
          setZaloChannelId(String(createdChannel.id));
        }
      }
      setPassword("");
    } else {
      setErrorMessage(result.message);
    }

    setSaving(false);
  }

  async function handleStartZaloLogin(channelId?: number) {
    setZaloError(null);

    const parsedId =
      typeof channelId === "number" ? channelId : Number.parseInt(zaloChannelId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setZaloError("Channel ID Zalo khong hop le.");
      return;
    }

    setStartingZaloLogin(true);
    setShowZaloQr(false);
    setZaloQrImage(null);
    setZaloLoginSuccess(false);
    setZaloStatus("Dang tao session dang nhap...");

    const result = await startZaloQrLogin(parsedId);
    if (!result.ok || !result.data) {
      setZaloError(result.message);
      setStartingZaloLogin(false);
      setZaloStatus("Khong the bat dau dang nhap Zalo.");
      return;
    }

    setZaloStatus("Dang ket noi toi provider...");
    connectZaloSocket(resolveZaloWsUrl(result.data.ws_url));
  }

  async function handleStartWhatsAppLogin(channelId?: number) {
    setWhatsappError(null);

    const parsedId =
      typeof channelId === "number" ? channelId : Number.parseInt(whatsappChannelId, 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setWhatsappError("Channel ID WhatsApp khong hop le.");
      return;
    }

    setStartingWhatsappLogin(true);
    setShowWhatsappQr(false);
    setWhatsappQrImage(null);
    setWhatsappLoginSuccess(false);
    setWhatsappStatus("Dang tao session dang nhap...");

    const result = await startWhatsAppQrLogin(parsedId);
    if (!result.ok || !result.data) {
      setWhatsappError(result.message);
      setStartingWhatsappLogin(false);
      setWhatsappStatus("Khong the bat dau dang nhap WhatsApp.");
      return;
    }

    setWhatsappStatus("Dang ket noi toi provider...");
    connectWhatsAppSocket(resolveWhatsAppWsUrl(result.data.ws_url));
  }

  function isZaloConfig(config: ChannelConfig) {
    return String(config.provider).toLowerCase().includes("zalo");
  }

  function isWhatsAppConfig(config: ChannelConfig) {
    return String(config.provider).toLowerCase().includes("whatsapp");
  }

  async function handleLoginFromList(config: ChannelConfig) {
    if (isZaloConfig(config)) {
      setProvider(ZALO_PROVIDER);
      setZaloChannelId(String(config.id));
      await handleStartZaloLogin(config.id);
      return;
    }

    if (isWhatsAppConfig(config)) {
      setProvider(WHATSAPP_PROVIDER);
      setWhatsappChannelId(String(config.id));
      await handleStartWhatsAppLogin(config.id);
    }
  }

  async function handleDelete(id: number) {
    setErrorMessage(null);
    setDeletingId(id);

    const result = await deleteChannelConfig(id);
    if (result.ok) {
      setLocalConfigs((prev) => prev.filter((item) => item.id !== id));
      setStatusMessage(result.message);
    } else {
      setErrorMessage(result.message);
    }

    setDeletingId(null);
  }

  function readAuthConfig(config: ChannelConfig) {
    const authConfig = config.auth_config as {
      server?: string;
      use_tls?: boolean;
    };

    return {
      server: authConfig.server ?? "(khong co)",
      useTls: Boolean(authConfig.use_tls),
    };
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Tao channel</h2>
        <p className="text-sm text-slate-600">{hintByChannel[provider]}</p>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Provider</span>
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as ChannelProvider)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
          >
            {(["email", ZALO_PROVIDER, WHATSAPP_PROVIDER] as ChannelProvider[]).map((item) => (
              <option key={item} value={item} disabled={existingProviders.has(item) && item !== provider}>
                {item.toUpperCase()} {existingProviders.has(item) ? "(đã thêm)" : ""}
              </option>
            ))}
          </select>
        </label>

        {provider === "email" ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Mail server</span>
            <div className="flex items-center gap-2">
              <input
                value={server}
                onChange={(event) => setServer(event.target.value)}
                placeholder="192.168.117.200:143"
                disabled={serverLocked}
                className={`flex-1 rounded-xl border px-3 py-2 outline-none ${serverLocked ? "border-slate-200 bg-slate-50" : "border-slate-300 focus:border-slate-700 bg-white"}`}
              />
              <button
                type="button"
                onClick={() => setServerLocked((s) => !s)}
                title={serverLocked ? "Mở khoá để sửa" : "Khóa lại"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50"
              >
                {serverLocked ? "🔒" : "🔓"}
              </button>
            </div>
          </label>
        ) : null}

        {provider === "email" ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="your-password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
              />
            </label>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={useTls}
                  onChange={(event) => setUseTls(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  disabled={tlsLocked}
                />
                Su dung TLS
              </label>
              <button
                type="button"
                onClick={() => setTlsLocked((s) => !s)}
                title={tlsLocked ? "Mở khoá TLS" : "Khóa TLS"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm hover:bg-slate-50"
              >
                {tlsLocked ? "🔒" : "🔓"}
              </button>
            </div>
          </>
        ) : null}

        {provider !== ZALO_PROVIDER || !hasZaloChannel ? (
          <button
            type="submit"
            disabled={saving}
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Dang tao..." : provider === ZALO_PROVIDER ? "Tao channel Zalo" : "Tao channel"}
          </button>
        ) : (
          <p className="text-sm text-emerald-700">Da tao channel Zalo. Sang buoc Login de lay QR.</p>
        )}

        <p className="text-sm text-slate-600">{statusMessage}</p>
        {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}

        {provider === ZALO_PROVIDER ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-800">Zalo QR Login</h3>
            <p className="mt-1 text-xs text-slate-500">
              Buoc 1: Tao channel Zalo. Buoc 2: Bam Login de ket noi WebSocket ngam. Buoc 3: UI hien ma QR de quet.
            </p>

            {hasZaloChannel ? (
              <p className="mt-2 text-sm text-slate-700">
                Channel dang dung: <span className="font-semibold">#{zaloChannelId || zaloConfigs[0].id}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Can tao channel Zalo truoc khi login.</p>
            )}

            {zaloConfigs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {zaloConfigs.map((config) => (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => setZaloChannelId(String(config.id))}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Chon #{config.id}
                  </button>
                ))}
              </div>
            ) : null}

            {zaloLoginSuccess ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-sm font-medium text-green-700">Da ket noi Zalo</span>
                <button
                  type="button"
                  onClick={() => {
                    setZaloLoginSuccess(false);
                    setZaloStatus("Chua khoi tao dang nhap Zalo.");
                  }}
                  className="ml-auto text-xs text-green-600 hover:text-green-700 underline"
                >
                  Ngan ket noi
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleStartZaloLogin()}
                disabled={startingZaloLogin || !hasZaloChannel}
                className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {startingZaloLogin ? "Dang Login..." : "Login Zalo"}
              </button>
            )}

            <p className="mt-2 text-xs text-slate-600">{zaloStatus}</p>
            {zaloError ? <p className="mt-1 text-xs text-rose-700">{zaloError}</p> : null}

            {showZaloQr ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-center">
                {zaloQrImage ? (
                  <Image
                    src={zaloQrImage}
                    alt="Zalo QR"
                    width={208}
                    height={208}
                    className="mx-auto h-52 w-52 rounded-lg border border-slate-100 object-contain"
                  />
                ) : (
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500">
                    Dang cho QR tu WebSocket...
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {provider === WHATSAPP_PROVIDER ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-sm font-semibold text-slate-800">WhatsApp QR Login</h3>
            <p className="mt-1 text-xs text-slate-500">
              Buoc 1: Tao channel WhatsApp. Buoc 2: Bam Login de ket noi WebSocket ngam. Buoc 3: UI hien ma QR de quet.
            </p>

            {hasWhatsappChannel ? (
              <p className="mt-2 text-sm text-slate-700">
                Channel dang dung: <span className="font-semibold">#{whatsappChannelId || whatsappConfigs[0].id}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-700">Can tao channel WhatsApp truoc khi login.</p>
            )}

            {whatsappConfigs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {whatsappConfigs.map((config) => (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => setWhatsappChannelId(String(config.id))}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                  >
                    Chon #{config.id}
                  </button>
                ))}
              </div>
            ) : null}

            {whatsappLoginSuccess ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-sm font-medium text-green-700">Da ket noi WhatsApp</span>
                <button
                  type="button"
                  onClick={() => {
                    setWhatsappLoginSuccess(false);
                    setWhatsappStatus("Chua khoi tao dang nhap WhatsApp.");
                  }}
                  className="ml-auto text-xs text-green-600 hover:text-green-700 underline"
                >
                  Ngan ket noi
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleStartWhatsAppLogin()}
                disabled={startingWhatsappLogin || !hasWhatsappChannel}
                className="mt-3 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {startingWhatsappLogin ? "Dang Login..." : "Login WhatsApp"}
              </button>
            )}

            <p className="mt-2 text-xs text-slate-600">{whatsappStatus}</p>
            {whatsappError ? <p className="mt-1 text-xs text-rose-700">{whatsappError}</p> : null}

            {showWhatsappQr ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-center">
                {whatsappQrImage ? (
                  <Image
                    src={whatsappQrImage}
                    alt="WhatsApp QR"
                    width={208}
                    height={208}
                    className="mx-auto h-52 w-52 rounded-lg border border-slate-100 object-contain"
                  />
                ) : whatsappQrText ? (
                  <canvas
                    ref={whatsappCanvasRef}
                    width={256}
                    height={256}
                    className="mx-auto h-52 w-52 rounded-lg border border-slate-100"
                  />
                ) : (
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500">
                    Dang cho QR tu WebSocket...
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Danh sach channel</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {localConfigs.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-slate-500">
              Chua co channel nao.
            </li>
          ) : null}
          {localConfigs.map((config) => {
            const auth = readAuthConfig(config);
            return (
              <li
                key={config.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <p className="font-semibold text-slate-800">#{config.id} - {String(config.provider).toUpperCase()}</p>
                <p className="text-slate-600">Status: {config.status}</p>
                 {String(config.provider).toLowerCase() === "email" ? (
                   <p className="mt-1 text-xs text-slate-500">
                     Server: {auth.server} | TLS: {auth.useTls ? "true" : "false"}
                   </p>
                 ) : null}
                 <p className="mt-1 text-xs text-slate-500">Created: {config.created_at}</p>
                 <div className="mt-2 flex flex-wrap items-center gap-2">
                   {isZaloConfig(config) ? (
                     <button
                       type="button"
                       onClick={() => void handleLoginFromList(config)}
                       disabled={startingZaloLogin}
                       className="inline-flex rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                     >
                       {startingZaloLogin && Number(zaloChannelId) === config.id ? "Dang Login..." : "Login"}
                     </button>
                   ) : null}
                   {isWhatsAppConfig(config) ? (
                     <button
                       type="button"
                       onClick={() => void handleLoginFromList(config)}
                       disabled={startingWhatsappLogin}
                       className="inline-flex rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                     >
                       {startingWhatsappLogin && Number(whatsappChannelId) === config.id ? "Dang Login..." : "Login"}
                     </button>
                   ) : null}
                   <button
                     type="button"
                     onClick={() => handleDelete(config.id)}
                     disabled={deletingId === config.id}
                     className="inline-flex rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                   >
                     {deletingId === config.id ? "Dang xoa..." : "Xoa"}
                   </button>
                 </div>
               </li>
             );
           })}
        </ul>
      </section>
    </div>
  );
}
