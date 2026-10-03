import React, { useState } from 'react';
import { Network, Sliders, ChevronDown, ChevronUp, Download, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
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
  identity: 'Identity',
  salt_pepper: 'Salt-and-pepper',
  blur: 'Blur',
  occlusion: 'Occlusion',
};

const BRANCH_COLORS = {
  identity: 'bg-indigo-400',
  salt_pepper: 'bg-pink-400',
  blur: 'bg-purple-400',
  occlusion: 'bg-rose-400',
};

export default function SoftMoEWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Settings
  const [corruption, setCorruption] = useState('uploaded');
  const [severity, setSeverity] = useState('medium');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Loading & In-flight
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Results
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('restored'); // 'restored' | 'input'

  const handleImageSelected = (file) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      onError('Please select or upload an image first.');
      return;
    }

    if (abortController) {
      abortController.abort();
    }

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-6xl mx-auto">
      {/* Left Column: Controls (lg: 5 cols) */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-gradient-to-br from-white via-purple-50/40 to-pink-50/40 rounded-2xl p-5 border border-studio-border shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100/70 text-purple-800 text-xs font-semibold">
              <Network className="w-3.5 h-3.5 text-purple-600" />
              <span>Soft Mixture-of-Experts</span>
            </div>
            {/* Read-only Gate Temperature Chip */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold">
              Gate temperature T = 1.26 (fixed)
            </span>
          </div>
          <h2 className="text-xl font-bold text-studio-purple-950">Soft Mixture-of-Experts</h2>
          <p className="text-xs text-purple-900/70 mt-1">
            A continuous gating network blends the identity branch and three restoration experts with softmax weights.
          </p>
        </div>

        {/* Image Picker */}
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

        {/* Restoration Controls */}
        <div className="bg-white rounded-2xl border border-studio-border p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-studio-purple-950 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <span>Restoration Settings</span>
            </h3>
          </div>

          {/* Corruption Dropdown */}
          <div>
            <label htmlFor="soft-corruption-dropdown" className="block text-xs font-medium text-studio-purple-900 mb-1.5">
              Corruption Type
            </label>
            <select
              id="soft-corruption-dropdown"
              value={corruption}
              onChange={(e) => setCorruption(e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-studio-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {CORRUPTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Severity (only for synthetic corruptions) */}
          {corruption !== 'uploaded' && corruption !== 'clean' && (
            <div>
              <label className="block text-xs font-medium text-studio-purple-900 mb-1.5">
                Severity
              </label>
              <div className="grid grid-cols-3 gap-2 bg-purple-50/60 p-1 rounded-xl">
                {['low', 'medium', 'high'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    disabled={loading}
                    className={`py-1.5 text-xs font-semibold capitalize rounded-lg transition-all ${
                      severity === lvl
                        ? 'bg-white text-purple-900 shadow-sm border border-purple-200/50'
                        : 'text-purple-600 hover:text-purple-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Advanced Collapsible */}
        <div className="bg-white rounded-2xl border border-studio-border p-4 shadow-card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs font-semibold text-studio-purple-900"
          >
            <span>Advanced Settings</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-purple-100 space-y-2">
              <label htmlFor="soft-seed" className="block text-xs text-purple-800">
                Random Seed (optional integer)
              </label>
              <input
                id="soft-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. 42"
                disabled={loading}
                className="w-full text-xs bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-studio-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {result && result.corruption && result.corruption.seed !== undefined && (
                <p className="text-[11px] text-purple-600">
                  Applied seed: <strong className="font-mono">{result.corruption.seed}</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || !selectedFile}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Blending expert branches...</span>
            </>
          ) : (
            <>
              <Network className="w-4 h-4" />
              <span>Restore image</span>
            </>
          )}
        </button>
      </div>

      {/* Right Column: Results (lg: 7 cols) */}
      <div className="lg:col-span-7">
        <div className="bg-white rounded-2xl border border-studio-border p-6 shadow-card flex flex-col items-center justify-center min-h-[460px] space-y-6">
          {!result && !loading && (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-16 h-16 rounded-full bg-purple-100/70 text-purple-600 flex items-center justify-center mx-auto">
                <Network className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-studio-purple-950">Choose an image to begin</h4>
              <p className="text-xs text-purple-700/70 max-w-sm mx-auto">
                Select or upload an image to see continuous gating weights and blended soft-mixture output.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-20 space-y-3">
              <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-studio-purple-950">Calculating Soft Mixture-of-Experts Gating...</p>
              <p className="text-xs text-purple-600">Evaluating continuous weights across 4 restoration pathways</p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-5">
              {/* Card 1: Routing weights */}
              <div className="bg-purple-50/40 rounded-xl p-4 border border-purple-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-studio-purple-950 text-xs uppercase tracking-wider">
                    Routing weights
                  </h4>
                  <span className="text-[11px] text-purple-600/80 font-medium">Sum: 100%</span>
                </div>

                {/* Single stacked horizontal bar showing the four weights */}
                <div className="space-y-1">
                  <div className="h-3 w-full bg-purple-100 rounded-full overflow-hidden flex shadow-inner">
                    {['identity', 'salt_pepper', 'blur', 'occlusion'].map((bKey) => {
                      const weight = result.weights ? result.weights[bKey] || 0 : 0;
                      const pct = Math.max(0, Math.min(100, weight * 100));
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={bKey}
                          className={`h-full ${BRANCH_COLORS[bKey]} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                          title={`${BRANCH_LABELS[bKey]}: ${pct.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-purple-600 px-0.5">
                    <span>Identity</span>
                    <span>Salt & Pepper</span>
                    <span>Blur</span>
                    <span>Occlusion</span>
                  </div>
                </div>

                {/* Four labelled individual bars */}
                <div className="space-y-2 pt-2 border-t border-purple-100/60">
                  {['identity', 'salt_pepper', 'blur', 'occlusion'].map((bKey) => {
                    const weight = result.weights ? result.weights[bKey] || 0 : 0;
                    const percent = (weight * 100).toFixed(1);
                    const isDominant = result.dominant === bKey;

                    return (
                      <div key={bKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-studio-purple-950 flex items-center gap-1.5">
                            <span>{BRANCH_LABELS[bKey]}</span>
                            {isDominant && (
                              <span className="px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 text-[10px] font-bold uppercase tracking-wider">
                                Dominant
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-studio-purple-900 font-mono">
                            {percent}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDominant
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                                : 'bg-purple-300'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, weight * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Contributing branches chips */}
                {result.contributing && result.contributing.length > 0 && (
                  <div className="pt-2 border-t border-purple-100/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-purple-900">
                      Contributing branches (weight ≥ 10%):
                    </span>
                    {result.contributing.map(branch => (
                      <span
                        key={branch}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-purple-200 text-xs font-medium text-purple-900 shadow-xs"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${BRANCH_COLORS[branch] || 'bg-purple-400'}`} />
                        <span>{BRANCH_LABELS[branch] || branch}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Input vs Restored with a toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
                    Input vs Restored View
                  </h4>
                  <div className="p-0.5 bg-purple-100 rounded-lg flex gap-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('input')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        viewMode === 'input'
                          ? 'bg-white text-purple-900 shadow-sm'
                          : 'text-purple-600 hover:text-purple-900'
                      }`}
                    >
                      Corrupted Input
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('restored')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        viewMode === 'restored'
                          ? 'bg-white text-purple-900 shadow-sm'
                          : 'text-purple-600 hover:text-purple-900'
                      }`}
                    >
                      Restored Output
                    </button>
                  </div>
                </div>

                <div className="relative aspect-square max-w-[360px] mx-auto rounded-2xl overflow-hidden border border-purple-200 bg-neutral-900 shadow-md">
                  <img
                    src={viewMode === 'restored' ? result.restored : result.input}
                    alt={viewMode === 'restored' ? "Restored" : "Input"}
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'auto' }}
                  />
                  <span className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-md text-xs font-medium">
                    {viewMode === 'restored' ? 'Restored: Blended Continuous MoE' : 'Corrupted Input'}
                  </span>
                </div>
              </div>

              {/* Performance & Quality Metrics */}
              <MetricsCards
                inferenceMs={result.inference_ms}
                psnr={result.psnr}
              />

              {/* Corruption Summary Generic Key/Value List */}
              <CorruptionSummaryCard corruption={result.corruption} />

              {/* Download Restored Image */}
              <div className="pt-2">
                <a
                  href={result.restored}
                  download="soft_moe_restored.png"
                  className="w-full py-3 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download restored image</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
