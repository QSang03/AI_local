'use client';

import React, { useEffect } from 'react';
import { Server, Power, Loader2 } from 'lucide-react';
import { useAiStore } from '../store/useAiStore';

export default function OpenClawAiWidget() {
  const { aiStatus, wakingUp, connectWs, wakeupSession } = useAiStore();

  useEffect(() => {
    // Connect WebSocket and get cleanup fn
    const cleanup = connectWs();
    return cleanup;
  }, [connectWs]);

  const isReady = aiStatus === 'ready';
  const isStarting = aiStatus === 'starting' || wakingUp;
  const showButton = (aiStatus === 'stopped' || aiStatus === 'not_exists' || aiStatus === 'error') && !wakingUp;

  let statusText = '';
  let statusColor = 'text-gray-500';
  switch (aiStatus) {
    case 'loading':
      statusText = 'Đang kiểm tra kết nối...';
      statusColor = 'text-gray-500';
      break;
    case 'ready':
      statusText = 'Đã kết nối và sẵn sàng';
      statusColor = 'text-emerald-600';
      break;
    case 'starting':
      statusText = wakingUp ? 'Đang gửi lệnh khởi động...' : 'Đang khởi động...';
      statusColor = 'text-amber-600';
      break;
    case 'stopped':
      statusText = 'Hệ thống đang tạm ngưng';
      statusColor = 'text-gray-500';
      break;
    case 'not_exists':
      statusText = 'Container chưa được tạo';
      statusColor = 'text-gray-500';
      break;
    case 'error':
      statusText = 'Lỗi kết nối';
      statusColor = 'text-rose-600';
      break;
  }

  const iconBg = isReady
    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
    : isStarting
    ? 'bg-amber-50 text-amber-600 border-amber-100'
    : aiStatus === 'error'
    ? 'bg-rose-50 text-rose-600 border-rose-100'
    : 'bg-gray-50 text-gray-400 border-gray-200';

  return (
    <div className="fixed top-6 right-6 z-[999]">
      <div className="flex items-center gap-3 p-2 md:pr-3 md:pl-2 bg-white/80 backdrop-blur-md shadow-lg border border-gray-100 rounded-full transition-all duration-300">

        <div className="flex items-center gap-3 pl-1">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full shadow-inner border transition-colors duration-300 ${iconBg}`}>
            {aiStatus === 'loading' || isStarting
              ? <Loader2 size={18} className="animate-spin" />
              : <Server size={18} />
            }
          </div>

          <div className="hidden md:block pr-2">
            <h3 className="text-sm font-semibold text-gray-800 leading-tight">
              OpenClaw AI Container
            </h3>
            <p className={`text-xs font-medium ${statusColor}`}>
              {statusText}
            </p>
          </div>
        </div>

        {showButton && (
          <button
            onClick={wakeupSession}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all duration-300 shadow-sm bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md"
          >
            <Power size={16} />
            <span className="hidden md:inline">Bật kết nối AI</span>
          </button>
        )}
      </div>
    </div>
  );
}
