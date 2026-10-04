import React from 'react';
import { Clock, Signal, TrendingUp } from 'lucide-react';

export default function MetricsCards({ inferenceMs, psnr, timingMs }) {
  const hasTimingMs = timingMs && (timingMs.classifier !== undefined || timingMs.expert !== undefined);
  const hasPsnr = psnr && (psnr.restored !== undefined || psnr.input !== undefined);

  return (
    <div className="space-y-3">
      {/* Inference time */}
      {inferenceMs !== undefined && (
        <div className="rounded-2xl p-4 border border-[#2D2424]/10 bg-[#FFF7F4] flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C24B38] shrink-0" />
            <span className="text-xs uppercase tracking-wider font-bold text-[#2D2424]">Inference Speed</span>
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-base font-bold text-[#2D2424] font-mono">{Math.round(inferenceMs)} ms</span>
            {hasTimingMs && (
              <div className="text-[10px] text-[#7C6F6F] font-mono">
                <span>Classifier: {Math.round(timingMs.classifier ?? 0)} ms</span>
                <span className="mx-1 text-[#2D2424]/20">·</span>
                <span>Expert: {Math.round(timingMs.expert ?? 0)} ms</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PSNR */}
      {hasPsnr ? (
        <div className="rounded-2xl p-4 border border-[#2D2424]/10 bg-[#FFF7F4] space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-[#C24B38] shrink-0" />
            <span className="text-xs uppercase tracking-wider font-bold text-[#2D2424]">PSNR Fidelity Rating</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {psnr.input !== undefined && (
              <div className="rounded-xl p-3 border border-[#2D2424]/10 bg-white text-center">
                <div className="text-[10px] uppercase font-bold text-[#7C6F6F] tracking-wide mb-0.5">Input Image</div>
                <div className="text-lg font-bold text-[#2D2424] font-mono">
                  {psnr.input?.toFixed(2)} <span className="text-xs text-[#7C6F6F]">dB</span>
                </div>
              </div>
            )}
            {psnr.restored !== undefined && (
              <div className="rounded-xl p-3 border border-[#2D2424]/10 bg-white text-center">
                <div className="text-[10px] uppercase font-bold text-[#7C6F6F] tracking-wide mb-0.5">Restored Output</div>
                <div className="text-lg font-bold text-[#C24B38] font-mono">
                  {psnr.restored?.toFixed(2)} <span className="text-xs text-[#7C6F6F]">dB</span>
                </div>
              </div>
            )}
          </div>
          {psnr.input !== undefined && psnr.restored !== undefined && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>+{Math.max(0, (psnr.restored - psnr.input)).toFixed(2)} dB quality improvement</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-3.5 border border-[#2D2424]/10 bg-[#FFF7F4] flex items-center gap-2 shadow-xs">
          <Signal className="w-4 h-4 text-[#7C6F6F]/60 shrink-0" />
          <p className="text-xs text-[#7C6F6F] italic">
            PSNR unavailable (no clean reference for an uploaded image)
          </p>
        </div>
      )}
    </div>
  );
}
