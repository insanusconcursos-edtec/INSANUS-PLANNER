
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  ExternalLink, 
  Timer, 
  History, 
  Trophy,
  ArrowRight,
  Clock
} from 'lucide-react';
import { PlanningEntry, StudyPlan, GoalType } from '../types';

interface DailyGoalsViewProps {
  planning: PlanningEntry[];
  plans: StudyPlan[];
  onComplete: (entryId: string, timeSpent: number) => void;
}

const DailyGoalsView: React.FC<DailyGoalsViewProps> = ({ planning, plans, onComplete }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // Fixed: Cannot find namespace 'NodeJS', using ReturnType of setInterval instead.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayGoals = planning.filter(e => e.date.split('T')[0] === today);

  useEffect(() => {
    if (activeId && !isPaused) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeId, isPaused]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startGoal = (id: string) => {
    if (activeId === id) return;
    setActiveId(id);
    setSeconds(0);
    setIsPaused(false);
  };

  const finishGoal = (id: string) => {
    onComplete(id, Math.floor(seconds / 60));
    setActiveId(null);
    setSeconds(0);
    setIsPaused(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white">Metas de Hoje</h2>
          <p className="text-zinc-400">Mantenha o foco. O sucesso é a soma de pequenos esforços.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-xl">
           <div className="flex flex-col items-center">
             <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Tempo Total</span>
             <span className="text-xl font-mono text-white font-bold">{formatTime(todayGoals.filter(g => g.status === 'COMPLETED').reduce((acc, curr) => acc + (curr.actualTimeSpent || 0) * 60, 0))}</span>
           </div>
           <div className="h-8 w-px bg-zinc-800" />
           <div className="flex flex-col items-center">
             <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Metas Concluídas</span>
             <span className="text-xl text-red-500 font-bold">{todayGoals.filter(g => g.status === 'COMPLETED').length}/{todayGoals.length}</span>
           </div>
        </div>
      </header>

      {/* Active Timer Box */}
      {activeId && (
        <div className="bg-red-600 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse-slow">
           <div className="flex items-center gap-6 mb-6 md:mb-0">
             <div className="p-4 bg-white/10 rounded-2xl">
                <Timer size={48} className="text-white" />
             </div>
             <div>
               <h3 className="text-2xl font-bold text-white">Sessão em Andamento</h3>
               <p className="text-red-100 opacity-80">Você está estudando agora!</p>
             </div>
           </div>
           
           <div className="flex flex-col items-center gap-4">
             <div className="text-6xl font-mono font-bold text-white tracking-tighter">
               {formatTime(seconds)}
             </div>
             <div className="flex items-center gap-3">
               <button 
                onClick={() => setIsPaused(!isPaused)}
                className="bg-white text-red-600 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-100 transition-all"
               >
                 {isPaused ? <Play size={18} /> : <Pause size={18} />} {isPaused ? 'Retomar' : 'Pausar'}
               </button>
               <button 
                onClick={() => finishGoal(activeId)}
                className="bg-black/20 text-white px-6 py-2 rounded-xl font-bold border border-white/20 hover:bg-black/30 transition-all"
               >
                 Concluir Meta
               </button>
             </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {todayGoals.length > 0 ? todayGoals.map(entry => {
          const plan = plans.find(p => p.disciplines.some(d => d.id === entry.disciplineId));
          const discipline = plan?.disciplines.find(d => d.id === entry.disciplineId);
          const topic = discipline?.topics.find(t => t.id === entry.topicId);
          const goal = topic?.goals.find(g => g.id === entry.goalId);
          const isCompleted = entry.status === 'COMPLETED';

          return (
            <div 
              key={entry.id} 
              className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all ${isCompleted ? 'opacity-50 grayscale' : 'hover:border-zinc-700 shadow-lg'}`}
            >
              <div className="flex items-center gap-6 w-full">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg"
                  style={{ backgroundColor: goal?.color || '#333' }}
                >
                  <History size={24} />
                </div>
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{discipline?.name}</span>
                    <ArrowRight size={10} className="text-zinc-700" />
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 uppercase">{goal?.type}</span>
                  </div>
                  <h4 className="text-lg font-bold text-zinc-100 truncate">{topic?.title}</h4>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    {/* Fixed: Clock missing name fixed by adding import */}
                    <span className="flex items-center gap-1"><Clock size={12} /> {entry.durationMinutes} minutos planejados</span>
                    {goal?.links?.[0] && (
                      <a href={goal.links[0]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-500 hover:text-red-400 font-bold transition-all">
                        <ExternalLink size={12} /> Ver Material
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-green-500 font-bold px-4 py-2 bg-green-500/10 rounded-xl border border-green-500/20">
                    <CheckCircle size={20} /> Concluída
                  </div>
                ) : (
                  <button 
                    onClick={() => startGoal(entry.id)}
                    disabled={!!activeId}
                    className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${!!activeId ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'}`}
                  >
                    <Play size={20} /> Iniciar Meta
                  </button>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl">
             <Trophy size={64} className="mb-4 opacity-20" />
             <p className="text-lg">Nenhuma meta para hoje. Que tal descansar ou adiantar o planejamento?</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyGoalsView;
