import React, { useState } from 'react';
import { Network, Sliders, ChevronDown, ChevronUp, Download, RefreshCw } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import MetricsCards from '../components/MetricsCards';
import CorruptionSummaryCard from '../components/CorruptionSummaryCard';
import { postSoft } from '../api';

const CORRUPTION_OPTIONS = [
  { value: 'uploaded', label: 'Use image as uploaded (already corrupted)' },
  { value: 'clean', label: 'Clean (None)' },
  { value: 'salt_pepper', label: 'Salt-and-pepper noise' },
  { value: 'blur', label: 'Gaussian blur' },
  { value: 'occlusion', label: 'Rectangular occlusion' },
];

const BRANCH_LABELS = {
  identity: 'Identity Bypass',
  salt_pepper: 'Salt-and-Pepper Specialist',
  blur: 'Gaussian Blur Specialist',
  occlusion: 'Occlusion Inpainter',
};

const BRANCH_COLORS = {
  identity: 'bg-[#B5D3CA]',
  salt_pepper: 'bg-[#FDC7BD]',
  blur: 'bg-[#E8A735]',
  occlusion: 'bg-[#C24B38]',
};

export default function SoftMoEWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [corruption, setCorruption] = useState('uploaded');
  const [severity, setSeverity] = useState('medium');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [result, setResult] = useState(null);

  const handleImageSelected = (file) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setResult(null);
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      onError('Please select or upload an image first.');
      return;
    }
    if (abortController) abortController.abort();
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    onError(null);

    try {
      const data = await postSoft({
        imageFile: selectedFile,
        corruption,
        severity,
        seed: seed.trim() !== '' ? parseInt(seed, 10) : null,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Soft-MoE restoration failed.');
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const weights = result?.weights || {};
  const branches = ['identity', 'salt_pepper', 'blur', 'occlusion'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl mx-auto">
      {/* Left Column: Controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-3 shadow-scafos">
          <div className="flex items-center justify-between">
            <span className="font-handwriting text-3xl text-[#C24B38]">studio 03</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-[#E8A735]/40 bg-[#E8A735]/20 text-[#734A05]">
              MoE Ensemble
            </span>
          </div>
          <h2 className="text-2xl font-serif font-black text-[#2D2424] uppercase tracking-tight">
            Soft Mixture-of-Experts
          </h2>
          <p className="text-xs text-[#7C6F6F] leading-relaxed">
            Continuous softmax gating dynamically blends predictions across 4 parallel pathways.
          </p>

          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF7F4] border border-[#2D2424]/10 text-xs text-[#2D2424]">
            <span className="font-mono font-bold text-[#C24B38]">T = 1.26</span>
            <span className="text-[#7C6F6F]">· Gate temperature (fixed)</span>
          </div>
        </div>

        <ImagePicker
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          onImageSelected={handleImageSelected}
          onError={onError}
          samples={samples}
          sampleType="pet"
          disabled={loading}
          customTitle="Upload or Select Pet Image"
        />

        {/* Corruption Settings */}
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-4 shadow-scafos">
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-[#2D2424] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C24B38]" />
            Corruption Settings
          </h3>
          <div>
            <label htmlFor="soft-corruption-type" className="block text-xs uppercase tracking-wider font-bold text-[#7C6F6F] mb-1.5">
              Corruption Type
            </label>
            <select
              id="soft-corruption-type"
              value={corruption}
              onChange={(e) => setCorruption(e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium border border-[#2D2424]/15 bg-[#FFF7F4] rounded-xl px-3 py-2.5 text-[#2D2424] focus:outline-none focus:border-[#C24B38]"
            >
              {CORRUPTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {corruption !== 'uploaded' && corruption !== 'clean' && (
            <div>
              <label className="block text-xs uppercase tracking-wider font-bold text-[#7C6F6F] mb-1.5">
                Severity Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['low', 'medium', 'high'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    disabled={loading}
                    className={`py-2 text-xs uppercase tracking-widest font-bold capitalize rounded-xl transition-all border ${
                      severity === lvl
                        ? 'border-[#C24B38] bg-[#C24B38] text-white shadow-xs'
                        : 'border-[#2D2424]/10 bg-[#FFF7F4] text-[#7C6F6F] hover:text-[#2D2424]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-5 shadow-scafos">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-bold text-[#2D2424]"
          >
            <span>Advanced Seed Configuration</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4 text-[#C24B38]" /> : <ChevronDown className="w-4 h-4 text-[#7C6F6F]" />}
          </button>
          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-[#2D2424]/10 space-y-2">
              <label htmlFor="soft-seed" className="block text-xs uppercase tracking-wider font-medium text-[#7C6F6F]">
                Random Seed (Empty = Random)
              </label>
              <input
                id="soft-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. 42"
                disabled={loading}
                className="w-full text-xs font-mono border border-[#2D2424]/15 bg-[#FFF7F4] rounded-xl px-3 py-2 text-[#2D2424] focus:outline-none focus:border-[#C24B38]"
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || !selectedFile}
          className="w-full py-4 px-6 rounded-2xl bg-[#C24B38] hover:bg-[#A63827] text-white text-xs uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Blending Neural Experts...</span>
            </>
          ) : (
            <>
              <Network className="w-4 h-4" />
              <span>Blend Experts & Restore</span>
            </>
          )}
        </button>
      </div>

      {/* Right Column: Results */}
      <div className="lg:col-span-7">
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-8 flex flex-col items-center justify-center min-h-[500px] shadow-scafos">
          {!result && !loading && (
            <div className="text-center py-20 px-4 space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#F8E7E3] border border-[#C24B38]/30 flex items-center justify-center mx-auto text-[#C24B38]">
                <Network className="w-7 h-7" />
              </div>
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">smooth gating</span>
              <h4 className="text-lg font-serif font-black text-[#2D2424] uppercase">
                Choose an image to begin
              </h4>
              <p className="text-xs text-[#7C6F6F] leading-relaxed">
                Watch learned softmax gating weights continuously blend across 4 restoration pathways with transparent dominant indicators.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-24 space-y-4">
              <RefreshCw className="w-10 h-10 text-[#C24B38] animate-spin mx-auto" />
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">blending predictions</span>
              <p className="text-sm font-serif font-bold uppercase tracking-widest text-[#2D2424]">
                Running Mixture-of-Experts Gating...
              </p>
              <p className="text-xs text-[#7C6F6F]">
                Computing softmax gating weights at calibrated temperature T = 1.26
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-6">
              {/* Routing Weights Card */}
              <div className="rounded-2xl border border-[#2D2424]/10 bg-[#FFF7F4] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#2D2424]/10 pb-3">
                  <h4 className="text-xs font-serif font-bold uppercase tracking-wider text-[#2D2424]">
                    Continuous Routing Weights
                  </h4>
                  <span className="text-[10px] font-mono text-[#7C6F6F]">100% Normalized</span>
                </div>

                {/* Stacked bar */}
                <div className="h-3 w-full bg-white rounded-full overflow-hidden flex border border-[#2D2424]/10">
                  {branches.map((br) => {
                    const w = (weights[br] || 0) * 100;
                    return w > 0.5 ? (
                      <div
                        key={br}
                        className={`h-full ${BRANCH_COLORS[br]}`}
                        style={{ width: `${w}%` }}
                        title={`${BRANCH_LABELS[br]}: ${w.toFixed(1)}%`}
                      />
                    ) : null;
                  })}
                </div>

                <div className="space-y-3 pt-2">
                  {branches.map((br) => {
                    const w = weights[br] || 0;
                    const isDominant = result.dominant === br;
                    const isContributing = result.contributing?.includes(br);
                    return (
                      <div key={br} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#2D2424] flex items-center gap-2">
                            <span>{BRANCH_LABELS[br]}</span>
                            {isDominant && (
                              <span className="px-2 py-0.5 rounded-full bg-[#C24B38] text-white text-[9px] uppercase font-mono font-bold">
                                Dominant
                              </span>
                            )}
                            {!isDominant && isContributing && (
                              <span className="px-2 py-0.5 rounded-full border border-[#2D2424]/20 bg-white text-[9px] font-mono font-bold text-[#7C6F6F]">
                                Contributing
                              </span>
                            )}
                          </span>
                          <span className="font-mono font-bold text-[#2D2424]">
                            {(w * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-[#2D2424]/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDominant ? 'bg-[#C24B38]' : BRANCH_COLORS[br]
                            }`}
                            style={{ width: `${Math.min(100, w * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-Side Images */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase tracking-widest font-mono text-[#7C6F6F] block">
                  MoE Blended Output
                </span>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Input Image', result.input],
                    ['Restored Output', result.restored],
                  ].map(([label, src]) => (
                    <div key={label} className="rounded-2xl border border-[#2D2424]/10 bg-white p-3 space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#7C6F6F] block text-center">
                        {label}
                      </span>
                      <div className="aspect-square w-full bg-[#FFF7F4] rounded-xl overflow-hidden flex items-center justify-center border border-[#2D2424]/10">
                        <img
                          src={src}
                          alt={label}
                          className="w-full h-full object-contain"
                          style={{ imageRendering: 'auto' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <MetricsCards inferenceMs={result.inference_ms} psnr={result.psnr} />
              <CorruptionSummaryCard corruption={result.corruption} />

              <a
                href={result.restored}
                download="soft_moe_restored.png"
                className="w-full py-4 px-6 rounded-2xl bg-[#FFF7F4] border-2 border-[#C24B38] hover:bg-[#C24B38] hover:text-white text-[#C24B38] text-xs uppercase tracking-widest font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Restored Image (PNG)</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
