import React, { useState } from 'react';
import { Sparkles, Sliders, ChevronDown, ChevronUp, Download, Eye, RefreshCw } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import CompareSlider from '../components/CompareSlider';
import MetricsCards from '../components/MetricsCards';
import CorruptionSummaryCard from '../components/CorruptionSummaryCard';
import { postUniversal } from '../api';

const CORRUPTION_OPTIONS = [
  { value: 'clean', label: 'None (clean)' },
  { value: 'salt_pepper', label: 'Salt-and-pepper noise' },
  { value: 'blur', label: 'Gaussian blur' },
  { value: 'occlusion', label: 'Rectangular occlusion' },
];

export default function UniversalWorkspace({ samples, onError }) {
  // Mode: "uploaded" (Use image as supplied) or "synthetic" (Apply corruption to a clean image)
  const [mode, setMode] = useState('uploaded'); // 'uploaded' | 'synthetic'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Settings
  const [corruptionType, setCorruptionType] = useState('salt_pepper');
  const [severity, setSeverity] = useState('medium');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Loading & In-flight
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Results
  const [result, setResult] = useState(null);
  const [viewOriginal, setViewOriginal] = useState(false);

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

    const actualCorruption = mode === 'uploaded' ? 'uploaded' : corruptionType;

    try {
      const data = await postUniversal({
        imageFile: selectedFile,
        corruption: actualCorruption,
        severity,
        seed: seed.trim() !== '' ? parseInt(seed, 10) : null,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Restoration failed.');
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
        {/* Workspace Title & Badge */}
        <div className="bg-gradient-to-br from-white via-purple-50/40 to-pink-50/40 rounded-2xl p-5 border border-studio-border shadow-card">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100/70 text-purple-800 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Universal Autoencoder</span>
          </div>
          <h2 className="text-xl font-bold text-studio-purple-950">Universal Restoration</h2>
          <p className="text-xs text-purple-900/70 mt-1">
            One autoencoder restores clean, noisy, blurred, and occluded images.
          </p>

          {/* Mode Switcher */}
          <div className="mt-4 p-1 bg-purple-100/70 rounded-xl grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setMode('uploaded')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                mode === 'uploaded'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              Upload already-corrupted
            </button>
            <button
              type="button"
              onClick={() => setMode('synthetic')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                mode === 'synthetic'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-purple-700 hover:text-purple-900'
              }`}
            >
              Apply corruption to clean
            </button>
          </div>
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
          customTitle={mode === 'uploaded' ? 'Corrupted Pet Image' : 'Clean Pet Image'}
        />

        {/* Corruption Settings (if synthetic mode) */}
        {mode === 'synthetic' && (
          <div className="bg-white rounded-2xl border border-studio-border p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-studio-purple-950 text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>Corruption Settings</span>
              </h3>
            </div>

            <div>
              <label htmlFor="universal-corruption-type" className="block text-xs font-medium text-studio-purple-900 mb-1.5">
                Corruption type
              </label>
              <select
                id="universal-corruption-type"
                value={corruptionType}
                onChange={(e) => setCorruptionType(e.target.value)}
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

            {corruptionType !== 'clean' && (
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
        )}

        {/* Advanced Collapsible (Seed input) */}
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
              <label htmlFor="universal-seed" className="block text-xs text-purple-800">
                Random Seed (optional integer, empty = random)
              </label>
              <input
                id="universal-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. 42"
                disabled={loading}
                className="w-full text-xs bg-purple-50/50 border border-purple-200 rounded-xl px-3 py-2 text-studio-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {result && result.corruption && result.corruption.seed !== undefined && (
                <p className="text-[11px] text-purple-600">
                  Last applied seed: <strong className="font-mono">{result.corruption.seed}</strong>
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
              <span>Restoring image...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
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
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-studio-purple-950">Choose an image to begin</h4>
              <p className="text-xs text-purple-700/70 max-w-sm mx-auto">
                Select a pet sample or upload your own image. Choose synthetic corruptions or test natural degradation.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-20 space-y-3">
              <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-studio-purple-950">Running Universal Autoencoder...</p>
              <p className="text-xs text-purple-600">Reconstructing high-fidelity image from corrupted input</p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 pb-3">
                <h3 className="font-bold text-studio-purple-950 text-base flex items-center gap-2">
                  <span>Results: Before vs After</span>
                </h3>

                {result.original && (
                  <button
                    type="button"
                    onClick={() => setViewOriginal(!viewOriginal)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                      viewOriginal
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{viewOriginal ? 'Viewing Original Clean' : 'Compare Original'}</span>
                  </button>
                )}
              </div>

              {/* Slider View */}
              <CompareSlider
                leftImage={viewOriginal && result.original ? result.original : result.input}
                rightImage={result.restored}
                leftLabel={viewOriginal && result.original ? "Clean Reference" : "Corrupted Input"}
                rightLabel="Restored Output"
              />

              {/* Settings Summary Generic Key/Value List */}
              <CorruptionSummaryCard corruption={result.corruption} />

              {/* Performance & Quality Metrics */}
              <MetricsCards
                inferenceMs={result.inference_ms}
                psnr={result.psnr}
              />

              {/* Download Restored Image */}
              <div className="pt-2">
                <a
                  href={result.restored}
                  download="universal_restored.png"
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
