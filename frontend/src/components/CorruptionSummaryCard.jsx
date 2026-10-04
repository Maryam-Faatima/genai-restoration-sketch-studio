import React from 'react';
import { Sliders } from 'lucide-react';

export default function CorruptionSummaryCard({ corruption }) {
  if (!corruption || Object.keys(corruption).length === 0) return null;

  const renderValue = (val) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(4);
    if (Array.isArray(val)) return JSON.stringify(val);
    if (typeof val === 'object') return JSON.stringify(val);
    return val.toString();
  };

  const formatKey = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const entries = Object.entries(corruption);

  return (
    <div className="rounded-2xl p-4 border border-[#2D2424]/10 bg-[#FFF7F4] space-y-3 shadow-xs">
      <div className="flex items-center gap-2">
        <Sliders className="w-4 h-4 text-[#C24B38] shrink-0" />
        <span className="text-xs uppercase tracking-wider font-bold text-[#2D2424]">Applied Corruption Details</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl p-2.5 border border-[#2D2424]/10 bg-white"
          >
            <div className="text-[10px] uppercase font-bold text-[#7C6F6F] tracking-wide truncate">
              {formatKey(k)}
            </div>
            <div className="text-xs font-bold text-[#2D2424] font-mono truncate" title={renderValue(v)}>
              {renderValue(v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
