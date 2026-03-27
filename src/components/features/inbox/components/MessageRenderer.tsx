import React, { useState, useEffect } from "react";
import { ExternalLink, FileText, Download, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { apiClient } from "@/lib/api-client";

interface MessageRendererProps {
  content: string;
  bodyHtml?: string;
  mediaUrls?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function getFileUrl(fileId: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "";
  const base = apiBase.replace(/\/$/, "");
  const path = base.endsWith('/api') ? `/files/${fileId}/view?redirect=true` : `/api/files/${fileId}/view?redirect=true`;
  return `${base}${path}`;
}

function ResolvedMediaItem({ type, url: initialUrl, name }: { type: string, url?: string, name: string }) {
  const [url, setUrl] = useState<string | undefined>(initialUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!initialUrl || !initialUrl.startsWith("http")) {
      setLoading(false);
      return;
    }

    // Nếu link là định dạng file nội bộ của backend OpenClaw
    if (initialUrl.includes("/api/files/") && initialUrl.includes("/view")) {
      // Force redirect=false để backend trả về JSON chứa link thay vì tự động 302 redirect
      let fetchUrl = initialUrl;
      if (fetchUrl.includes("redirect=")) {
        fetchUrl = fetchUrl.replace(/redirect=(true|false)/, "redirect=false");
      } else {
        fetchUrl += fetchUrl.includes("?") ? "&redirect=false" : "?redirect=false";
      }
      
      apiClient.get(fetchUrl)
        .then(res => {
          if (mounted && res.data && res.data.url) {
            setUrl(res.data.url);
          }
        })
        .catch(err => {
          console.error("Failed to fetch secure file view:", err);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      // Xử lý các link redirect ngoài khác (ex: zalo, bit.ly,...)
      fetch(`/api/resolve-link?url=${encodeURIComponent(initialUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (mounted && data.url) {
            setUrl(data.url);
          }
        })
        .catch((err) => {
          console.error("Failed to resolve link:", err);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }

    return () => { mounted = false; };
  }, [initialUrl]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 w-full max-w-[240px] bg-slate-50 border border-slate-200 rounded-xl">
        <Loader2 className="animate-spin text-slate-400" size={20} />
        <span className="text-[13px] text-slate-500 font-medium truncate">Đang tải {type}...</span>
      </div>
    );
  }

  if (type === 'image' && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-[240px] overflow-hidden rounded-xl border border-slate-200 hover:opacity-90 transition-opacity bg-slate-50 relative group">
        <img src={url} alt={name} className="w-full h-auto max-h-48 object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ExternalLink className="text-white drop-shadow-md" size={24} />
        </div>
      </a>
    );
  }
  
  if (type === 'video' && url) {
    return (
      <div className="block max-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-black">
        <video src={url} controls className="w-full max-h-48" preload="metadata" />
      </div>
    );
  }

  // Render file or link (or fallback for image/video without visual support)
  const isLink = type === 'link';
  return (
    <a 
      href={url} 
      target={url ? "_blank" : undefined} 
      rel="noreferrer" 
      className="flex items-center gap-3 p-2 w-full max-w-[280px] bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-white hover:shadow-sm rounded-xl transition group"
      title={name}
    >
      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
        {isLink ? <ExternalLink size={20} /> : <FileText size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
          {name}
        </div>
        {url && (
          <div className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
            <span>{isLink ? 'Mở liên kết' : 'Tải xuống'}</span>
            {isLink ? <ExternalLink size={12} /> : <Download size={12} />}
          </div>
        )}
      </div>
    </a>
  );
}

function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    // Remove only script, meta, link, head, title (but keep <style> in <body>)
    doc.querySelectorAll("script, meta, link, head, title").forEach(el => el.remove());

    // Remove event handlers, but KEEP style and class for original email CSS
    doc.body.querySelectorAll("*").forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
      });
    });

    // Constrain images and tables so they cannot break the layout
    doc.body.querySelectorAll('img').forEach(img => {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      // Add a small inline style so large email images won't overflow, but don't overwrite existing style
      const prevStyle = img.getAttribute('style') || '';
      img.setAttribute('style', prevStyle + ';max-width:100% !important; height:auto !important; display:block;');
    });

    doc.body.querySelectorAll('table').forEach(tbl => {
      // Make tables scrollable instead of expanding the layout, but don't overwrite existing style
      const prevStyle = tbl.getAttribute('style') || '';
      tbl.setAttribute('style', prevStyle + ';max-width:100% !important; display:block; overflow-x:auto;');
    });

    // Prepend a small safe CSS to further enforce constraints, but allow original <style> to work
    const safetyCss = `\n<style>
      img{max-width:100% !important; height:auto !important; display:block;}
      table{max-width:100% !important; display:block; overflow-x:auto;}
      *{box-sizing:border-box; overflow-wrap:anywhere; word-break:break-word;}
      pre,code{white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word;}
    </style>\n`;

    // Lấy inner body hoặc toàn bộ html nếu body empty
    const bodyHtml = doc.body?.innerHTML?.trim() || doc.documentElement?.innerHTML?.trim() || "";
    return safetyCss + bodyHtml;
  } catch {
    return "";
  }
}

export function MessageRenderer({ content, bodyHtml, mediaUrls, isExpanded, onToggleExpand }: MessageRendererProps) {
  // Email HTML content (priority over pure text)
  if (bodyHtml && bodyHtml.trim()) {
    const safeHtml = sanitizeEmailHtml(bodyHtml);
    return (
      <div
        className="prose max-w-full text-sm text-slate-700 overflow-hidden break-words [overflow-wrap:anywhere] [&_*]:max-w-full"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  // Check if JSON
  if (content.startsWith("{") && content.endsWith("}")) {
    try {
      const parsed = JSON.parse(content);
      // Attempt to discover format
      const isZaloOa = parsed.action || parsed.template_type;
      
      const title = parsed.title || parsed.text || parsed.message || "Tin nhắn đa phương tiện";
      const attachment = parsed.attachment || parsed.data_url || "";
      
      return (
        <div className="space-y-2">
          <div className="text-sm text-slate-800 font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {title}
          </div>
          {attachment && (
            <div className="mt-2 p-2 border border-slate-200 rounded-md bg-white text-xs text-sky-600 truncate flex items-center gap-1 max-w-[200px] overflow-hidden">
              <ExternalLink size={14} className="shrink-0" />
              <a href={attachment} target="_blank" rel="noreferrer" className="hover:underline truncate">
                Đính kèm
              </a>
            </div>
          )}
        </div>
      );
    } catch {
      // JSON parse failed, fallback
    }
  }

  // URL
  if (content.startsWith("http://") || content.startsWith("https://")) {
    return (
      <a href={content} target="_blank" rel="noreferrer" className="inline-flex max-w-full min-w-0 items-center gap-1 py-1 px-3 bg-white border border-slate-200 rounded-full text-sm text-sky-600 hover:bg-slate-50 transition shadow-sm">
        <ExternalLink size={14} />
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{content}</span>
      </a>
    );
  }

  // Reaction
  if (content === "[Cảm xúc]") {
    return (
      <span className="inline-flex items-center justify-center px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
        👍 Cảm xúc
      </span>
    );
  }

  // Check for specialized [tag] lines (e.g. [image], [file], [link], [video])
  const lines = content.trim().split('\n');
  const parsedLines = lines.map(line => {
    // Old format
    const match = line.trim().match(/^\[(image|file|video|link)\]\s+(.+?)(?:\s+-\s+(https?:\/\/[^\s]+))?$/i);
    if (match) {
      return {
        isTag: true,
        type: match[1].toLowerCase(),
        name: match[2].trim(),
        url: match[3] || (match[2].startsWith('http') ? match[2].trim() : undefined),
        original: line
      };
    }
    
    // New format: [file:id:name]
    const newMatch = line.trim().match(/^\[(file|image|video|link):([^:]+):(.+)\]$/i);
    if (newMatch) {
      let type = newMatch[1].toLowerCase();
      const fileId = newMatch[2];
      const name = newMatch[3];
      
      if (type === 'file') {
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(name)) type = 'image';
        else if (/\.(mp4|webm|ogg|mov)$/i.test(name)) type = 'video';
      }
      
      return {
        isTag: true,
        type,
        name,
        url: getFileUrl(fileId),
        original: line
      };
    }

    return { isTag: false, text: line };
  });

  const hasTags = parsedLines.some(p => p.isTag);

  if (hasTags) {
    return (
      <div className="space-y-2 flex flex-col items-start min-w-0 max-w-full">
        {parsedLines.map((p, i) => {
          if (!p.isTag) {
            return (
              <div key={i} className="text-sm text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
                {p.text}
              </div>
            );
          }

          return <ResolvedMediaItem key={i} type={p.type!} url={p.url} name={p.name!} />;
        })}
      </div>
    );
  }

  // Plain Text
  const isLong = content.length > 300 || lines.length > 4;
  const displayContent = (!isExpanded && isLong) ? content.slice(0, 300) + "..." : content;

  return (
    <div className="space-y-1 min-w-0 max-w-full">
      {displayContent && (
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
          {displayContent}
        </div>
      )}
      {isLong && onToggleExpand && (
        <button
          onClick={onToggleExpand}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
      {mediaUrls && mediaUrls.length > 0 && !hasTags && (
        <div className="mt-2 space-y-2 flex flex-col items-start min-w-0 max-w-full">
          {mediaUrls.map((url, i) => (
            <ResolvedMediaItem key={i} type="image" url={url} name={`Image ${i + 1}`} />
          ))}
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
