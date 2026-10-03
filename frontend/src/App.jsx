import React, { useState, useEffect } from 'react';
import { Sparkles, GitFork, Network, Palette, AlertCircle, X, ExternalLink } from 'lucide-react';
import StatusChip from './components/StatusChip';
import UniversalWorkspace from './workspaces/UniversalWorkspace';
import HardRoutedWorkspace from './workspaces/HardRoutedWorkspace';
import SoftMoEWorkspace from './workspaces/SoftMoEWorkspace';
import FaceSketchWorkspace from './workspaces/FaceSketchWorkspace';
import { checkHealth, getSamples } from './api';

const WORKSPACES = [
  { id: 'universal', name: 'Universal', label: 'Universal', icon: Sparkles, desc: 'Single autoencoder for all corruptions' },
  { id: 'hard', name: 'Hard-Routed', label: 'Hard-Routed', icon: GitFork, desc: 'Classifier routes to specialist autoencoder' },
  { id: 'soft', name: 'Soft-MoE', label: 'Soft-MoE', icon: Network, desc: 'Continuous gating mixture of experts' },
  { id: 'sketch', name: 'Face-Sketch', label: 'Face-Sketch', icon: Palette, desc: 'Generative GAN pencil sketches' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('universal');
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [samples, setSamples] = useState([]);
  const [globalError, setGlobalError] = useState(null);

  const fetchHealthData = async () => {
    setHealthLoading(true);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setGlobalError(`Backend health check failed: ${err.message}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchSamplesData = async () => {
    try {
      const data = await getSamples();
      if (data && data.samples) {
        setSamples(data.samples);
      }
    } catch (err) {
      console.warn("Could not load samples:", err);
    }
  };

  useEffect(() => {
    fetchHealthData();
    fetchSamplesData();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7FB] text-[#2E1065] flex flex-col font-sans pb-24 lg:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-studio-border px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-studio-purple-950 leading-tight">
                Restoration & Sketch Studio
              </h1>
              <p className="text-[11px] text-purple-700/80 hidden sm:block">
                Multi-task deep learning studio with ONNX inference
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusChip
              health={health}
              loading={healthLoading}
              onRefresh={fetchHealthData}
            />
          </div>
        </div>

        {/* Desktop Tabs Header (screens >= 1024px) */}
        <div className="hidden lg:block max-w-6xl mx-auto mt-3 pt-2 border-t border-purple-100/60">
          <nav className="flex space-x-2" aria-label="Desktop Workspaces Navigation">
            {WORKSPACES.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-selected={isActive}
                  role="tab"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-100/90 to-pink-100/90 text-purple-950 shadow-sm border border-purple-200'
                      : 'text-purple-700 hover:text-purple-950 hover:bg-purple-50/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-purple-700' : 'text-purple-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Global Dismissible Error Alert */}
      {globalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-6xl mx-auto w-full px-4 pt-4"
        >
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex items-start justify-between shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Error Notice</p>
                <p className="text-rose-800 leading-relaxed">{globalError}</p>
              </div>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6" role="tabpanel">
        {activeTab === 'universal' && (
          <UniversalWorkspace samples={samples} onError={setGlobalError} />
        )}
        {activeTab === 'hard' && (
          <HardRoutedWorkspace samples={samples} onError={setGlobalError} />
        )}
        {activeTab === 'soft' && (
          <SoftMoEWorkspace samples={samples} onError={setGlobalError} />
        )}
        {activeTab === 'sketch' && (
          <FaceSketchWorkspace samples={samples} onError={setGlobalError} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (fixed on mobile, hidden on lg screens >= 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-purple-200/80 px-2 py-2 shadow-lg">
        <nav className="flex justify-around items-center" aria-label="Mobile Navigation">
          {WORKSPACES.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={isActive}
                role="tab"
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-purple-100/90 text-purple-900 font-bold'
                    : 'text-purple-600/70 hover:text-purple-900 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-purple-700' : 'text-purple-400'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
