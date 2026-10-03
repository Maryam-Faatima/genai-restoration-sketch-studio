import React, { useState } from 'react';
import { Palette, Camera, UploadCloud, Download, RefreshCw, Check, Sparkles } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import CompareSlider from '../components/CompareSlider';
import WebcamModal from '../components/WebcamModal';
import { postSketch } from '../api';

const STYLES = [
  { id: 1, name: 'Style 1', description: 'Light delicate tonal shading' },
  { id: 2, name: 'Style 2', description: 'Bold deep contrast and rich contours' },
  { id: 3, name: 'Style 3', description: 'Minimalist crisp outlines and highlights' },
];

export default function FaceSketchWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sourceType, setSourceType] = useState('upload'); // 'upload' | 'webcam'
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);

  // Style selector: 1 | 2 | 3 (default: 1)
  const [selectedStyle, setSelectedStyle] = useState(1);

  // Comparison view mode: 'side' (side-by-side) or 'wipe' (50/50 wipe/slider)
  const [viewMode, setViewMode] = useState('side');

  // Loading & In-flight
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);

  // Result
  const [result, setResult] = useState(null);

  const handleImageSelected = (file) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleWebcamCapture = (file) => {
    setIsWebcamOpen(false);
    handleImageSelected(file);
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      onError('Please select or capture a portrait photo first.');
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
      const data = await postSketch({
        photoFile: selectedFile,
        style: selectedStyle,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Face-to-sketch generation failed.');
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
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Conditional GAN Studio</span>
          </div>
          <h2 className="text-xl font-bold text-studio-purple-950">Face-to-Sketch Generator</h2>
          <p className="text-xs text-purple-900/70 mt-1">
            Transform human portraits into high-contrast expressive artistic sketches with generative GAN synthesis.
          </p>

          {/* Source Capture Toggle: Upload photo OR Use webcam */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSourceType('upload')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                sourceType === 'upload'
                  ? 'border-purple-500 bg-white ring-2 ring-purple-300 shadow-sm text-purple-900'
                  : 'border-purple-200/70 bg-purple-50/40 hover:bg-purple-100/50 text-purple-700'
              }`}
            >
              <UploadCloud className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-bold">Upload photo</span>
              <span className="text-[10px] text-purple-600/70">PNG, JPEG, WEBP</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSourceType('webcam');
                setIsWebcamOpen(true);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                sourceType === 'webcam'
                  ? 'border-purple-500 bg-white ring-2 ring-purple-300 shadow-sm text-purple-900'
                  : 'border-purple-200/70 bg-purple-50/40 hover:bg-purple-100/50 text-purple-700'
              }`}
            >
              <Camera className="w-5 h-5 text-pink-600" />
              <span className="text-xs font-bold">Use webcam</span>
              <span className="text-[10px] text-pink-600/70">Live face capture</span>
            </button>
          </div>
        </div>

        {/* Image Picker for Face Samples and Upload */}
        <ImagePicker
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          onImageSelected={handleImageSelected}
          onError={onError}
          samples={samples}
          sampleType="face"
          disabled={loading}
          customTitle="Source Portrait"
        />

        {/* Style Selector with exactly three options named Style 1, Style 2, Style 3 */}
        <div className="bg-white rounded-2xl border border-studio-border p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-studio-purple-950 text-sm flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-600" />
              <span>Style Selector</span>
            </h3>
            <span className="text-[11px] text-purple-600/80 font-medium">Choose 1 of 3</span>
          </div>

          <div className="space-y-2.5">
            {STYLES.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  disabled={loading}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 ring-2 ring-purple-300 shadow-sm text-purple-950'
                      : 'border-purple-200/70 bg-white hover:border-purple-300 hover:bg-purple-50/30 text-purple-900'
                  }`}
                >
                  <div className="flex items-center gap-3 text-left">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isSelected ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {style.id}
                    </span>
                    <div>
                      <div className="text-xs font-bold">{style.name}</div>
                      <div className="text-[11px] text-purple-600/80">{style.description}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !selectedFile}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating artistic sketch...</span>
            </>
          ) : (
            <>
              <Palette className="w-4 h-4" />
              <span>Generate sketch</span>
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
                <Palette className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-studio-purple-950">Choose a portrait to begin</h4>
              <p className="text-xs text-purple-700/70 max-w-sm mx-auto">
                Select a portrait sample, upload your own photo, or snap a picture with your webcam.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-20 space-y-3">
              <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-studio-purple-950">Synthesizing Sketch with conditional GAN...</p>
              <p className="text-xs text-purple-600">Drawing outlines and contours according to {STYLES.find(s=>s.id===selectedStyle)?.name}</p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 pb-3">
                <div>
                  <h3 className="font-bold text-studio-purple-950 text-base">Results Comparison</h3>
                  <p className="text-xs text-purple-600/80">Style: <strong className="text-purple-950">{result.style}</strong></p>
                </div>

                {/* Toggle: Side-by-Side vs 50/50 Wipe */}
                <div className="p-0.5 bg-purple-100 rounded-lg flex gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('side')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      viewMode === 'side'
                        ? 'bg-white text-purple-900 shadow-sm'
                        : 'text-purple-600 hover:text-purple-900'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('wipe')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      viewMode === 'wipe'
                        ? 'bg-white text-purple-900 shadow-sm'
                        : 'text-purple-600 hover:text-purple-900'
                    }`}
                  >
                    50/50 Wipe
                  </button>
                </div>
              </div>

              {/* View Rendering */}
              {viewMode === 'side' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center bg-purple-50/30 rounded-xl p-2 border border-purple-100">
                    <span className="text-[11px] font-bold text-purple-800 mb-1.5">Original photo</span>
                    <img
                      src={result.photo}
                      alt="Original portrait"
                      className="w-full aspect-square object-contain rounded-lg border border-purple-200 bg-white"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                  <div className="flex flex-col items-center bg-purple-50/30 rounded-xl p-2 border border-purple-100">
                    <span className="text-[11px] font-bold text-purple-800 mb-1.5">Generated sketch</span>
                    <img
                      src={result.sketch}
                      alt="Generated sketch"
                      className="w-full aspect-square object-contain rounded-lg border border-purple-200 bg-white"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                </div>
              ) : (
                <CompareSlider
                  leftImage={result.photo}
                  rightImage={result.sketch}
                  leftLabel="Original Photo"
                  rightLabel="Generated Sketch"
                />
              )}

              {/* Inference Time Card */}
              <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
                    Synthesis Performance
                  </div>
                  <div className="text-base font-bold text-studio-purple-950 mt-0.5">
                    Inference time: {result.inference_ms} ms
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                  Style: {result.style}
                </span>
              </div>

              {/* Download Button */}
              <div className="pt-2">
                <a
                  href={result.sketch}
                  download="generated_sketch.png"
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-95 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download sketch (PNG)</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Webcam Modal */}
      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={handleWebcamCapture}
        onError={onError}
      />
    </div>
  );
}
