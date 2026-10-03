import React from 'react';
import { Gauge, Activity, Database, CheckCircle, XCircle } from 'lucide-react';

export default function MetricsCards({
  inferenceMs,
  psnr,
  timingMs,
  routing,
  correct,
  expert
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {/* Inference & Timing Card */}
      <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-100 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 mb-1">
          <Activity className="w-3.5 h-3.5 text-purple-600" />
          <span>PERFORMANCE</span>
        </div>
        
        {timingMs ? (
          <div>
            <div className="text-base font-bold text-studio-purple-950">
              Total {inferenceMs} ms
            </div>
            <div className="text-xs text-purple-700/90 mt-1 flex items-center gap-2">
              <span>Classifier: <strong className="text-purple-900">{timingMs.classifier} ms</strong></span>
              <span>•</span>
              <span>Expert: <strong className="text-purple-900">{timingMs.expert} ms</strong></span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-base font-bold text-studio-purple-950">
              {inferenceMs} ms <span className="text-xs font-normal text-purple-600">inference</span>
            </div>
            <div className="text-xs text-purple-600/70 mt-0.5">
              ONNX runtime execution latency
            </div>
          </div>
        )}
      </div>

      {/* PSNR Card */}
      <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-100 flex flex-col justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 mb-1">
          <Gauge className="w-3.5 h-3.5 text-purple-600" />
          <span>RESTORATION QUALITY (PSNR)</span>
        </div>

        {psnr ? (
          <div>
            <div className="text-base font-bold text-studio-purple-950 flex items-baseline gap-2">
              <span>{psnr.restored} dB</span>
              <span className={`text-xs font-medium ${psnr.restored >= psnr.input ? 'text-emerald-700' : 'text-amber-700'}`}>
                {psnr.restored >= psnr.input ? '+' : ''}
                {(psnr.restored - psnr.input).toFixed(2)} dB vs input
              </span>
            </div>
            <div className="text-xs text-purple-700/80 mt-1">
              Input: {psnr.input} dB → Restored: {psnr.restored} dB
            </div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-purple-800">
              PSNR unavailable
            </div>
            <div className="text-[11px] text-purple-600/80 mt-0.5">
              No clean reference for an uploaded image
            </div>
          </div>
        )}
      </div>

      {/* Optional routing accuracy badge if provided */}
      {correct !== undefined && correct !== null && (
        <div className="sm:col-span-2 bg-white rounded-xl p-2.5 border border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-900 font-medium">Routing Evaluation:</span>
            {correct ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Correct Route
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                <XCircle className="w-3 h-3 text-rose-600" />
                Misrouted
              </span>
            )}
          </div>
          {expert && (
            <span className="text-xs text-purple-600 truncate">
              Assigned: <strong>{expert}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
