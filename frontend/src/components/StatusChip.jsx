import React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function StatusChip({ health, loading, onRefresh }) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#382521]/15 bg-white/60 text-[#715A54] text-xs font-mono">
        <RefreshCw className="w-3 h-3 animate-spin text-[#715A54]" />
        <span className="tracking-wider uppercase text-[10px]">Checking models...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <button
        onClick={onRefresh}
        title="Click to recheck health"
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-rose-300 bg-rose-50 text-rose-800 text-xs font-mono hover:bg-rose-100 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        <span className="font-bold tracking-wider uppercase text-[10px]">Backend Offline</span>
      </button>
    );
  }

  const models = health.models || {};
  const totalModels = Object.keys(models).length;
  const loadedModels = Object.values(models).filter((s) => s === 'loaded').length;
  const isHealthy = health.status === 'ok' && loadedModels === totalModels;

  const failedModels = Object.entries(models)
    .filter(([_, status]) => status !== 'loaded')
    .map(([name]) => name);

  if (isHealthy) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-[#382521]/20 bg-white/70 text-[#241715] text-xs font-mono"
        title="All models successfully loaded and ready for ONNX inference"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="font-bold tracking-widest text-[10px] uppercase">
          {loadedModels}/{totalModels} Models Loaded
        </span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-3.5 py-1.5 border border-amber-300 bg-amber-50/90 text-amber-900 text-xs font-mono"
      title={`Degraded models: ${failedModels.join(', ')}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span className="font-bold tracking-wider uppercase text-[10px]">
        Degraded ({loadedModels}/{totalModels})
      </span>
      {failedModels.length > 0 && (
        <span className="text-[9px] text-amber-700 hidden sm:inline">
          [{failedModels.join(', ')}]
        </span>
      )}
    </div>
  );
}
