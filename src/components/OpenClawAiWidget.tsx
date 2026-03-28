'use client';

import React, { useEffect, useState } from 'react';
import { Server, Power, Loader2, ChevronDown, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { useAiStore } from '../store/useAiStore';
import { motion, AnimatePresence } from 'framer-motion';

interface OpenClawAiWidgetProps {
  className?: string;
}

export default function OpenClawAiWidget({ className }: OpenClawAiWidgetProps) {
  const { aiStatus, wakingUp, connectWs, wakeupSession } = useAiStore();
  const [isHovered, setIsHovered] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Connect WebSocket and get cleanup fn
    const cleanup = connectWs();
    
    // Load persisted position
    try {
      const saved = localStorage.getItem('ai_widget_pos');
      if (saved) {
        setDragPosition(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load AI widget position', e);
    }
    setIsInitialized(true);
    
    return cleanup;
  }, [connectWs]);

  const handleDragEnd = (_: any, info: { offset: { x: number; y: number } }) => {
    const newPos = {
      x: dragPosition.x + info.offset.x,
      y: dragPosition.y + info.offset.y
    };
    setDragPosition(newPos);
    localStorage.setItem('ai_widget_pos', JSON.stringify(newPos));
  };

  const isReady = aiStatus === 'ready';
  const isStarting = aiStatus === 'starting' || wakingUp;
  const showButton = (aiStatus === 'stopped' || aiStatus === 'not_exists' || aiStatus === 'error') && !wakingUp;

  let statusText = '';
  let dotColor = 'bg-gray-400';
  let statusIcon = <Server size={14} />;

  switch (aiStatus) {
    case 'loading':
      statusText = 'Đang kiểm tra kết nối...';
      dotColor = 'bg-gray-400';
      statusIcon = <Loader2 size={14} className="animate-spin text-slate-400" />;
      break;
    case 'ready':
      statusText = 'AI Container: Sẵn sàng';
      dotColor = 'bg-emerald-500';
      statusIcon = <CheckCircle2 size={14} className="text-emerald-500" />;
      break;
    case 'starting':
      statusText = wakingUp ? 'Đang gửi lệnh khởi động...' : 'Đang khởi động...';
      dotColor = 'bg-amber-500';
      statusIcon = <Loader2 size={14} className="animate-spin text-amber-500" />;
      break;
    case 'stopped':
      statusText = 'AI Container: Tạm ngưng';
      dotColor = 'bg-slate-400';
      statusIcon = <PlayCircle size={14} className="text-slate-400" />;
      break;
    case 'not_exists':
      statusText = 'AI Container: Chưa tạo';
      dotColor = 'bg-slate-300';
      statusIcon = <AlertCircle size={14} className="text-slate-400" />;
      break;
    case 'error':
      statusText = 'AI Container: Lỗi kết nối';
      dotColor = 'bg-rose-500';
      statusIcon = <AlertCircle size={14} className="text-rose-500" />;
      break;
  }

  if (!isInitialized) return null;

  return (
    <motion.div 
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      initial={dragPosition}
      animate={{
        x: dragPosition.x - (parseInt(typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--ai-widget-offset') || '0' : '0')),
        y: dragPosition.y
      }}
      className={`fixed bottom-3 right-6 z-[9999] cursor-grab active:cursor-grabbing ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative">
        {/* Compact Trigger Area */}
        <div className="flex items-center gap-2 p-1.5 pr-3 bg-white border border-slate-200 rounded-full shadow-lg shadow-slate-200/50 hover:border-indigo-300 transition-all">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
              <Server size={16} />
            </div>
            {/* Dot Indicator */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${dotColor} ${isStarting ? 'animate-pulse' : ''}`} />
          </div>
          
          <div className="flex items-center gap-1 overflow-hidden">
             <span className="text-[11px] font-bold text-slate-700 tracking-tight whitespace-nowrap">AI Status</span>
             <ChevronDown size={12} className={`text-slate-400 transition-transform flex-shrink-0 ${isHovered ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Popover */}
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full right-0 mb-3 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-4 overflow-hidden"
            >
              <div className="flex items-start gap-3">
                 <div className="mt-0.5">
                    {statusIcon}
                 </div>
                 <div className="flex-1">
                    <h4 className="text-[13px] font-bold text-slate-900 mb-0.5">OpenClaw AI Container</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                       {statusText}
                    </p>
                 </div>
              </div>

              {showButton && (
                <div className="mt-4 pt-3 border-t border-slate-50">
                  <button
                    onClick={wakeupSession}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-xl text-[12px] font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98]"
                  >
                    <Power size={14} />
                    Bật kết nối AI
                  </button>
                </div>
              )}
              
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-medium bg-slate-50 -mx-4 -mb-4 px-4 py-2 border-t border-slate-100">
                 <span>v1.2.4</span>
                 <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> API Connected</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
