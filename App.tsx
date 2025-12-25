
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppMode, ExecutionStep, VisualFrame } from './types';
import { PseudoPythonTracer } from './services/tracer';
import { GeminiService } from './services/gemini';
import { Viz3DService } from './services/viz3d';
import { 
  Play, 
  Pause, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw, 
  BookOpen, 
  Zap, 
  Video, 
  Download, 
  Activity,
  Box,
  BrainCircuit,
  FileCode,
  ShieldCheck,
  Globe,
  Layers,
  Terminal,
  AlertCircle,
  Sparkles,
  Info,
  Lightbulb,
  Cpu,
  Trello
} from 'lucide-react';

declare const Plotly: any;

const SAMPLES = {
  loops: `total = 0
for i in range(3):
    total = total + i
    print(total)`,
  strings: `first = "Logic"
last = "Trace"
full = first + last
print(full)`,
  logic: `x = 10
y = 20
if x < y:
    z = x + y
    print(z)`
};

type TabId = 'player' | 'ai' | 'visuals' | 'hybrid' | 'video' | 'concepts' | 'viz3d';

export default function App() {
  const [code, setCode] = useState(SAMPLES.loops);
  const [mode, setMode] = useState<AppMode>(AppMode.AI_TUTOR);
  const [activeTab, setActiveTab] = useState<TabId>('player');
  const [trace, setTrace] = useState<ExecutionStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200); 
  const [aiExplanation, setAiExplanation] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [visualFrames, setVisualFrames] = useState<VisualFrame[]>([]);
  const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
  const [hybridDesc, setHybridDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [concept, setConcept] = useState('for loop');
  const [conceptImage, setConceptImage] = useState<string | null>(null);
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [viz3dType, setViz3dType] = useState<'flow' | 'vars' | 'struct'>('flow');

  const plotlyRef = useRef<HTMLDivElement>(null);

  // Sync 3D Viz
  useEffect(() => {
    if (activeTab === 'viz3d' && plotlyRef.current && trace.length) {
      let config: any = null;
      if (viz3dType === 'flow') config = Viz3DService.getExecutionFlowConfig(trace);
      else if (viz3dType === 'vars') config = Viz3DService.getVariableEvolutionConfig(trace);
      else config = Viz3DService.getCodeStructureConfig(code);

      if (config) {
        Plotly.newPlot(plotlyRef.current, config.data, config.layout, { responsive: true, displayModeBar: false });
      }
    }
  }, [activeTab, viz3dType, trace, code]);

  // Playback engine
  useEffect(() => {
    let timer: any;
    if (isPlaying && currentStepIdx < trace.length - 1) {
      timer = setTimeout(() => {
        setCurrentStepIdx(prev => prev + 1);
      }, speed);
    } else if (currentStepIdx >= trace.length - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStepIdx, trace.length, speed]);

  const handleStartTrace = useCallback(() => {
    const result = PseudoPythonTracer.trace(code);
    if (result.success) {
      setTrace(result.steps);
      setCurrentStepIdx(0);
      setIsPlaying(true);
      setAiExplanation('');
      setVisualFrames([]);
      setVideoUrl('');
      setActiveTab('player');
    } else {
      alert(`Tracer Error: ${result.error}`);
    }
  }, [code]);

  const handleAiExplain = async () => {
    if (!trace.length) return;
    setIsGeneratingAI(true);
    setActiveTab('ai');
    try {
      const gemini = new GeminiService();
      const explanation = await gemini.explainTrace(code, trace);
      setAiExplanation(explanation);
    } catch (err) {
      console.error(err);
      setAiExplanation("Deep reasoning currently unavailable. Please verify your Gemini API key.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleHybridView = async () => {
    if (!trace.length) return;
    setActiveTab('hybrid');
    const gemini = new GeminiService();
    const desc = await gemini.getHybridDescription(trace[currentStepIdx]);
    setHybridDesc(desc);
  };

  const handleGenerateVisuals = async () => {
    if (!trace.length) return;
    setIsGeneratingVisuals(true);
    setActiveTab('visuals');
    try {
      const gemini = new GeminiService();
      const framesToGen = trace.slice(0, 4); 
      const frames: VisualFrame[] = [];
      for (let i = 0; i < framesToGen.length; i++) {
        const url = await gemini.generateFrame(framesToGen[i], i + 1);
        frames.push({
          step: i + 1,
          imageUrl: url,
          description: framesToGen[i].reason
        });
      }
      setVisualFrames(frames);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingVisuals(false);
    }
  };

  const handleGenerateConcept = async () => {
    setIsGeneratingConcept(true);
    try {
      const gemini = new GeminiService();
      const url = await gemini.generateConceptImage(concept);
      setConceptImage(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingConcept(false);
    }
  };

  const handleGenerateVideo = async () => {
    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
    if (!hasKey) {
      setShowKeyModal(true);
      return;
    }

    setIsGeneratingVideo(true);
    setActiveTab('video');
    try {
      const gemini = new GeminiService();
      const url = await gemini.generateExplainerVideo(code, trace);
      setVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found.")) {
        setShowKeyModal(true);
      }
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const openKeySelection = async () => {
    await (window as any).aistudio?.openSelectKey();
    setShowKeyModal(false);
    handleGenerateVideo();
  };

  const currentStep = trace[currentStepIdx];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans select-none">
      
      {/* Navigation Sidebar */}
      <aside className="w-20 border-r border-slate-800 bg-slate-900/40 flex flex-col items-center py-10 gap-10 z-50">
        <div className="bg-indigo-600 p-3 rounded-2xl shadow-2xl shadow-indigo-900/40 transform hover:scale-110 transition-transform cursor-pointer">
          <BrainCircuit className="w-8 h-8 text-white" />
        </div>
        
        <nav className="flex flex-col gap-6">
          <NavItem id="player" icon={<Activity />} label="Tracer" activeTab={activeTab} onClick={setActiveTab} />
          <NavItem id="ai" icon={<Layers />} label="Tutor" activeTab={activeTab} onClick={setActiveTab} />
          <NavItem id="hybrid" icon={<Sparkles />} label="Hybrid" activeTab={activeTab} onClick={handleHybridView} />
          <NavItem id="visuals" icon={<Box />} label="Frames" activeTab={activeTab} onClick={setActiveTab} />
          <NavItem id="concepts" icon={<Lightbulb />} label="Ideas" activeTab={activeTab} onClick={setActiveTab} />
          <NavItem id="video" icon={<Video />} label="Video" activeTab={activeTab} onClick={setActiveTab} />
          <NavItem id="viz3d" icon={<Trello />} label="3D Map" activeTab={activeTab} onClick={setActiveTab} />
        </nav>

        <div className="mt-auto flex flex-col items-center gap-6">
          <button onClick={() => setMode(mode === AppMode.AI_TUTOR ? AppMode.OFFLINE : AppMode.AI_TUTOR)} className="flex flex-col items-center gap-1 group">
             {mode === AppMode.AI_TUTOR ? <Globe className="w-5 h-5 text-indigo-400" /> : <ShieldCheck className="w-5 h-5 text-amber-500" />}
             <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">{mode === AppMode.AI_TUTOR ? 'Online' : 'Offline'}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <header className="h-20 border-b border-slate-800 px-10 flex items-center justify-between bg-slate-900/10 backdrop-blur-2xl">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 to-teal-300 bg-clip-text text-transparent">LogicTrace AI</h1>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-2 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
               <Cpu className="w-3 h-3 text-indigo-400" /> Logic Engine Active
            </div>
          </div>

          <div className="flex items-center gap-3">
            {Object.keys(SAMPLES).map(s => (
              <button key={s} onClick={() => setCode(SAMPLES[s as keyof typeof SAMPLES])} className="px-4 py-1.5 bg-slate-800/40 hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-400 transition-all border border-transparent hover:border-slate-700">
                {s}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Code Editor Panel */}
          <section className="w-[440px] border-r border-slate-800 flex flex-col bg-slate-900/5">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
               <div className="flex items-center gap-2">
                 <FileCode className="w-5 h-5 text-indigo-400" />
                 <span className="text-xs font-black uppercase tracking-widest text-slate-500">Python Logic</span>
               </div>
               <button onClick={handleStartTrace} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-2xl shadow-indigo-900/40 transition-all active:scale-95 group">
                 <Zap className="w-4 h-4 fill-current group-hover:animate-pulse" /> Trace logic
               </button>
            </div>
            
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="absolute inset-0 w-full h-full bg-transparent p-10 mono text-sm leading-relaxed focus:outline-none resize-none text-slate-300 selection:bg-indigo-500/20 custom-scrollbar"
                spellCheck={false}
                placeholder="# Enter Python code here..."
              />
            </div>

            <div className="p-8 border-t border-slate-800 bg-slate-900/40 space-y-4">
               <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Educational pipeline</div>
               <div className="grid grid-cols-2 gap-3">
                  <EduButton id="ai" label="AI Tutor" icon={<BookOpen />} active={trace.length > 0} onClick={handleAiExplain} loading={isGeneratingAI} color="teal" />
                  <EduButton id="hybrid" label="Hybrid" icon={<Sparkles />} active={trace.length > 0} onClick={handleHybridView} color="amber" />
                  <EduButton id="visuals" label="Infographic" icon={<Box />} active={trace.length > 0} onClick={handleGenerateVisuals} loading={isGeneratingVisuals} color="amber" />
                  <EduButton id="viz3d" label="3D Map" icon={<Trello />} active={trace.length > 0} onClick={() => setActiveTab('viz3d')} color="indigo" />
               </div>
               <button disabled={!trace.length || isGeneratingVideo} onClick={handleGenerateVideo} className="w-full flex items-center justify-center gap-3 py-4 rounded-3xl border border-slate-700 hover:border-pink-500/50 bg-slate-800/20 hover:bg-slate-800/60 transition-all disabled:opacity-20 shadow-xl group text-slate-400">
                  <Video className="w-5 h-5 text-pink-400" />
                  <span className="text-[10px] font-black uppercase">Synthesize Walkthrough</span>
               </button>
            </div>
          </section>

          {/* Visualization Main Area */}
          <main className="flex-1 bg-[radial-gradient(circle_at_top_right,_#1e293b_0%,_#020617_70%)] overflow-y-auto p-12 custom-scrollbar relative">
            
            {activeTab === 'player' && (
              <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <DashboardHeader title="Execution Tracer" icon={<Activity className="text-indigo-400" />} subtitle="Observing memory state and causal logic flow" />

                <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm">
                  {trace.length > 0 && (
                    <div className="h-1.5 w-full bg-slate-800">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_10px_#6366f1]" 
                        style={{ width: `${((currentStepIdx + 1) / trace.length) * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="p-12 space-y-12">
                    {currentStep && <ReasoningBubble reason={currentStep.reason} />}
                    <CodeViewer code={code} currentStep={currentStep} />
                    <VariableMatrix currentStep={currentStep} />
                  </div>
                  <PlayerControls isPlaying={isPlaying} setIsPlaying={setIsPlaying} currentStepIdx={currentStepIdx} totalSteps={trace.length} setCurrentStepIdx={setCurrentStepIdx} />
                </div>
                <ConsoleOutput currentStep={currentStep} />
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
                 <DashboardHeader title="AI Tutor Analysis" icon={<BookOpen className="text-teal-400" />} subtitle="Personalized causal reasoning from Gemini 3 Flash" />
                 <div className="bg-slate-900/40 border border-slate-800 rounded-[3.5rem] p-16 shadow-2xl backdrop-blur-sm">
                  {isGeneratingAI ? <PulseLoader /> : aiExplanation ? <MarkdownView text={aiExplanation} /> : <EmptyState icon={<Layers className="text-slate-700" />} message="Trace code logic first to initialize AI Reasoning." />}
                </div>
              </div>
            )}

            {activeTab === 'hybrid' && (
              <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
                <DashboardHeader title="Hybrid Visuals" icon={<Sparkles className="text-amber-400" />} subtitle="Local rendering enhanced by AI metaphors" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="bg-slate-900/60 border border-slate-800 rounded-[3rem] p-10 flex flex-col items-center justify-center gap-10 shadow-2xl min-h-[500px]">
                      <div className="relative group">
                        <div className="w-40 h-40 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform duration-700">
                           {currentStep?.code.includes('for') ? <RotateCcw className="w-20 h-20 text-amber-500" /> : <Zap className="w-20 h-20 text-amber-400" />}
                        </div>
                      </div>
                      <div className="text-center space-y-4">
                        <h4 className="text-2xl font-black text-white">{currentStep?.action}</h4>
                        <div className="flex flex-wrap justify-center gap-3">
                          {currentStep && Object.entries(currentStep.variables).map(([k,v]) => (
                            <div key={k} className="bg-slate-800 px-4 py-2 rounded-xl text-xs font-bold text-slate-400">
                               {k}: <span className="text-amber-400">{JSON.stringify(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                   </div>
                   <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] p-12 flex flex-col gap-8">
                      <div className="flex items-center gap-4"><Info className="w-6 h-6 text-amber-400" /><h3 className="text-xl font-bold uppercase text-slate-500">Metaphor</h3></div>
                      <p className="text-2xl text-slate-300 italic border-l-4 border-amber-500/30 pl-8 py-4">{hybridDesc || "Click Hybrid in sidebar."}</p>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'visuals' && (
              <div className="max-w-6xl mx-auto space-y-12">
                 <DashboardHeader title="Infographic Frames" icon={<Box className="text-amber-400" />} subtitle="Nano Banana engine sequence" />
                 {isGeneratingVisuals ? <FrameLoader /> : visualFrames.length > 0 ? <FrameGallery frames={visualFrames} /> : <EmptyState icon={<Box className="text-amber-500/20" />} message="Render logic cards to see Nano Banana output." />}
              </div>
            )}

            {activeTab === 'concepts' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <DashboardHeader title="Concept Explainer" icon={<Lightbulb className="text-amber-300" />} subtitle="Visualizing abstract programming ideas" />
                <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] p-12 flex flex-col gap-10">
                  <div className="flex gap-4">
                    <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="e.g. for loop, recursion, class" className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-amber-500 transition-all" />
                    <button onClick={handleGenerateConcept} disabled={isGeneratingConcept} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all">{isGeneratingConcept ? 'Thinking...' : 'Visualize'}</button>
                  </div>
                  {isGeneratingConcept ? <PulseLoader /> : conceptImage && <img src={conceptImage} className="w-full rounded-[2.5rem] shadow-2xl" />}
                </div>
              </div>
            )}

            {activeTab === 'video' && (
               <div className="max-w-4xl mx-auto space-y-12">
                  <DashboardHeader title="Veo 3 Walkthrough" icon={<Video className="text-pink-400" />} subtitle="Cinematic logic synthesis" />
                  {isGeneratingVideo ? <VideoSynthesisLoader /> : videoUrl ? <VideoResultView url={videoUrl} /> : <EmptyState icon={<Video className="text-pink-400/20" />} message="Initialize the Veo 3 engine for a cinematic explainer." />}
               </div>
            )}

            {activeTab === 'viz3d' && (
               <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
                  <DashboardHeader title="3D Logic Topology" icon={<Trello className="text-indigo-400" />} subtitle="Experimental spatial reasoning map" />
                  <div className="flex gap-4 mb-8">
                     <button onClick={() => setViz3dType('flow')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viz3dType === 'flow' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>🌊 Flow</button>
                     <button onClick={() => setViz3dType('vars')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viz3dType === 'vars' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>📊 Variables</button>
                     <button onClick={() => setViz3dType('struct')} className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viz3dType === 'struct' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>🏗️ Structure</button>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 rounded-[3rem] overflow-hidden p-4 shadow-2xl backdrop-blur-sm min-h-[600px] flex items-center justify-center">
                    {trace.length ? <div ref={plotlyRef} className="w-full h-[600px]" /> : <EmptyState icon={<Trello className="text-indigo-500/20" />} message="Trace code logic to generate 3D spatial models." />}
                  </div>
               </div>
            )}
          </main>
        </div>

        {/* System Footer */}
        <footer className="h-14 border-t border-slate-800 bg-slate-950/90 backdrop-blur-2xl px-12 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.3em] text-slate-600 z-50">
           <div className="flex items-center gap-12">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${trace.length ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`} /> 
                Tracer: {trace.length ? 'Ready' : 'Idle'}
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full transition-all duration-700 ${isGeneratingAI ? 'bg-teal-500 animate-pulse shadow-[0_0_12px_#14b8a6]' : 'bg-slate-800'}`} /> 
                AI Core: {isGeneratingAI ? 'Busy' : 'Standby'}
              </div>
           </div>
           <div>LogicTrace AI Studio v3.4.2</div>
        </footer>
      </div>

      {/* Key Selection Modal */}
      {showKeyModal && <KeySelectionModal onOpen={openKeySelection} onClose={() => setShowKeyModal(false)} />}
    </div>
  );
}

// --- Component Helpers ---

function NavItem({ id, icon, label, activeTab, onClick }: { id: TabId, icon: React.ReactNode, label: string, activeTab: TabId, onClick: (id: TabId) => void }) {
  return (
    <button onClick={() => onClick(id)} className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-1 ${activeTab === id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`} title={label}>
      {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function EduButton({ id, label, icon, active, onClick, loading, color }: { id: string, label: string, icon: React.ReactNode, active: boolean, onClick: () => void, loading?: boolean, color: string }) {
  const colorMap: Record<string, string> = {
    teal: "text-teal-400 border-teal-500/30 hover:bg-teal-500/10",
    amber: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10",
    indigo: "text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
  };
  return (
    <button disabled={!active || loading} onClick={onClick} className={`flex flex-col items-center gap-2 py-4 rounded-2xl border bg-slate-800/20 transition-all disabled:opacity-20 ${colorMap[color] || ""}`}>
      {loading ? <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" /> : React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
      <span className="text-[9px] font-black uppercase">{label}</span>
    </button>
  );
}

function DashboardHeader({ title, icon, subtitle }: { title: string, icon: React.ReactNode, subtitle: string }) {
  return (
    <div className="flex items-center gap-6">
      <div className="p-4 bg-slate-900 rounded-[1.5rem] shadow-2xl border border-slate-800">{React.cloneElement(icon as React.ReactElement<any>, { className: "w-10 h-10" })}</div>
      <div>
        <h2 className="text-4xl font-black text-white tracking-tighter">{title}</h2>
        <p className="text-base text-slate-500 font-bold mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function ReasoningBubble({ reason }: { reason: string }) {
  return (
    <div className="flex gap-8 p-10 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 shadow-2xl animate-in zoom-in-95 duration-500">
      <div className="bg-indigo-600 p-5 rounded-3xl h-fit shadow-2xl shadow-indigo-900/40"><BrainCircuit className="w-10 h-10 text-white" /></div>
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Step reasoning (THE WHY)</h4>
        <p className="text-2xl text-indigo-50 font-medium leading-relaxed italic">"{reason}"</p>
      </div>
    </div>
  );
}

function CodeViewer({ code, currentStep }: { code: string, currentStep: any }) {
  return (
    <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 font-mono text-lg space-y-3 shadow-inner relative overflow-hidden group">
      {code.split('\n').map((line, idx) => (
        <div key={idx} className={`flex gap-10 px-8 py-3.5 rounded-2xl transition-all duration-500 ${currentStep?.lineNo === idx + 1 ? 'bg-indigo-500/20 text-indigo-50 ring-2 ring-indigo-500/30 shadow-2xl' : 'text-slate-700 opacity-40 group-hover:opacity-60'}`}>
          <span className="w-10 text-right select-none font-black text-slate-800">{idx + 1}</span>
          <span className="flex-1 whitespace-pre-wrap">{line}</span>
          {currentStep?.lineNo === idx + 1 && <Zap className="w-6 h-6 text-indigo-400 animate-pulse fill-current" />}
        </div>
      ))}
    </div>
  );
}

function VariableMatrix({ currentStep }: { currentStep: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {currentStep && Object.entries(currentStep.variables).map(([name, val]) => (
        <div key={name} className="bg-slate-800/30 border border-slate-700 p-8 rounded-[2rem] group hover:border-indigo-500/50 transition-all shadow-xl relative overflow-hidden active:scale-95">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-100 transition-opacity transform group-hover:scale-125 duration-700"><Box className="w-20 h-20 text-indigo-400" /></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-tighter mb-4 block">Memory: {name}</span>
          <div className="text-4xl font-black font-mono text-indigo-400 truncate tracking-tighter">{JSON.stringify(val)}</div>
        </div>
      ))}
    </div>
  );
}

function PlayerControls({ isPlaying, setIsPlaying, currentStepIdx, totalSteps, setCurrentStepIdx }: { isPlaying: boolean, setIsPlaying: any, currentStepIdx: number, totalSteps: number, setCurrentStepIdx: any }) {
  return (
    <div className="p-12 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center gap-16">
      <button onClick={() => { setCurrentStepIdx(0); setIsPlaying(false); }} className="p-5 text-slate-600 hover:text-white transition-all transform hover:scale-110"><RotateCcw className="w-10 h-10" /></button>
      <button onClick={() => setIsPlaying(!isPlaying)} className="w-28 h-28 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 hover:scale-110">{isPlaying ? <Pause className="w-14 h-14" /> : <Play className="w-14 h-14 translate-x-1" />}</button>
      <div className="flex gap-6">
        <button onClick={() => { setIsPlaying(false); setCurrentStepIdx((p: any) => Math.max(0, p - 1)); }} className="p-5 text-slate-600 hover:text-white transition-all"><ChevronLeft className="w-12 h-12" /></button>
        <button onClick={() => { setIsPlaying(false); setCurrentStepIdx((p: any) => Math.min(p + 1, totalSteps - 1)); }} className="p-5 text-slate-600 hover:text-white transition-all"><ChevronRight className="w-12 h-12" /></button>
      </div>
    </div>
  );
}

function ConsoleOutput({ currentStep }: { currentStep: any }) {
  return (
    <div className="bg-black border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
      <div className="px-10 py-5 bg-slate-900/80 border-b border-slate-800 flex items-center gap-4"><Terminal className="w-6 h-6 text-emerald-400" /><span className="text-xs font-black uppercase text-slate-500">Console</span></div>
      <div className="p-10 h-64 overflow-y-auto font-mono text-xl custom-scrollbar">
        {currentStep?.output.map((line: any, i: any) => (
          <div key={i} className="text-emerald-400 flex gap-8 mb-4 animate-in fade-in slide-in-from-left-4 duration-500"><span className="text-slate-800 select-none font-bold min-w-[3rem]">[{i+1}]</span><span className="font-bold">{`>> ${line}`}</span></div>
        )) || <span className="text-slate-800 italic font-bold">Standard output idle...</span>}
      </div>
    </div>
  );
}

function MarkdownView({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-teal max-w-none text-slate-200 text-xl leading-relaxed">
      {text.split('\n').map((line, i) => <p key={i} className={`${line.startsWith('#') ? 'text-teal-400 font-black text-3xl mb-10' : 'mb-8'}`}>{line}</p>)}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode, message: string }) {
  return (
    <div className="py-32 text-center flex flex-col items-center gap-10 opacity-30">
      {React.cloneElement(icon as React.ReactElement<any>, { className: "w-24 h-24" })}
      <p className="text-xl text-slate-700 font-bold max-w-xs mx-auto leading-relaxed">{message}</p>
    </div>
  );
}

function PulseLoader() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="h-6 bg-slate-800 rounded w-full" />
      <div className="h-6 bg-slate-800 rounded w-11/12" />
      <div className="h-6 bg-slate-800 rounded w-10/12" />
      <div className="h-6 bg-slate-800 rounded w-full" />
    </div>
  );
}

function FrameLoader() {
  return (
    <div className="grid grid-cols-2 gap-12">
      {[1,2,3,4].map(i => <div key={i} className="aspect-video bg-slate-900/60 rounded-[3.5rem] animate-pulse border border-slate-800" />)}
    </div>
  );
}

function FrameGallery({ frames }: { frames: VisualFrame[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
      {frames.map((f, i) => (
        <div key={i} className="group relative bg-slate-900 border border-slate-800 rounded-[3.5rem] overflow-hidden hover:border-amber-500/40 transition-all transform hover:-translate-y-3 shadow-2xl">
           <img src={f.imageUrl} className="w-full opacity-90 group-hover:opacity-100 transition-opacity" />
           <div className="p-10 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-800">
              <div className="flex items-center justify-between mb-4"><div className="text-sm font-black uppercase text-amber-400">Step {f.step}</div><Download className="w-7 h-7 text-slate-500 cursor-pointer" /></div>
              <p className="text-lg text-slate-300 italic leading-relaxed">"{f.description}"</p>
           </div>
        </div>
      ))}
    </div>
  );
}

function VideoSynthesisLoader() {
  return (
    <div className="aspect-video bg-slate-900/40 border border-slate-800 rounded-[4rem] flex flex-col items-center justify-center p-20 text-center gap-12 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-transparent animate-pulse" />
       <div className="w-32 h-32 border-[8px] border-pink-500/10 border-t-pink-500 rounded-full animate-spin" />
       <div className="space-y-4 relative"><h4 className="text-3xl font-black text-pink-400 uppercase">Veo 3 Synthesis Active</h4><p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">Animating memory transitions and narration sync. This requires 2-3 minutes of compute time.</p></div>
    </div>
  );
}

function VideoResultView({ url }: { url: string }) {
  return (
    <div className="space-y-12 animate-in fade-in zoom-in-95 duration-1000">
       <div className="p-4 bg-slate-800 rounded-[4rem] shadow-2xl border border-pink-500/20"><video src={url} controls className="w-full rounded-[3.5rem] shadow-2xl" /></div>
       <div className="bg-slate-900/60 border border-slate-800 p-12 rounded-[3rem] flex items-center justify-between backdrop-blur-xl">
          <div className="flex gap-8"><div className="p-6 bg-pink-500/10 rounded-[2rem]"><Zap className="w-10 h-10 text-pink-400 fill-current" /></div><div><h5 className="text-2xl font-black text-white">Movie Complete</h5><p className="text-base text-slate-500 font-medium">Holographic Visuals | Causal Subtitles | 720p HD</p></div></div>
          <a href={url} download className="flex items-center gap-4 bg-pink-600 hover:bg-pink-500 text-white px-12 py-5 rounded-3xl font-black text-xl transition-all shadow-2xl active:scale-95 transform hover:-translate-y-1"><Download className="w-6 h-6" /> Export</a>
       </div>
    </div>
  );
}

function KeySelectionModal({ onOpen, onClose }: { onOpen: () => void, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="bg-slate-900 border border-slate-800 rounded-[4rem] max-w-xl w-full p-20 shadow-2xl">
         <div className="bg-pink-600/20 p-10 rounded-[3rem] w-fit mb-12"><AlertCircle className="w-16 h-16 text-pink-500" /></div>
         <h2 className="text-5xl font-black mb-8 text-white tracking-tighter">Paid Account Required</h2>
         <p className="text-slate-400 mb-16 leading-relaxed text-2xl font-medium">Walkthrough synthesis with <span className="text-pink-400 underline font-black decoration-pink-500/50">Veo 3</span> requires an API key associated with a paid Google Cloud project.</p>
         <div className="flex flex-col gap-6">
            <button onClick={onOpen} className="w-full bg-pink-600 hover:bg-pink-500 py-7 rounded-[2.5rem] font-black text-3xl shadow-2xl transition-all active:scale-95">Link Paid Account</button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-center text-sm font-black text-slate-500 hover:text-indigo-400 tracking-widest transition-all">Review Billing Terms & Conditions</a>
            <button onClick={onClose} className="mt-8 text-slate-700 font-black text-xs uppercase tracking-[0.4em] hover:text-slate-500 transition-colors">Cancel</button>
         </div>
      </div>
    </div>
  );
}
