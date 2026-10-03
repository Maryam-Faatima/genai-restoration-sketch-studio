import React, { useState } from 'react';
import { GitFork, Sliders, ChevronDown, ChevronUp, Download, RefreshCw, CheckCircle, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
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
  salt_pepper: 'Salt-and-pepper',
  blur: 'Blur',
  occlusion: 'Occlusion',
};

export default function HardRoutedWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Settings
  const [corruption, setCorruption] = useState('uploaded');
  const [severity, setSeverity] = useState('medium');
  const [routingMode, setRoutingMode] = useState('predicted'); // 'predicted' | 'oracle'
  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Loading & In-flight
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Results
  const [result, setResult] = useState(null);

  const handleImageSelected = (file) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleCorruptionChange = (newVal) => {
    setCorruption(newVal);
    // If switching to uploaded, force routing to 'predicted' because oracle is disabled
    if (newVal === 'uploaded' && routingMode === 'oracle') {
      setRoutingMode('predicted');
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      onError('Please select or upload an image first.');
      return;
    }

    if (routingMode === 'oracle' && corruption === 'uploaded') {
      onError('Oracle routing needs a known corruption: choose clean, salt_pepper, blur or occlusion.');
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-6xl mx-auto">
      {/* Left Column: Controls (lg: 5 cols) */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-gradient-to-br from-white via-purple-50/40 to-pink-50/40 rounded-2xl p-5 border border-studio-border shadow-card">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100/70 text-purple-800 text-xs font-semibold mb-2">
            <GitFork className="w-3.5 h-3.5 text-purple-600" />
            <span>Classifier Routed</span>
          </div>
          <h2 className="text-xl font-bold text-studio-purple-950">Hard-Routed Restoration</h2>
          <p className="text-xs text-purple-900/70 mt-1">
            Images are evaluated by an image quality classifier which assigns each sample to its dedicated restoration expert.
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
              <span>Restoration Controls</span>
            </h3>
          </div>

          {/* Routing Mode */}
          <div>
            <label className="block text-xs font-medium text-studio-purple-900 mb-1.5">
              Routing Mode
            </label>
            <div className="p-1 bg-purple-100/70 rounded-xl grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setRoutingMode('predicted')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                  routingMode === 'predicted'
                    ? 'bg-white text-purple-900 shadow-sm'
                    : 'text-purple-700 hover:text-purple-900'
                }`}
              >
                Predicted (classifier)
              </button>
              <button
                type="button"
                onClick={() => corruption !== 'uploaded' && setRoutingMode('oracle')}
                disabled={corruption === 'uploaded'}
                className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                  corruption === 'uploaded'
                    ? 'opacity-40 cursor-not-allowed text-purple-400'
                    : routingMode === 'oracle'
                    ? 'bg-white text-purple-900 shadow-sm'
                    : 'text-purple-700 hover:text-purple-900'
                }`}
                title={corruption === 'uploaded' ? "Oracle routing disabled for uploaded images (unknown ground truth)" : ""}
              >
                Oracle (known corruption)
              </button>
            </div>
            {corruption === 'uploaded' && (
              <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Oracle routing is disabled: ground truth is unknown for uploaded images.</span>
              </p>
            )}
          </div>

          {/* Corruption Dropdown */}
          <div>
            <label htmlFor="hard-corruption-dropdown" className="block text-xs font-medium text-studio-purple-900 mb-1.5">
              Corruption Type
            </label>
            <select
              id="hard-corruption-dropdown"
              value={corruption}
              onChange={(e) => handleCorruptionChange(e.target.value)}
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
              <label htmlFor="hard-seed" className="block text-xs text-purple-800">
                Random Seed (optional integer)
              </label>
              <input
                id="hard-seed"
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

        {/* Action button */}
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || !selectedFile}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Routing and restoring...</span>
            </>
          ) : (
            <>
              <GitFork className="w-4 h-4" />
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
                <GitFork className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-studio-purple-950">Choose an image to begin</h4>
              <p className="text-xs text-purple-700/70 max-w-sm mx-auto">
                Select an image to route through our classification engine and dispatch to specialized autoencoders.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-20 space-y-3">
              <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-studio-purple-950">Classifying and Dispatching to Expert...</p>
              <p className="text-xs text-purple-600">Evaluating quality metrics and running specialized inference</p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-5">
              {/* Card 1: Classifier probabilities with exactly four labelled bars */}
              <div className="bg-purple-50/40 rounded-xl p-4 border border-purple-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-studio-purple-950 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span>Classifier probabilities</span>
                  </h4>
                  <span className="text-[11px] text-purple-600/80 font-medium">100% total</span>
                </div>

                <div className="space-y-2.5">
                  {['clean', 'salt_pepper', 'blur', 'occlusion'].map((clsKey) => {
                    const prob = result.probabilities ? result.probabilities[clsKey] || 0 : 0;
                    const percent = (prob * 100).toFixed(1);
                    const isWinner = result.predicted === clsKey;

                    return (
                      <div key={clsKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-studio-purple-950 flex items-center gap-1.5">
                            <span>{CLASS_LABELS[clsKey]}</span>
                            {isWinner && (
                              <span className="px-1.5 py-0.2 rounded bg-pink-100 text-pink-700 text-[10px] font-bold uppercase tracking-wider">
                                Winner
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-studio-purple-900 font-mono">
                            {percent}%
                          </span>
                        </div>
                        {/* Bar */}
                        <div className="h-2 w-full bg-purple-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isWinner
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                                : 'bg-purple-300'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Selected Expert */}
              <div className="bg-purple-50/40 rounded-xl p-4 border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                    Selected expert
                  </span>
                  {result.correct !== null && result.correct !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        result.correct
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {result.correct ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Misrouted</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="text-base font-bold text-studio-purple-950 capitalize">
                  {result.expert}
                </div>
                {result.expert === 'identity bypass' && (
                  <p className="text-xs text-purple-700/80 bg-white p-2 rounded-lg border border-purple-100">
                    Clean input: no restoration expert is run
                  </p>
                )}
                {result.routing === 'oracle' && (
                  <p className="text-[11px] text-purple-600 font-medium">
                    (Routed using ground-truth oracle label)
                  </p>
                )}
              </div>

              {/* Input vs Restored side by side */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-purple-900 uppercase tracking-wider">
                  Input vs Restored (Side by Side)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center bg-purple-50/30 rounded-xl p-2 border border-purple-100">
                    <span className="text-[11px] font-bold text-purple-800 mb-1.5">Input</span>
                    <img
                      src={result.input}
                      alt="Input"
                      className="w-full aspect-square object-contain rounded-lg border border-purple-200 bg-white"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                  <div className="flex flex-col items-center bg-purple-50/30 rounded-xl p-2 border border-purple-100">
                    <span className="text-[11px] font-bold text-purple-800 mb-1.5">Restored</span>
                    <img
                      src={result.restored}
                      alt="Restored"
                      className="w-full aspect-square object-contain rounded-lg border border-purple-200 bg-white"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                </div>
              </div>

              {/* Timing Card & PSNR Card */}
              <MetricsCards
                inferenceMs={result.inference_ms}
                timingMs={result.timing_ms}
                psnr={result.psnr}
              />

              {/* Settings Summary Generic Key/Value List */}
              <CorruptionSummaryCard corruption={result.corruption} />

              {/* Download Restored Image */}
              <div className="pt-2">
                <a
                  href={result.restored}
                  download="hard_routed_restored.png"
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
