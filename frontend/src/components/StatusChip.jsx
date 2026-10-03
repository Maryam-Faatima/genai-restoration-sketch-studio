import React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function StatusChip({ health, loading, onRefresh }) {
  if (loading && !health) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Checking backend status...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors"
        title="Click to retry health check"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span>Backend unreachable</span>
      </button>
    );
  }

  const models = health.models || {};
  const totalCount = Object.keys(models).length;
  const loadedCount = Object.values(models).filter(status => status === 'loaded').length;
  const isHealthy = health.status === 'ok' && loadedCount === totalCount && totalCount > 0;

  if (isHealthy) {
    return (
      <div 
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/80 shadow-sm"
        title="All ONNX model runtimes active and ready"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{loadedCount}/{totalCount} models loaded</span>
      </div>
    );
  }

  const failedModels = Object.entries(models)
    .filter(([_, status]) => status !== 'loaded')
    .map(([name]) => name);

  return (
    <div 
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200 shadow-sm"
      title={`Failed models: ${failedModels.join(', ')}`}
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span>
        Degraded ({loadedCount}/{totalCount}): {failedModels.join(', ')}
      </span>
    </div>
  );
}
