
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, CheckCircle, ExternalLink, Timer, 
  History, Trophy, ArrowRight, Clock, Info, ShieldAlert 
} from 'lucide-react';
import { PlanningEntry, StudyPlan } from '../types';

interface DailyGoalsViewProps {
  planning: PlanningEntry[];
  plans: StudyPlan[];
  onComplete: (entryId: string, timeSpent: number) => void;
  isPaused: boolean;
  globalStudyTime: number; 
  planStudyTime: number;  
}

const DailyGoalsView: React.FC<DailyGoalsViewProps> = ({ 
  planning, plans, onComplete, isPaused, globalStudyTime, planStudyTime 
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [isPausedTimer, setIsPausedTimer] = useState(false);
  const timerRef = useRef<any>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayGoals = planning.filter(e => e.date.split('T')[0] === today);

  useEffect(() => {
    if (activeId && !isPausedTimer) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeId, isPausedTimer]);

  const formatSecs = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  };

  const formatMins = (m: number) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${hh}h ${mm}m`;
  };

  if (isPaused) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-[3rem] text-center max-w-lg shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-600 to-transparent animate-pulse" />
        <div className="flex justify-center mb-8">
          <div className="p-6 bg-red-600/10 rounded-full text-red-600 ring-4 ring-red-600/5">
            <ShieldAlert size={64} />
          </div>
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Plano em Suspensão</h2>
        <p className="text-zinc-500 text-sm leading-relaxed mb-8 font-medium">
          Você ativou o modo de pausa. O cronograma foi congelado para evitar que suas metas fiquem atrasadas durante sua ausência. Retome quando estiver pronto para a batalha.
        </p>
        <div className="inline-block px-6 py-2 bg-zinc-800 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-700">
          Modo Standby Ativo
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Linha de Frente</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">Metas priorizadas para hoje.</p>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-8 py-5 flex items-center gap-5 shadow-2xl flex-1 md:flex-none group hover:border-red-600/50 transition-all">
            <Trophy className="text-red-600 group-hover:scale-110 transition-transform" size={24} />
            <div>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Tempo Global</span>
              <span className="text-xl font-mono text-white font-black">{formatMins(globalStudyTime)}</span>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-8 py-5 flex items-center gap-5 shadow-2xl flex-1 md:flex-none group hover:border-red-600/50 transition-all">
            <Clock className="text-red-600 group-hover:scale-110 transition-transform" size={24} />
            <div>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Neste Plano</span>
              <span className="text-xl font-mono text-white font-black">{formatMins(planStudyTime)}</span>
            </div>
          </div>
        </div>
      </header>

      {activeId && (
        <div className="bg-red-600 rounded-[3.5rem] p-12 flex flex-col md:flex-row items-center justify-between shadow-[0_0_80px_rgba(220,38,38,0.25)] animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
           <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(0,0,0,0.1),transparent)] pointer-events-none" />
           <div className="flex items-center gap-10 relative z-10">
             <div className="p-8 bg-black/20 rounded-[2rem] backdrop-blur-xl border border-white/10">
                <Timer size={64} className="text-white animate-pulse" />
             </div>
             <div>
               <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Em Execução</h3>
               <p className="text-red-100 font-bold opacity-70 uppercase text-[10px] tracking-[0.3em] mt-3">Mantenha o foco absoluto.</p>
             </div>
           </div>
           <div className="flex flex-col items-center gap-8 relative z-10 mt-10 md:mt-0">
             <div className="text-8xl font-mono font-black text-white tracking-tighter drop-shadow-2xl">
               {formatSecs(seconds)}
             </div>
             <div className="flex items-center gap-4">
               <button onClick={() => setIsPausedTimer(!isPausedTimer)} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 hover:bg-zinc-100 transition-all shadow-xl">
                 {isPausedTimer ? <Play size={20} /> : <Pause size={20} />} {isPausedTimer ? 'Retomar' : 'Pausar'}
               </button>
               <button onClick={() => { onComplete(activeId, Math.floor(seconds / 60)); setActiveId(null); setSeconds(0); }} className="bg-black/20 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border border-white/20 hover:bg-black/40 transition-all">
                 Finalizar
               </button>
             </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {todayGoals.length > 0 ? todayGoals.map(entry => {
          const plan = plans.find(p => p.disciplines.some(d => d.id === entry.disciplineId));
          const discipline = plan?.disciplines.find(d => d.id === entry.disciplineId);
          const topic = discipline?.topics.find(t => t.id === entry.topicId);
          const goal = topic?.goals.find(g => g.id === entry.goalId);
          const isComp = entry.status === 'COMPLETED';

          return (
            <div key={entry.id} className={`bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 flex flex-col transition-all duration-500 ${isComp ? 'opacity-30 grayscale' : 'hover:border-red-600/40 shadow-2xl group/card'}`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-8 flex-1">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-2xl transition-transform group-hover/card:scale-105" style={{ backgroundColor: goal?.color || '#333' }}>
                    <History size={36} />
                  </div>
                  <div className="space-y-2 flex-1 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">{discipline?.name}</span>
                      <ArrowRight size={12} className="text-zinc-800" />
                      <span className="text-[10px] font-black px-3 py-1 rounded-lg bg-black text-zinc-500 border border-zinc-800 uppercase tracking-widest">{goal?.type}</span>
                    </div>
                    <h4 className="text-2xl font-black text-zinc-100 truncate uppercase tracking-tighter">{topic?.title}</h4>
                    <div className="flex items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <span className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-xl border border-zinc-800"><Clock size={14} className="text-red-500" /> {entry.durationMinutes} min planejados</span>
                      {goal?.links?.[0] && (
                        <a href={goal.links[0]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-red-600 hover:text-red-400 font-black transition-all group/link underline decoration-red-600/30 underline-offset-4">
                          <ExternalLink size={14} /> Material Externo
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 w-full md:w-auto">
                  {isComp ? (
                    <div className="flex items-center justify-center gap-3 text-green-500 font-black px-10 py-5 bg-green-500/10 rounded-2xl border border-green-500/20 uppercase text-xs tracking-widest">
                      <CheckCircle size={28} /> Missão Cumprida
                    </div>
                  ) : (
                    <button onClick={() => { setActiveId(entry.id); setSeconds(0); }} disabled={!!activeId} className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${activeId ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed border border-zinc-700' : 'bg-white text-black hover:bg-zinc-200 shadow-xl'}`}>
                      Iniciar
                    </button>
                  )}
                </div>
              </div>
              {goal?.observations && !isComp && (
                <div className="mt-8 p-6 bg-black rounded-[1.5rem] border border-zinc-800 flex gap-4 items-start animate-in zoom-in-95 duration-500">
                  <div className="p-2 bg-red-600/10 rounded-xl text-red-500 shrink-0"><Info size={20} /></div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] block mb-1">Dica Estratégica</span>
                    <p className="text-xs text-zinc-400 leading-relaxed italic">"{goal.observations}"</p>
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-800 border-2 border-dashed border-zinc-900 rounded-[4rem] bg-zinc-900/5">
             <Trophy size={100} className="opacity-10 mb-6" />
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700">Setor de Combate Limpo</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyGoalsView;
