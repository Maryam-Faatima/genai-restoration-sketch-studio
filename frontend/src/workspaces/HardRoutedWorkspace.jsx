import React, { useState } from 'react';
import { GitFork, Sliders, ChevronDown, ChevronUp, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import MetricsCards from '../components/MetricsCards';
import CorruptionSummaryCard from '../components/CorruptionSummaryCard';
import { postHard } from '../api';

const CORRUPTION_OPTIONS = [
  { value: 'uploaded', label: 'Use image as uploaded (already corrupted)' },
  { value: 'clean', label: 'Clean (None)' },
  { value: 'salt_pepper', label: 'Salt-and-pepper noise' },
  { value: 'blur', label: 'Gaussian blur' },
  { value: 'occlusion', label: 'Rectangular occlusion' },
];

const CLASS_LABELS = {
  clean: 'Clean',
  salt_pepper: 'Salt-and-Pepper',
  blur: 'Gaussian Blur',
  occlusion: 'Occlusion',
};

export default function HardRoutedWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [corruption, setCorruption] = useState('uploaded');
  const [severity, setSeverity] = useState('medium');
  const [routingMode, setRoutingMode] = useState('predicted');
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

  const handleCorruptionChange = (val) => {
    setCorruption(val);
    if (val === 'uploaded' && routingMode === 'oracle') {
      setRoutingMode('predicted');
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      onError('Please select or upload an image first.');
      return;
    }
    if (routingMode === 'oracle' && corruption === 'uploaded') {
      onError('Oracle routing requires a known corruption type.');
      return;
    }

    if (abortController) abortController.abort();
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    onError(null);

    try {
      const data = await postHard({
        imageFile: selectedFile,
        corruption,
        severity,
        seed: seed.trim() !== '' ? parseInt(seed, 10) : null,
        routing: routingMode,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Hard-routed restoration failed.');
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl mx-auto">
      {/* Left Column: Controls */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-3 shadow-scafos">
          <div className="flex items-center justify-between">
            <span className="font-handwriting text-3xl text-[#C24B38]">studio 02</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-[#FDC7BD] bg-[#FDC7BD]/50 text-[#8C2E1F]">
              Classifier + Specialists
            </span>
          </div>
          <h2 className="text-2xl font-serif font-black text-[#2D2424] uppercase tracking-tight">
            Hard-Routed Restoration
          </h2>
          <p className="text-xs text-[#7C6F6F] leading-relaxed">
            A CNN classifier diagnoses corruption degradation, dispatching to targeted specialists or an identity bypass.
          </p>
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

        {/* Routing & Parameters */}
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-4 shadow-scafos">
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-[#2D2424] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C24B38]" />
            Routing Options
          </h3>

          {/* Routing Mode */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-[#7C6F6F] mb-1.5">
              Routing Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['predicted', 'Predicted (Classifier)'],
                ['oracle', 'Oracle (Ground Truth)'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (val === 'oracle' && corruption === 'uploaded') return;
                    setRoutingMode(val);
                  }}
                  disabled={val === 'oracle' && corruption === 'uploaded'}
                  className={`py-2.5 px-2 text-xs uppercase tracking-wider font-bold rounded-xl transition-all text-center border ${
                    val === 'oracle' && corruption === 'uploaded'
                      ? 'opacity-30 cursor-not-allowed border-[#2D2424]/10 text-[#7C6F6F]'
                      : routingMode === val
                      ? 'border-[#C24B38] bg-[#C24B38] text-white shadow-xs'
                      : 'border-[#2D2424]/10 bg-[#FFF7F4] text-[#7C6F6F] hover:text-[#2D2424]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {corruption === 'uploaded' && (
              <p className="text-[10px] text-[#7C6F6F] mt-2 font-mono flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#C24B38] shrink-0" />
                Oracle routing is disabled for uploaded images (corruption unknown).
              </p>
            )}
          </div>

          {/* Corruption Type */}
          <div>
            <label htmlFor="hard-corruption-type" className="block text-xs uppercase tracking-wider font-bold text-[#7C6F6F] mb-1.5">
              Corruption Type
            </label>
            <select
              id="hard-corruption-type"
              value={corruption}
              onChange={(e) => handleCorruptionChange(e.target.value)}
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

          {/* Severity */}
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
              <label htmlFor="hard-seed" className="block text-xs uppercase tracking-wider font-medium text-[#7C6F6F]">
                Random Seed (Empty = Random)
              </label>
              <input
                id="hard-seed"
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
              <span>Routing and Restoring...</span>
            </>
          ) : (
            <>
              <GitFork className="w-4 h-4" />
              <span>Route & Restore Swatch</span>
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
                <GitFork className="w-7 h-7" />
              </div>
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">intelligent routing</span>
              <h4 className="text-lg font-serif font-black text-[#2D2424] uppercase">
                Choose an image to begin
              </h4>
              <p className="text-xs text-[#7C6F6F] leading-relaxed">
                Experience real-time classification probability bars and targeted specialist neural network restoration.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-24 space-y-4">
              <RefreshCw className="w-10 h-10 text-[#C24B38] animate-spin mx-auto" />
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">classifying degradation</span>
              <p className="text-sm font-serif font-bold uppercase tracking-widest text-[#2D2424]">
                Diagnosing & Dispatching...
              </p>
              <p className="text-xs text-[#7C6F6F]">
                Running CNN classification and routing to specialist ONNX model
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-6">
              {/* Classifier Probabilities Card */}
              <div className="rounded-2xl border border-[#2D2424]/10 bg-[#FFF7F4] p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#2D2424]/10 pb-3">
                  <h4 className="text-xs font-serif font-bold uppercase tracking-wider text-[#2D2424]">
                    Classifier Probabilities
                  </h4>
                  <span className="text-[10px] font-mono text-[#7C6F6F]">100% Normalized</span>
                </div>
                <div className="space-y-3">
                  {['clean', 'salt_pepper', 'blur', 'occlusion'].map((clsKey) => {
                    const prob = result.probabilities?.[clsKey] || 0;
                    const isWinner = result.predicted === clsKey;
                    return (
                      <div key={clsKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#2D2424] flex items-center gap-2">
                            <span>{CLASS_LABELS[clsKey]}</span>
                            {isWinner && (
                              <span className="px-2 py-0.5 rounded-full bg-[#C24B38] text-white text-[9px] uppercase font-mono font-bold">
                                Winner
                              </span>
                            )}
                          </span>
                          <span className="font-mono font-bold text-[#2D2424]">
                            {(prob * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-[#2D2424]/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isWinner ? 'bg-[#C24B38]' : 'bg-[#DDB6AC]'
                            }`}
                            style={{ width: `${Math.min(100, prob * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Expert & Diagnostic Banner */}
              <div className="rounded-2xl border border-[#2D2424]/10 bg-[#FFF7F4] p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-[#7C6F6F]">
                    Selected Expert
                  </span>
                  {result.correct !== null && result.correct !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border ${
                        result.correct
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{result.correct ? 'Correctly Routed' : 'Misrouted'}</span>
                    </span>
                  )}
                </div>
                <div className="text-xl font-serif font-bold text-[#2D2424] capitalize">
                  {result.expert}
                </div>
                {result.expert === 'identity bypass' && (
                  <p className="text-xs text-[#7C6F6F] border-l-2 border-[#C24B38] pl-3 py-1 font-sans">
                    Clean input detected: no restoration expert needed; bypassing computation.
                  </p>
                )}
              </div>

              {/* Side-by-Side Images */}
              <div className="space-y-3">
                <span className="text-[10px] uppercase tracking-widest font-mono text-[#7C6F6F] block">
                  Reconstruction Comparison
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

              <MetricsCards
                inferenceMs={result.inference_ms}
                timingMs={result.timing_ms}
                psnr={result.psnr}
              />
              <CorruptionSummaryCard corruption={result.corruption} />

              <a
                href={result.restored}
                download="hard_routed_restored.png"
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
