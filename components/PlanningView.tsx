
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, List, ShieldAlert } from 'lucide-react';
import { PlanningEntry, StudyPlan } from '../types';

interface PlanningViewProps {
  planning: PlanningEntry[];
  plans: StudyPlan[];
  isPaused?: boolean;
}

const PlanningView: React.FC<PlanningViewProps> = ({ planning, plans, isPaused = false }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    }
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getWeekRange = () => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  };

  const renderMonthCells = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const cells = [];

    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-32 bg-zinc-950/20 border-r border-b border-zinc-800/50"></div>);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayEntries = planning.filter(e => e.date.split('T')[0] === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      cells.push(
        <div key={d} className={`h-32 border-r border-b border-zinc-800 p-2 overflow-y-auto transition-colors ${isToday ? 'bg-red-900/10' : 'bg-zinc-950/40 hover:bg-zinc-900/60'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[10px] font-black ${isToday ? 'bg-red-600 text-white px-2 py-0.5 rounded-full shadow-lg shadow-red-600/30' : 'text-zinc-600'}`}>{d}</span>
            {dayEntries.length > 0 && <span className="text-[9px] text-zinc-700 font-bold uppercase">{Math.round(dayEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0) / 60)}h</span>}
          </div>
          <div className="space-y-1">
            {dayEntries.slice(0, 3).map((entry) => {
              const plan = plans.find(p => p.disciplines.some(d => d.id === entry.disciplineId));
              const discipline = plan?.disciplines.find(d => d.id === entry.disciplineId);
              const topic = discipline?.topics.find(t => t.id === entry.topicId);
              const goal = topic?.goals.find(g => g.id === entry.goalId);

              return (
                <div 
                  key={entry.id} 
                  className="text-[8px] px-1.5 py-1 rounded truncate border border-zinc-800/50 shadow-sm font-bold uppercase tracking-tighter"
                  style={{ backgroundColor: `${goal?.color || '#333'}15`, color: goal?.color || '#fff', borderLeft: `2px solid ${goal?.color || '#333'}` }}
                  title={`${discipline?.name}: ${topic?.title}`}
                >
                  {discipline?.name}
                </div>
              );
            })}
            {dayEntries.length > 3 && <div className="text-[8px] text-zinc-700 text-center font-black uppercase mt-1">+{dayEntries.length - 3} metas</div>}
          </div>
        </div>
      );
    }
    return cells;
  };

  const renderWeekCells = () => {
    const { start } = getWeekRange();
    const cells = [];

    for (let i = 0; i < 7; i++) {
      const dateObj = new Date(start);
      dateObj.setDate(start.getDate() + i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayEntries = planning.filter(e => e.date.split('T')[0] === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      cells.push(
        <div key={i} className={`min-h-[400px] border-r border-zinc-800 p-4 transition-all ${isToday ? 'bg-red-900/5' : 'bg-zinc-950/20 hover:bg-zinc-900/40'}`}>
          <div className="flex flex-col items-center mb-6">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">{dayNames[i]}</span>
            <span className={`text-2xl font-black px-4 py-1 rounded-2xl ${isToday ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-zinc-400'}`}>
              {dateObj.getDate()}
            </span>
          </div>
          
          <div className="space-y-3">
            {dayEntries.length > 0 ? dayEntries.map((entry) => {
              const plan = plans.find(p => p.disciplines.some(d => d.id === entry.disciplineId));
              const discipline = plan?.disciplines.find(d => d.id === entry.disciplineId);
              const topic = discipline?.topics.find(t => t.id === entry.topicId);
              const goal = topic?.goals.find(g => g.id === entry.goalId);

              return (
                <div 
                  key={entry.id} 
                  className="p-3 rounded-2xl border border-zinc-800/50 shadow-lg group relative overflow-hidden"
                  style={{ backgroundColor: `${goal?.color || '#333'}08` }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: goal?.color }} />
                  <div className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-1" style={{ color: goal?.color }}>{discipline?.name}</div>
                  <div className="text-[10px] font-bold text-zinc-200 leading-tight uppercase tracking-tight line-clamp-2">{topic?.title}</div>
                  <div className="mt-2 text-[8px] font-black text-zinc-600 uppercase">{entry.durationMinutes} MIN</div>
                </div>
              );
            }) : (
              <div className="h-32 rounded-2xl border-2 border-dashed border-zinc-900 flex items-center justify-center">
                <span className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Sem Metas</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return cells;
  };

  const renderHeaderTitle = () => {
    if (viewMode === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else {
      const { start, end } = getWeekRange();
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} a ${end.getDate()} de ${monthNames[start.getMonth()]}`;
      }
      return `${start.getDate()} de ${monthNames[start.getMonth()]} - ${end.getDate()} de ${monthNames[end.getMonth()]}`;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Seu Planejamento</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Acompanhe seu progresso e metas futuras</p>
          </div>
          {isPaused && (
            <div className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse shadow-lg shadow-red-600/30">
              <ShieldAlert size={14} /> Pausado
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          {/* View Switcher */}
          <div className="bg-zinc-900 border border-zinc-800 p-1 rounded-2xl flex shadow-xl">
            <button 
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
            >
              <LayoutGrid size={14} /> Mensal
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
            >
              <List size={14} /> Semanal
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-1 rounded-2xl shadow-xl">
            <button onClick={handlePrev} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
            <div className="min-w-[180px] text-center px-2">
              <span className="font-black text-[10px] text-white uppercase tracking-[0.15em]">{renderHeaderTitle()}</span>
            </div>
            <button onClick={handleNext} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"><ChevronRight size={20} /></button>
          </div>
        </div>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none" />
        
        <div className="grid grid-cols-7 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-10">
          {dayNames.map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 border-r border-zinc-800/50 last:border-r-0">{day}</div>
          ))}
        </div>
        
        <div className={`grid grid-cols-7 ${viewMode === 'week' ? 'divide-x divide-zinc-800' : ''}`}>
          {viewMode === 'month' ? renderMonthCells() : renderWeekCells()}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-8 pt-4">
        <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
          <div className="w-3 h-3 rounded-full bg-red-600 shadow-lg shadow-red-600/20" /> Dia Atual
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
          <div className="w-3 h-3 rounded-sm border border-zinc-800 bg-zinc-950/40" /> Dia Sem Metas
        </div>
      </div>
    </div>
  );
};

export default PlanningView;
