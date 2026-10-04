import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Sparkles, GitFork, Network, Palette, AlertCircle, X, Home, ArrowLeft } from 'lucide-react';
import StatusChip from './components/StatusChip';
import LandingView from './components/LandingView';
import UniversalWorkspace from './workspaces/UniversalWorkspace';
import HardRoutedWorkspace from './workspaces/HardRoutedWorkspace';
import SoftMoEWorkspace from './workspaces/SoftMoEWorkspace';
import FaceSketchWorkspace from './workspaces/FaceSketchWorkspace';
import { checkHealth, getSamples } from './api';

const WORKSPACES = [
  { id: 'universal', name: 'Universal', label: 'Universal', icon: Sparkles },
  { id: 'hard', name: 'Hard-Routed', label: 'Hard-Routed', icon: GitFork },
  { id: 'soft', name: 'Soft-MoE', label: 'Soft-MoE', icon: Network },
  { id: 'sketch', name: 'Face-Sketch', label: 'Face-Sketch', icon: Palette },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
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

  const handleSelectWorkspace = (id) => {
    setActiveTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-[#2D2424] flex flex-col font-sans pb-24 lg:pb-12">
      {/* ── Scafos Copenhagen Warm Blush Minimalist Navbar ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-[#2D2424]/10 bg-[#F8E7E3]/90 transition-all px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          {/* Brand mark */}
          <button
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#C24B38] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-[#A63827] transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-black tracking-tight text-base sm:text-lg text-[#2D2424]">
                  Restoration & Sketch Studio
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white text-[#C24B38] border border-[#C24B38]/30">
                  v2.0
                </span>
              </div>
              <span className="hidden sm:block text-[10px] font-handwriting text-2xl text-[#C24B38] -mt-1 leading-none">
                copenhagen neural atelier
              </span>
            </div>
          </button>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main Navigation">
            <button
              onClick={() => setActiveTab('landing')}
              className={`text-xs uppercase tracking-wider font-bold pb-1 transition-all border-b-2 ${
                activeTab === 'landing'
                  ? 'border-[#C24B38] text-[#C24B38]'
                  : 'border-transparent text-[#7C6F6F] hover:text-[#2D2424]'
              }`}
            >
              Overview
            </button>
            {WORKSPACES.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectWorkspace(tab.id)}
                className={`text-xs uppercase tracking-wider font-bold pb-1 transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#C24B38] text-[#C24B38]'
                    : 'border-transparent text-[#7C6F6F] hover:text-[#2D2424]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Action: Status Chip */}
          <div className="flex items-center gap-3">
            <StatusChip health={health} loading={healthLoading} onRefresh={fetchHealthData} />
          </div>
        </div>
      </header>

      {/* Global Error Alert */}
      {globalError && (
        <div role="alert" aria-live="assertive" className="max-w-7xl mx-auto w-full px-4 pt-4">
          <div className="backdrop-blur-xl border border-rose-300 bg-rose-50/95 text-rose-900 rounded-2xl p-4 flex items-start justify-between shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold uppercase tracking-wider">Notice</p>
                <p className="text-rose-800 leading-relaxed font-medium">{globalError}</p>
              </div>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="p-1 text-rose-400 hover:text-rose-700 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb for Workspaces */}
      {activeTab !== 'landing' && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-6 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('landing')}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#7C6F6F] hover:text-[#C24B38] transition-colors py-1.5 px-3 rounded-full bg-white/70 border border-[#2D2424]/10 shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Studio Overview</span>
          </button>
          <span className="text-[11px] font-mono tracking-widest uppercase font-bold text-[#C24B38] border border-[#C24B38]/20 px-3.5 py-1 rounded-full bg-white/80 shadow-xs">
            {WORKSPACES.find(w => w.id === activeTab)?.name} Workspace
          </span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6" role="tabpanel">
        {activeTab === 'landing' && <LandingView onSelectWorkspace={handleSelectWorkspace} health={health} />}
        {activeTab === 'universal' && <UniversalWorkspace samples={samples} onError={setGlobalError} />}
        {activeTab === 'hard' && <HardRoutedWorkspace samples={samples} onError={setGlobalError} />}
        {activeTab === 'soft' && <SoftMoEWorkspace samples={samples} onError={setGlobalError} />}
        {activeTab === 'sketch' && <FaceSketchWorkspace samples={samples} onError={setGlobalError} />}
      </main>

      {/* Scafos Copenhagen Footer */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-10 pb-6 mt-12 border-t border-[#2D2424]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-[#7C6F6F]">
        <div className="flex items-center gap-2">
          <span className="font-serif font-black uppercase text-[#2D2424] tracking-widest">Restoration & Sketch Studio</span>
          <span>·</span>
          <span className="font-handwriting text-xl text-[#C24B38]">crafted with love & neural precision</span>
        </div>
        <div className="flex items-center gap-6 uppercase tracking-wider text-[10px]">
          <span>ONNX Runtime</span>
          <span>FastAPI</span>
          <span>React 18</span>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#2D2424]/10 bg-[#F8E7E3]/95 backdrop-blur-2xl px-2 py-2">
        <nav className="flex justify-around items-center" aria-label="Mobile Navigation">
          <button
            onClick={() => handleSelectWorkspace('landing')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 transition-all ${
              activeTab === 'landing' ? 'text-[#C24B38] font-black' : 'text-[#7C6F6F]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[9px] uppercase tracking-wider mt-0.5">Home</span>
          </button>
          {WORKSPACES.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectWorkspace(tab.id)}
                aria-selected={isActive}
                role="tab"
                className={`flex flex-col items-center justify-center py-1.5 px-2 transition-all ${
                  isActive ? 'text-[#C24B38] font-black' : 'text-[#7C6F6F]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] uppercase tracking-wider mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
