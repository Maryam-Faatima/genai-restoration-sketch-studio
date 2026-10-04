import React, { useState } from 'react';
import { Sparkles, Sliders, ChevronDown, ChevronUp, Download, Eye, RefreshCw, ArrowUpRight } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import CompareSlider from '../components/CompareSlider';
import MetricsCards from '../components/MetricsCards';
import CorruptionSummaryCard from '../components/CorruptionSummaryCard';
import { postUniversal } from '../api';

const CORRUPTION_OPTIONS = [
  { value: 'clean', label: 'None (Clean Reference)' },
  { value: 'salt_pepper', label: 'Salt-and-Pepper Noise' },
  { value: 'blur', label: 'Gaussian Blur' },
  { value: 'occlusion', label: 'Rectangular Occlusion' },
];

export default function UniversalWorkspace({ samples, onError }) {
  const [mode, setMode] = useState('uploaded');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [corruptionType, setCorruptionType] = useState('salt_pepper');
  const [severity, setSeverity] = useState('medium');
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [result, setResult] = useState(null);
  const [viewOriginal, setViewOriginal] = useState(false);

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
      const data = await postUniversal({
        imageFile: selectedFile,
        corruption: mode === 'uploaded' ? 'uploaded' : corruptionType,
        severity,
        seed: seed.trim() !== '' ? parseInt(seed, 10) : null,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') onError(err.message || 'Restoration failed.');
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl mx-auto">
      {/* Left Column: Controls */}
      <div className="lg:col-span-5 space-y-6">
        {/* Header Card */}
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-3 shadow-scafos">
          <div className="flex items-center justify-between">
            <span className="font-handwriting text-3xl text-[#C24B38]">studio 01</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-[#B5D3CA] bg-[#B5D3CA]/40 text-[#1F453D]">
              Autoencoder
            </span>
          </div>
          <h2 className="text-2xl font-serif font-black text-[#2D2424] uppercase tracking-tight">
            Universal Restoration
          </h2>
          <p className="text-xs text-[#7C6F6F] leading-relaxed">
            One single autoencoder restores clean, noisy, blurred, and occluded images in a single clean pass.
          </p>

          {/* Mode Switcher */}
          <div className="pt-2 grid grid-cols-2 gap-2">
            {[
              ['uploaded', 'Upload Corrupted'],
              ['synthetic', 'Apply Corruption'],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setMode(val)}
                className={`py-2.5 px-2 text-xs uppercase tracking-wider font-bold rounded-xl transition-all text-center border ${
                  mode === val
                    ? 'border-[#C24B38] bg-[#C24B38] text-white shadow-xs'
                    : 'border-[#2D2424]/10 bg-[#FFF7F4] text-[#7C6F6F] hover:text-[#2D2424]'
                }`}
              >
                {label}
              </button>
            ))}
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
          customTitle={mode === 'uploaded' ? 'Corrupted Pet Image' : 'Clean Pet Image'}
        />

        {/* Corruption Settings */}
        {mode === 'synthetic' && (
          <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-4 shadow-scafos">
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-[#2D2424] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#C24B38]" />
              Corruption Parameters
            </h3>
            <div>
              <label htmlFor="universal-corruption-type" className="block text-xs uppercase tracking-wider font-bold text-[#7C6F6F] mb-1.5">
                Corruption Type
              </label>
              <select
                id="universal-corruption-type"
                value={corruptionType}
                onChange={(e) => setCorruptionType(e.target.value)}
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
            {corruptionType !== 'clean' && (
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
        )}

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
              <label htmlFor="universal-seed" className="block text-xs uppercase tracking-wider font-medium text-[#7C6F6F]">
                Random Seed (Empty = Random)
              </label>
              <input
                id="universal-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. 42"
                disabled={loading}
                className="w-full text-xs font-mono border border-[#2D2424]/15 bg-[#FFF7F4] rounded-xl px-3 py-2 text-[#2D2424] focus:outline-none focus:border-[#C24B38]"
              />
              {result?.corruption?.seed !== undefined && (
                <p className="text-[11px] text-[#7C6F6F] font-mono">
                  Applied Seed: <strong className="text-[#C24B38]">{result.corruption.seed}</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Restore Action Button */}
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || !selectedFile}
          className="w-full py-4 px-6 rounded-2xl bg-[#C24B38] hover:bg-[#A63827] text-white text-xs uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Restoring Image...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Restore Swatch Now</span>
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
                <Sparkles className="w-7 h-7" />
              </div>
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">ready to begin</span>
              <h4 className="text-lg font-serif font-black text-[#2D2424] uppercase">
                Choose an image to begin
              </h4>
              <p className="text-xs text-[#7C6F6F] leading-relaxed">
                Select a pet sample or upload your own to test universal reconstruction across all corruption classes.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-24 space-y-4">
              <RefreshCw className="w-10 h-10 text-[#C24B38] animate-spin mx-auto" />
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">working our magic</span>
              <p className="text-sm font-serif font-bold uppercase tracking-widest text-[#2D2424]">
                Executing Neural Model...
              </p>
              <p className="text-xs text-[#7C6F6F]">
                Running ONNX universal autoencoder inference
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D2424]/10 pb-4">
                <div>
                  <span className="font-handwriting text-2xl text-[#C24B38] block -mb-1">restored swatch</span>
                  <h3 className="font-serif font-bold text-lg text-[#2D2424]">Before vs After Comparison</h3>
                </div>
                {result.original && (
                  <button
                    type="button"
                    onClick={() => setViewOriginal(!viewOriginal)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs uppercase tracking-widest font-bold rounded-full border transition-colors ${
                      viewOriginal
                        ? 'bg-[#C24B38] text-white border-[#C24B38]'
                        : 'bg-[#FFF7F4] text-[#7C6F6F] border-[#2D2424]/10 hover:text-[#2D2424]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{viewOriginal ? 'Viewing Original' : 'Compare Original'}</span>
                  </button>
                )}
              </div>

              {/* Slider */}
              <CompareSlider
                leftImage={viewOriginal && result.original ? result.original : result.input}
                rightImage={result.restored}
                leftLabel={viewOriginal && result.original ? "Original Truth" : "Corrupted Input"}
                rightLabel="Restored Output"
              />

              <CorruptionSummaryCard corruption={result.corruption} />
              <MetricsCards inferenceMs={result.inference_ms} psnr={result.psnr} />

              <a
                href={result.restored}
                download="universal_restored.png"
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
