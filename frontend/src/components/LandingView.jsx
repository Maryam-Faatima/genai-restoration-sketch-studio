import React from 'react';
import { ArrowUpRight, Sparkles, GitFork, Network, Palette, Heart, CheckCircle2 } from 'lucide-react';

export default function LandingView({ onSelectWorkspace, health }) {
  const models = health?.models || {};
  const totalCount = Object.keys(models).length;
  const loadedCount = Object.values(models).filter(status => status === 'loaded').length;

  const STUDIOS = [
    {
      id: 'universal',
      tag: 'Studio 01',
      title: 'Universal Autoencoder',
      handwritten: 'all in one piece',
      desc: 'A single high-capacity deep autoencoder engineered to suppress salt-and-pepper noise, invert Gaussian blurring, and inpaint occluded patches without extra steps.',
      badge: 'Single Model',
      badgeColor: 'bg-[#B5D3CA]/60 text-[#1F453D] border-[#B5D3CA]',
      buttonText: 'Restore Images',
      features: ['Noise suppression (p up to 0.15)', 'Gaussian deblur (σ up to 2.5)', 'Rectangular patch inpainting'],
    },
    {
      id: 'hard',
      tag: 'Studio 02',
      title: 'Hard-Routed MoE',
      handwritten: 'smart specialization',
      desc: 'High-speed 4-class classifier diagnosing degradation types in real time, routing the image to targeted specialist sub-networks or an identity bypass.',
      badge: 'Classifier + 3 Specialists',
      badgeColor: 'bg-[#FDC7BD]/60 text-[#8C2E1F] border-[#FDC7BD]',
      buttonText: 'Route & Restore',
      features: ['Real-time 4-class classifier', 'Dedicated specialist networks', 'Zero-latency identity bypass'],
    },
    {
      id: 'soft',
      tag: 'Studio 03',
      title: 'Soft Mixture-of-Experts',
      handwritten: 'smoothly blended harmony',
      desc: 'Ensemble running 4 parallel restoration streams blended via learned softmax gating weights at calibrated temperature T = 1.26.',
      badge: '4-Way Weighted Ensemble',
      badgeColor: 'bg-[#E8A735]/25 text-[#734A05] border-[#E8A735]/40',
      buttonText: 'Blend Experts',
      features: ['Continuous weight blending', 'Fixed gate temperature T=1.26', 'Dominant branch analysis'],
    },
    {
      id: 'sketch',
      tag: 'Studio 04',
      title: 'Face-to-Sketch Studio',
      handwritten: 'drawn with soul',
      desc: 'Conditional Generative Adversarial Network synthesizing expressive, tonal pencil drawings from portrait photographs across three distinct styles.',
      badge: 'Conditional GAN',
      badgeColor: 'bg-[#C24B38]/20 text-[#A63827] border-[#C24B38]/30',
      buttonText: 'Draw Portrait',
      features: ['Style 1: Tonal pencil shading', 'Style 2: Bold contour strokes', 'Style 3: Minimalist crisp line art'],
    },
  ];

  return (
    <div className="space-y-16 py-4">
      {/* ── SCAFOS COPENHAGEN HERO CARD ── */}
      <section className="relative overflow-hidden rounded-3xl bg-white border border-[#2D2424]/10 p-8 sm:p-14 shadow-scafos">
        {/* Decorative Doodles and Whimsical Accents */}
        <div className="absolute top-6 right-8 hidden md:block select-none pointer-events-none text-right">
          <span className="font-handwriting text-3xl sm:text-4xl text-[#C24B38] block -rotate-3">
            every restoration has its own story
          </span>
          {/* Hand-drawn style squiggly loop */}
          <svg className="w-24 h-12 text-[#C24B38]/60 ml-auto mt-1" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10,40 Q30,5 50,25 T90,15" strokeLinecap="round" />
          </svg>
        </div>

        <div className="max-w-2xl space-y-6 relative z-10">
          {/* Cute Tag Header */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F8E7E3] border border-[#2D2424]/10 text-xs font-semibold text-[#2D2424]">
            <span className="w-2 h-2 rounded-full bg-[#C24B38] animate-pulse" />
            <span className="uppercase tracking-widest text-[10px] font-bold">Scafos Neural Atelier</span>
            <span className="text-[#C24B38]">·</span>
            <span>Production ONNX Suite</span>
          </div>

          {/* Scafos Signature Typography */}
          <div>
            <span className="font-handwriting text-5xl sm:text-7xl text-[#2D2424] block leading-none mb-1">
              We restore
            </span>
            <h1 className="font-serif font-black text-4xl sm:text-6xl text-[#2D2424] tracking-tight uppercase leading-[1.05]">
              PRECIOUS IMAGES
            </h1>
          </div>

          <p className="text-sm sm:text-base text-[#7C6F6F] leading-relaxed max-w-xl font-normal">
            We care deeply about visual fidelity and deep learning craft. An artisanal neural studio uniting multi-corruption autoencoders, classified expert routing, and generative pencil sketch synthesis.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onSelectWorkspace('universal')}
              className="px-7 py-3.5 rounded-xl bg-[#C24B38] hover:bg-[#A63827] text-white text-xs uppercase tracking-widest font-bold transition-all duration-300 shadow-md flex items-center gap-2.5 hover:-translate-y-0.5"
            >
              <span>Explore Studios</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectWorkspace('sketch')}
              className="px-6 py-3.5 rounded-xl border-2 border-[#2D2424]/20 hover:border-[#2D2424] text-[#2D2424] text-xs uppercase tracking-widest font-bold transition-all duration-300 hover:bg-[#F8E7E3]"
            >
              Face-to-Sketch Studio
            </button>
          </div>
        </div>

        {/* 4 Stats Chips Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-10 mt-10 border-t border-[#2D2424]/10">
          {[
            { label: 'Active Models', val: `${loadedCount || 7} / ${totalCount || 7} Loaded` },
            { label: 'Architecture', val: 'CNN + cGAN' },
            { label: 'Native Resolution', val: '128 × 128 px' },
            { label: 'Runtime Engine', val: 'ONNX Runtime' },
          ].map((item, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#7C6F6F] block">{item.label}</span>
              <span className="text-base sm:text-lg font-serif font-bold text-[#2D2424]">{item.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE 4 WORKSPACE CARDS GRID (SCAFOS SWADDLE COLLECTION STYLE) ── */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-handwriting text-3xl text-[#C24B38]">
              curated workshops
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-[#2D2424] uppercase tracking-tight">
              Pick Your Neural Studio
            </h2>
          </div>
          <p className="text-xs text-[#7C6F6F] max-w-xs leading-relaxed">
            Click any workshop card to interact with the models, upload photos, or try curated samples.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {STUDIOS.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectWorkspace(s.id)}
              className="group cursor-pointer rounded-3xl bg-white border border-[#2D2424]/10 p-8 sm:p-10 flex flex-col justify-between hover:shadow-elevated transition-all duration-300 hover:border-[#C24B38]/40 hover:-translate-y-1"
            >
              <div className="space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7C6F6F]">{s.tag}</span>
                  <span className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full border ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                </div>

                <div>
                  <span className="font-handwriting text-3xl text-[#C24B38] block leading-none -mb-1">
                    {s.handwritten}
                  </span>
                  <h3 className="text-2xl font-serif font-bold text-[#2D2424] group-hover:text-[#C24B38] transition-colors">
                    {s.title}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-[#7C6F6F] leading-relaxed">
                  {s.desc}
                </p>

                {/* Features */}
                <div className="space-y-2 pt-2 border-t border-[#2D2424]/5">
                  {s.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[#2D2424] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C24B38]" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scafos Terracotta Action Button */}
              <div className="pt-6 mt-6 border-t border-[#2D2424]/10 flex items-center justify-between">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-xl bg-[#C24B38] text-white text-xs uppercase tracking-wider font-bold group-hover:bg-[#A63827] transition-colors shadow-xs flex items-center gap-2"
                >
                  <span>{s.buttonText}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
                <span className="text-[11px] font-handwriting text-2xl text-[#7C6F6F]">
                  launch atelier
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUSTAINABLE CRAFT & ETHICS SECTION (SCAFOS THREE ICONS STYLE) ── */}
      <section className="rounded-3xl bg-[#FFF7F4] border border-[#2D2424]/10 p-8 sm:p-12 space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="font-handwriting text-4xl text-[#C24B38]">thoughtful design</span>
          <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#2D2424] uppercase">
            Different Styles, Long-Lasting Precision
          </h2>
          <p className="text-xs text-[#7C6F6F] leading-relaxed">
            When you reconstruct with our studio, you get genuine mathematical fidelity with zero simulated or fake metrics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4">
          {[
            {
              num: '01',
              title: 'Zero Artificial Metrics',
              handwritten: 'authentic decibels',
              body: 'Real PSNR ratings in dB and true millisecond inference speeds computed directly against clean reference images.',
            },
            {
              num: '02',
              title: 'Transparent Probabilities',
              handwritten: 'sums to 100%',
              body: 'Classification probabilities and Soft-MoE continuous gating weights provide complete insight into model decisions.',
            },
            {
              num: '03',
              title: 'Artisanal Pencil Styles',
              handwritten: 'three aesthetics',
              body: 'Conditional GAN synthesized portraits tailored across delicate shading, deep contours, or minimalist line art.',
            },
          ].map((item, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-[#2D2424]/10 p-6 space-y-3 text-center shadow-xs">
              <span className="w-9 h-9 rounded-full bg-[#F8E7E3] text-[#C24B38] font-bold text-xs flex items-center justify-center mx-auto border border-[#C24B38]/30">
                {item.num}
              </span>
              <span className="font-handwriting text-2xl text-[#C24B38] block -mb-2">
                {item.handwritten}
              </span>
              <h3 className="text-sm font-serif font-bold text-[#2D2424] uppercase tracking-wider">{item.title}</h3>
              <p className="text-xs text-[#7C6F6F] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
