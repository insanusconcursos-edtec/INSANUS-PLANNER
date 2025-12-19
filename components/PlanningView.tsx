
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin, Search } from 'lucide-react';
import { PlanningEntry, StudyPlan, GoalType } from '../types';

interface PlanningViewProps {
  planning: PlanningEntry[];
  plans: StudyPlan[];
}

const PlanningView: React.FC<PlanningViewProps> = ({ planning, plans }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const renderCells = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const cells = [];

    // Empty cells for padding
    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-32 bg-zinc-950/20 border-r border-b border-zinc-800/50"></div>);
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = new Date(year, month, d).toISOString().split('T')[0];
      const dayEntries = planning.filter(e => e.date.split('T')[0] === dateStr);
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      cells.push(
        <div key={d} className={`h-32 border-r border-b border-zinc-800 p-2 overflow-y-auto ${isToday ? 'bg-red-900/10' : 'bg-zinc-950/40'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className={`text-xs font-bold ${isToday ? 'bg-red-600 text-white px-1.5 py-0.5 rounded-full' : 'text-zinc-500'}`}>{d}</span>
            {dayEntries.length > 0 && <span className="text-[10px] text-zinc-600">{Math.round(dayEntries.reduce((acc, curr) => acc + curr.durationMinutes, 0) / 60)}h</span>}
          </div>
          <div className="space-y-1">
            {dayEntries.slice(0, 4).map((entry, i) => {
              const plan = plans.find(p => p.disciplines.some(d => d.id === entry.disciplineId));
              const discipline = plan?.disciplines.find(d => d.id === entry.disciplineId);
              const topic = discipline?.topics.find(t => t.id === entry.topicId);
              const goal = topic?.goals.find(g => g.id === entry.goalId);

              return (
                <div 
                  key={entry.id} 
                  className="text-[9px] px-1.5 py-0.5 rounded truncate border border-zinc-800 shadow-sm"
                  style={{ backgroundColor: `${goal?.color || '#333'}20`, color: goal?.color || '#fff', borderLeft: `2px solid ${goal?.color || '#333'}` }}
                  title={`${discipline?.name}: ${topic?.title} (${entry.durationMinutes}min)`}
                >
                  {discipline?.name}
                </div>
              );
            })}
            {dayEntries.length > 4 && <div className="text-[8px] text-zinc-600 text-center font-bold">+{dayEntries.length - 4} mais</div>}
          </div>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="p-8 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Seu Calendário</h2>
          <p className="text-zinc-400">Visualize sua jornada rumo à aprovação.</p>
        </div>
        <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button onClick={prevMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all"><ChevronLeft size={20} /></button>
          <span className="font-bold text-white min-w-[140px] text-center">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-all"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-7 bg-zinc-950 border-b border-zinc-800">
          {dayNames.map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-500">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {renderCells()}
        </div>
      </div>
    </div>
  );
};

export default PlanningView;
