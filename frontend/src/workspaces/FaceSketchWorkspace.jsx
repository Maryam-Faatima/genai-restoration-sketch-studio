import React, { useState } from 'react';
import { Palette, Camera, Download, RefreshCw } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import CompareSlider from '../components/CompareSlider';
import MetricsCards from '../components/MetricsCards';
import WebcamModal from '../components/WebcamModal';
import { postSketch } from '../api';

const STYLES = [
  { id: 1, name: 'Style 1', desc: 'Delicate tonal shading with soft graphite strokes' },
  { id: 2, name: 'Style 2', desc: 'Deep contrast with bold boundary contours' },
  { id: 3, name: 'Style 3', desc: 'Minimalist crisp outlines with clean negative space' },
];

export default function FaceSketchWorkspace({ samples, onError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [style, setStyle] = useState(1);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [result, setResult] = useState(null);

  const handleImageSelected = (file) => {
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setResult(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile) {
      onError('Please select or upload a face photograph first.');
      return;
    }

    if (abortController) abortController.abort();
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    onError(null);

    try {
      const data = await postSketch({
        photoFile: selectedFile,
        style,
        signal: controller.signal,
      });
      setResult(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Sketch generation failed.');
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
            <span className="font-handwriting text-3xl text-[#C24B38]">studio 04</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border border-[#C24B38]/30 bg-[#C24B38]/10 text-[#C24B38]">
              Conditional GAN
            </span>
          </div>
          <h2 className="text-2xl font-serif font-black text-[#2D2424] uppercase tracking-tight">
            Face-to-Sketch Studio
          </h2>
          <p className="text-xs text-[#7C6F6F] leading-relaxed">
            Synthesize expressive, tonal pencil drawings from portrait photographs across three distinct styles.
          </p>

          <button
            type="button"
            onClick={() => setIsWebcamOpen(true)}
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl border border-[#2D2424]/15 hover:border-[#C24B38] bg-[#FFF7F4] hover:bg-white text-xs uppercase tracking-wider font-bold text-[#2D2424] transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Camera className="w-4 h-4 text-[#C24B38]" />
            <span>Capture with Camera</span>
          </button>
        </div>

        <ImagePicker
          selectedFile={selectedFile}
          previewUrl={previewUrl}
          onImageSelected={handleImageSelected}
          onError={onError}
          samples={samples}
          sampleType="face"
          disabled={loading}
          customTitle="Upload Face Portrait"
        />

        {/* Style Selector */}
        <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-4 shadow-scafos">
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-[#2D2424] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#C24B38]" />
            Select Sketch Style
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                disabled={loading}
                className={`py-3 px-2 text-xs uppercase tracking-wider font-bold rounded-xl transition-all text-center border ${
                  style === s.id
                    ? 'border-[#C24B38] bg-[#C24B38] text-white shadow-xs'
                    : 'border-[#2D2424]/10 bg-[#FFF7F4] text-[#7C6F6F] hover:text-[#2D2424]'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#7C6F6F] bg-[#FFF7F4] p-3 rounded-xl border border-[#2D2424]/5 leading-relaxed font-medium">
            {STYLES.find((s) => s.id === style)?.desc}
          </p>
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !selectedFile}
          className="w-full py-4 px-6 rounded-2xl bg-[#C24B38] hover:bg-[#A63827] text-white text-xs uppercase tracking-widest font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Synthesizing Pencil Sketch...</span>
            </>
          ) : (
            <>
              <Palette className="w-4 h-4" />
              <span>Draw Portrait Sketch</span>
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
                <Palette className="w-7 h-7" />
              </div>
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">portrait art</span>
              <h4 className="text-lg font-serif font-black text-[#2D2424] uppercase">
                Choose a face photo to begin
              </h4>
              <p className="text-xs text-[#7C6F6F] leading-relaxed">
                Upload a face portrait or snap a photo with your camera, select a style, and generate authentic pencil art.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-24 space-y-4">
              <RefreshCw className="w-10 h-10 text-[#C24B38] animate-spin mx-auto" />
              <span className="font-handwriting text-3xl text-[#C24B38] block -mb-2">sketching portrait</span>
              <p className="text-sm font-serif font-bold uppercase tracking-widest text-[#2D2424]">
                Synthesizing Pencil Strokes...
              </p>
              <p className="text-xs text-[#7C6F6F]">
                Running conditional GAN on portrait photography
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="w-full space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#2D2424]/10 pb-4">
                <div>
                  <span className="font-handwriting text-2xl text-[#C24B38] block -mb-1">artistic result</span>
                  <h3 className="font-serif font-bold text-lg text-[#2D2424]">Photo vs Pencil Sketch</h3>
                </div>
                <span className="text-xs uppercase tracking-widest font-mono font-bold px-3 py-1 rounded-full border border-[#C24B38]/30 bg-[#FFF7F4] text-[#C24B38]">
                  {result.style}
                </span>
              </div>

              {/* Side-by-Side Images */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Source Photo', result.photo],
                  ['Synthesized Sketch', result.sketch],
                ].map(([label, src]) => (
                  <div key={label} className="rounded-2xl border border-[#2D2424]/10 bg-[#FFF7F4] p-3 space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#7C6F6F] block text-center">
                      {label}
                    </span>
                    <div className="aspect-square w-full bg-white rounded-xl overflow-hidden flex items-center justify-center border border-[#2D2424]/10">
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

              {/* Comparison Slider */}
              <div className="space-y-3 pt-2">
                <span className="text-[10px] uppercase tracking-widest font-mono text-[#7C6F6F] block text-center">
                  Interactive Split Slider
                </span>
                <CompareSlider
                  leftImage={result.photo}
                  rightImage={result.sketch}
                  leftLabel="Original Photo"
                  rightLabel="Sketch Output"
                />
              </div>

              <MetricsCards inferenceMs={result.inference_ms} />

              <a
                href={result.sketch}
                download="face_sketch.png"
                className="w-full py-4 px-6 rounded-2xl bg-[#FFF7F4] border-2 border-[#C24B38] hover:bg-[#C24B38] hover:text-white text-[#C24B38] text-xs uppercase tracking-widest font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Sketch (PNG)</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Webcam Modal */}
      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={handleImageSelected}
        onError={onError}
      />
    </div>
  );
}
