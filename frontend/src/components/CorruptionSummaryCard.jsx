import React from 'react';
import { Sliders, Info } from 'lucide-react';

export default function CorruptionSummaryCard({ corruption }) {
  if (!corruption || Object.keys(corruption).length === 0) return null;

  // Format key and value for clean rendering
  const formatLabel = (key) => {
    switch (key) {
      case 'type': return 'Corruption Type';
      case 'severity': return 'Severity Level';
      case 'seed': return 'RNG Seed';
      case 'probability': return 'Noise Probability (p)';
      case 'kernel': return 'Kernel Size';
      case 'sigma': return 'Gaussian Sigma';
      case 'rectangles': return 'Occlusion Blocks (n)';
      case 'target_area': return 'Target Area Fraction';
      case 'actual_area': return 'Actual Coverage Area';
      case 'boxes': return 'Bounding Boxes';
      case 'note': return 'Note';
      default: return key.replace(/_/g, ' ');
    }
  };

  const formatValue = (key, val) => {
    if (key === 'boxes' && Array.isArray(val)) {
      return `${val.length} rectangle(s): [${val.map(b => `[${b.join(',')}]`).join(', ')}]`;
    }
    if (typeof val === 'number') {
      return Number.isInteger(val) ? val.toString() : val.toFixed(4);
    }
    return String(val);
  };

  return (
    <div className="bg-purple-50/40 rounded-xl p-3.5 border border-purple-100 text-xs w-full space-y-2">
      <div className="flex items-center gap-1.5 font-semibold text-purple-950 uppercase tracking-wide text-[11px]">
        <Sliders className="w-3.5 h-3.5 text-purple-600" />
        <span>Applied Corruption Settings</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-1 border-t border-purple-100">
        {Object.entries(corruption).map(([key, val]) => (
          <div key={key} className="flex justify-between items-baseline gap-2 py-0.5 border-b border-purple-50 sm:border-0">
            <span className="text-purple-700/80 capitalize font-medium">{formatLabel(key)}:</span>
            <span className="font-semibold text-studio-purple-950 font-mono text-[11px] truncate max-w-[200px]" title={String(val)}>
              {formatValue(key, val)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
