
import React from 'react';
import { StudyPlan, UserRoutine, UserProfile } from '../types';
import { WEEK_DAYS } from '../constants';
import { Clock, User, Zap, BookOpen, Pause, Play, RefreshCw, AlertTriangle } from 'lucide-react';

interface RoutineViewProps {
  plans: StudyPlan[];
  routine: UserRoutine;
  updateRoutine: (r: UserRoutine) => void;
  onGeneratePlanning: () => void;
  onTogglePause: () => void;
  onRestartPlan: () => void;
}

const RoutineView: React.FC<RoutineViewProps> = ({ plans, routine, updateRoutine, onGeneratePlanning, onTogglePause, onRestartPlan }) => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom duration-500">
      <header>
        <h2 className="text-3xl font-bold text-white">Sua Rotina</h2>
        <p className="text-zinc-400">Configure como e quando você pode estudar.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile & Plan Section */}
        <section className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <User size={18} className="text-red-500" /> Perfil de Estudante
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as UserProfile[]).map(p => (
                <button
                  key={p}
                  onClick={() => updateRoutine({ ...routine, profile: p })}
                  className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                    routine.profile === p ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {p === 'BEGINNER' ? 'Iniciante' : p === 'INTERMEDIATE' ? 'Intermediário' : 'Avançado'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BookOpen size={18} className="text-red-500" /> Selecione seu Plano
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => updateRoutine({ ...routine, selectedPlanId: plan.id })}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl border transition-all ${
                    routine.selectedPlanId === plan.id ? 'bg-red-900/20 border-red-600' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
                  }`}
                >
                  <img src={plan.imageUrl} alt={plan.name} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="text-left">
                    <div className={`font-bold text-sm ${routine.selectedPlanId === plan.id ? 'text-white' : 'text-zinc-400'}`}>{plan.name}</div>
                    <div className="text-[10px] text-zinc-600">{plan.disciplines.length} Disciplinas inclusas</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={onGeneratePlanning}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:scale-[1.02]"
            >
              <Zap size={20} /> Replanejar / Sincronizar Calendário
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onTogglePause}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-xs uppercase transition-all border ${
                  routine.isPaused 
                    ? 'bg-green-600/10 border-green-600 text-green-500 hover:bg-green-600/20' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {routine.isPaused ? <Play size={16} /> : <Pause size={16} />}
                {routine.isPaused ? 'Retomar Plano' : 'Pausar Plano'}
              </button>
              
              <button 
                onClick={onRestartPlan}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-xs uppercase bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-red-600/10 hover:border-red-600 hover:text-red-500 transition-all group"
              >
                <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                Reiniciar Plano
              </button>
            </div>
            
            {routine.isPaused && (
              <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-1" size={16} />
                <p className="text-[10px] text-red-200 font-medium">Seu plano está atualmente PAUSADO. As metas não aparecerão no planejamento nem nas metas diárias até que você o retome.</p>
              </div>
            )}
          </div>
        </section>

        {/* Weekly Hours Section */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl h-fit">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock size={18} className="text-red-500" /> Disponibilidade Diária
          </h3>
          <div className="space-y-4">
            {WEEK_DAYS.map(day => (
              <div key={day.id} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-zinc-400 w-24">{day.name}</span>
                <div className="flex-1 h-1 bg-zinc-800 rounded-full relative overflow-hidden">
                  <div 
                    className="absolute h-full bg-red-600 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (routine.days[day.id] || 0) / 4.8)}%` }} 
                  />
                </div>
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                  <input 
                    type="number"
                    value={Math.round((routine.days[day.id] || 0) / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value) * 60;
                      updateRoutine({ ...routine, days: { ...routine.days, [day.id]: mins } });
                    }}
                    className="w-8 bg-transparent text-center text-white font-mono font-bold outline-none"
                    min="0"
                    max="24"
                  />
                  <span className="text-[10px] text-zinc-600 font-bold">HORAS</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RoutineView;
