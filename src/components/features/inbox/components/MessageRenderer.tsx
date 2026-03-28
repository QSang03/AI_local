import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { getAccessToken } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";

interface MessageRendererProps {
  content: string;
  bodyHtml?: string;
  mediaUrls?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  // New prop to inform parent if this message is purely media
  onMediaOnlyChange?: (isMediaOnly: boolean) => void;
}

/**
 * Helper function as guided by the user image
 * SYNC: Updated to use NEXT_PUBLIC_API_BASE_URL or NEXT_PUBLIC_API_URL
 */
export function getFileUrl(fileId: string) {
  if (!fileId) return "";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";
  const cleanedBase = apiBase.replace(/\/$/, "");
  const filePath = cleanedBase.endsWith('/api') ? `/files/${fileId}/view?redirect=true` : `/api/files/${fileId}/view?redirect=true`;
  return `${cleanedBase}${filePath}`;
}

/**
 * Authenticated Download Helper
 */
async function downloadAuthenticatedFile(url: string, filename: string) {
  try {
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Download error:", err);
    window.open(url, "_blank"); // Fallback
  }
}

/**
 * ProtectedImage component that handles Authorization headers
 */
function ProtectedImage({ src, alt }: { src: string, alt?: string }) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (!src) return;
    
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchWithAuth = async () => {
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(src, { headers, signal: controller.signal });
        if (!response.ok) throw new Error("Load failed");

        const blob = await response.blob();
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void fetchWithAuth();

    return () => {
      isMounted = false;
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (error) return <div className="text-[10px] text-slate-400 p-2 italic bg-slate-50 rounded-lg">{alt || "Lỗi tải ảnh"}</div>;
  if (loading) return <div className="w-48 h-32 animate-pulse bg-slate-100 rounded-2xl" />;

  return (
    <>
      <div className="block w-full max-w-full overflow-hidden my-0">
        <button 
          onClick={() => setIsPreviewOpen(true)}
          className="block w-fit cursor-zoom-in hover:opacity-95 transition-opacity active:scale-[0.98]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={blobUrl || ""} 
            alt={alt || ""} 
            className="max-w-full h-auto max-h-[300px] object-contain rounded-2xl shadow-sm border border-slate-100" 
          />
        </button>
      </div>

      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full"
            >
              <img 
                src={blobUrl || ""} 
                alt={alt || ""} 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 p-2 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * FilePreviewModal: Unified preview for PDF, MD, Audio, and Office summary
 */
function FilePreviewModal({ src, name, onClose }: { src: string, name: string, onClose: () => void }) {
  const [content, setContent] = React.useState<string | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const ext = (name || "").split('.').pop()?.toLowerCase() || "";
  const isMD = ext === 'md';
  const isPDF = ext === 'pdf';
  const isAudio = ['mp3', 'wav', 'm4a'].includes(ext);
  const isOffice = ['docx', 'doc', 'xlsx', 'xls', 'csv'].includes(ext);

  React.useEffect(() => {
    let currentUrl: string | null = null;
    const loadContent = async () => {
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        if (isMD) {
          const response = await fetch(src, { headers });
          const text = await response.text();
          setContent(text);
        } else if (isPDF || isAudio || isOffice) {
          const response = await fetch(src, { headers });
          const blob = await response.blob();
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        }
      } catch (err) {
        console.error("Preview error:", err);
      } finally {
        setLoading(false);
      }
    };
    void loadContent();
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [src, isMD, isPDF, isAudio, isOffice]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }}
        className={`bg-white w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden ${isAudio ? 'max-w-md h-auto py-4' : 'max-w-4xl h-[85vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-800 truncate max-w-md">{name}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-slate-50/20">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50 py-20">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" />
              <span className="text-sm font-medium">Đang nạp dữ liệu...</span>
            </div>
          ) : isPDF && blobUrl ? (
            <iframe src={`${blobUrl}#toolbar=0`} className="w-full h-full rounded shadow-sm border border-slate-200 bg-white" />
          ) : isMD ? (
            <div className="prose prose-sm max-w-full w-full bg-white p-6 rounded shadow-sm border border-slate-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ""}</ReactMarkdown>
            </div>
          ) : isAudio && blobUrl ? (
            <div className="w-full px-4 text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center text-white mx-auto shadow-lg mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <audio src={blobUrl} controls autoPlay className="w-full" />
              <button 
                onClick={() => downloadAuthenticatedFile(src, name)}
                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700 transition active:scale-95"
              >
                Tải về để xem lâu dài
              </button>
            </div>
          ) : isOffice ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-10 bg-white rounded-xl shadow-inner border border-slate-200/50">
               <div className={`w-24 h-28 rounded-xl flex flex-col items-center justify-center text-white font-bold text-2xl uppercase shadow-xl mb-8 ${isOffice && (ext.includes('x') || ext.includes('xls')) ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                {ext.includes('x') || ext.includes('xls') ? 'X' : 'W'}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">{name}</h2>
              <p className="text-slate-500 max-w-md mb-8">
                Tệp tin này hiện không thể xem trực tiếp hoàn toàn trong trình duyệt do yêu cầu xác thực bảo mật cao. 
              </p>
              <button 
                onClick={() => downloadAuthenticatedFile(src, name)}
                className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                Tải xuống và Mở tệp tin
              </button>
            </div>
          ) : (
            <div className="text-slate-500 italic">Định dạng file không hỗ trợ xem trước.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * ShadowContent: Isolates Email CSS using Shadow DOM
 */
function ShadowContent({ html }: { html: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      container.innerHTML = "";
      const shadowRoot = container.shadowRoot || container.attachShadow({ mode: "open" });
      
      const wrapper = document.createElement("div");
      wrapper.className = "prose prose-sm max-w-full text-slate-700 leading-relaxed overflow-x-auto break-words";
      wrapper.style.color = "#334155";
      wrapper.style.fontFamily = "inherit";
      wrapper.innerHTML = html;
      
      shadowRoot.innerHTML = "";
      shadowRoot.appendChild(wrapper);
    }
  }, [html]);

  return <div ref={containerRef} className="w-full overflow-hidden" />;
}

/**
 * Modern FileCardRenderer: Visual parity with Image 17
 */
function FileCardRenderer({ src, name }: { src: string, name: string }) {
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  
  const cleanName = (name || "").replace(/^zalo-\d+-/gi, "");
  const ext = cleanName.split('.').pop()?.toLowerCase() || "";
  const isZippable = ['zip', 'rar', '7z'].includes(ext);
  const isOffice = ['docx', 'doc', 'xlsx', 'xls', 'csv'].includes(ext);
  // Only allow preview for formats that natively render well in our modal
  const canPreview = ['pdf', 'md', 'mp3', 'wav', 'm4a'].includes(ext);
  
  let iconBg = "bg-slate-400";
  let iconLabel = "FILE";
  let iconSvg = null;

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    iconBg = "bg-emerald-600";
    iconLabel = "X";
  } else if (['docx', 'doc'].includes(ext)) {
    iconBg = "bg-blue-600";
    iconLabel = "W";
  } else if (ext === 'pdf') {
    iconBg = "bg-rose-500";
    iconLabel = "PDF";
  } else if (ext === 'md') {
    iconBg = "bg-sky-500";
    iconLabel = "MD";
  } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
    iconBg = "bg-indigo-500";
    iconLabel = "";
    iconSvg = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    );
  } else if (isZippable) {
    iconBg = "bg-purple-500";
    iconLabel = "";
    iconSvg = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2v20"/><path d="M14 2v20"/><path d="M15 4h-2"/><path d="M15 8h-2"/><path d="M15 12h-2"/><path d="M15 16h-2"/><path d="M15 20h-2"/><path d="M11 6h-2"/><path d="M11 10h-2"/><path d="M11 14h-2"/><path d="M11 18h-2"/>
      </svg>
    );
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    void downloadAuthenticatedFile(src, cleanName);
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-[#f0f5ff] border border-blue-50/50 rounded-xl w-full max-w-sm hover:bg-[#eaf1ff] transition-all group my-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        {/* File Icon */}
        <div className={`w-10 h-11 ${iconBg} rounded-lg flex flex-col items-center justify-center text-white font-bold text-[10px] uppercase shadow-sm shrink-0`}>
          {iconSvg || <span>{iconLabel}</span>}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="text-sm font-semibold text-slate-900 truncate pr-2" title={cleanName}>
            {cleanName || "Tên tệp tin"}
          </div>
          <div className="text-[11px] text-blue-600 font-medium flex items-center gap-2">
            <span>{/* Placeholder size */} 46.2 KB</span>
            <span className="flex items-center gap-1 opacity-80">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Tải về để xem lâu dài
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {canPreview && (
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95"
              title="Xem trước"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          )}
          <button 
            onClick={handleDownload}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all active:scale-95"
            title="Tải xuống"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isPreviewOpen && <FilePreviewModal src={src} name={cleanName} onClose={() => setIsPreviewOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

const tagRegexGlobal = /\[(file|image|video|audio):([^:\]]+)(?::([^\]]+))?\]/gi;

export function MessageRenderer({ content, bodyHtml, mediaUrls, isExpanded, onToggleExpand, onMediaOnlyChange }: MessageRendererProps) {
  // 1. Email HTML content with Attachment Scan & CSS Isolation
  if (bodyHtml && bodyHtml.trim()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => { onMediaOnlyChange?.(false); }, [onMediaOnlyChange]);
    
    let html = bodyHtml;

    // FIX v19: Pre-process the HTML to cleanly replace <img ... [tag] ... > with a Placeholder
    const placeholderRegex = /<img\s+[^>]*?\[(file|image|video|audio):([^:\]]+)(?::([^\]]+))?\][^>]*?>/gi;
    html = html.replace(placeholderRegex, (match, type, id, name) => {
      return `__MEDIA_TAG__${type}!!${id}!!${name || "Media"}__`;
    });

    // Also catch any tags NOT inside an <img> tag
    html = html.replace(tagRegexGlobal, (match, type, id, name) => {
      if (match.startsWith('__MEDIA_TAG__')) return match;
      return `__MEDIA_TAG__${type}!!${id}!!${name || "Media"}__`;
    });

    const segments = html.split(/(__MEDIA_TAG__.*?__)/g);
    const parts: React.ReactNode[] = [];

    segments.forEach((seg, idx) => {
      if (seg.startsWith('__MEDIA_TAG__')) {
        const payload = seg.replace('__MEDIA_TAG__', '').replace('__', '');
        const [type, id, name] = payload.split('!!');
        const url = getFileUrl(id);
        const isVisual = type === 'image' || type === 'video' || /\.(jpg|jpeg|png|gif|webp|bmp)(?:@|\?|$)/i.test(name || '');
        
        if (isVisual) {
          parts.push(<ProtectedImage key={`media-${idx}`} src={url} alt={name} />);
        } else {
          parts.push(<FileCardRenderer key={`media-${idx}`} src={url} name={name || "Tập tin"} />);
        }
      } else if (seg.trim().length > 0) {
        parts.push(<ShadowContent key={`shadow-${idx}`} html={seg} />);
      }
    });

    return (
      <div className="flex flex-col gap-2 w-full max-w-full overflow-hidden break-words text-slate-800">
        {parts.length > 0 ? parts : (
          <ShadowContent html={bodyHtml} />
        )}
      </div>
    );
  }

  // 2. ONE-STOP PARSING LOGIC for regular messages
  const unifiedMedia: { idOrUrl: string, name: string, type: string, isFromTag: boolean }[] = [];
  const currentContent = (content || "").trim();
  let cleanText = currentContent;
  
  let match;
  tagRegexGlobal.lastIndex = 0;
  while ((match = tagRegexGlobal.exec(currentContent)) !== null) {
    const [fullTag, type, id, name] = match;
    unifiedMedia.push({ idOrUrl: id, name: name || "Media", type, isFromTag: true });
    cleanText = cleanText.replace(fullTag, "").trim();
  }

  if (unifiedMedia.length === 0 && mediaUrls && mediaUrls.length > 0) {
    mediaUrls.forEach((url, i) => {
      const isImg = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url) || url.includes('image');
      unifiedMedia.push({ idOrUrl: url, name: `File #${i+1}`, type: isImg ? 'image' : 'file', isFromTag: false });
    });
  }

  const isMediaOnly = cleanText.trim().length === 0 && unifiedMedia.length > 0;
  
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const lastEmittedValue = React.useRef<boolean | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (lastEmittedValue.current !== isMediaOnly) {
      onMediaOnlyChange?.(isMediaOnly);
      lastEmittedValue.current = isMediaOnly;
    }
  }, [isMediaOnly, onMediaOnlyChange]);

  const isLong = cleanText.length > 1000;
  const displayText = (!isExpanded && isLong) ? cleanText.slice(0, 1000) + "..." : cleanText;

  return (
    <div className="flex flex-col gap-1 w-full min-w-0 max-w-full overflow-hidden break-words">
      {displayText && displayText.trim().length > 0 && (
        <div className="prose prose-sm max-w-full text-slate-800 leading-normal break-words overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {displayText}
          </ReactMarkdown>
        </div>
      )}
      
      {isLong && onToggleExpand && (
        <button 
          onClick={onToggleExpand} 
          className="text-[11px] font-bold text-indigo-600 hover:underline self-start mt-1"
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}

      {unifiedMedia.length > 0 && (
        <div className={`${cleanText.trim().length > 0 ? 'mt-0' : ''} space-y-0.5 flex flex-col items-start w-full`}>
          {unifiedMedia.map((item, i) => {
            const finalUrl = getFileUrl(item.idOrUrl);
            const isVisual = item.type === 'image' || item.type === 'video' || /\.(jpg|jpeg|png|gif|webp|bmp)(?:@|\?|$)/i.test(item.name || '');
            
            if (isVisual) {
              return <ProtectedImage key={`media-${i}`} src={finalUrl} alt={item.name} />;
            }
            return <FileCardRenderer key={`media-${i}`} src={finalUrl} name={item.name} />;
          })}
        </div>
      )}
    </div>
  );
}

export function formatRelativeTime(dateString: string) {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return formatDistanceToNow(d, { addSuffix: true, locale: vi });
  } catch {
    return dateString;
  }
}
