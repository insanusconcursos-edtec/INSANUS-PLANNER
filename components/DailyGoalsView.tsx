
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, CheckCircle, ExternalLink, Timer, 
  History, Trophy, ArrowRight, Clock, Info, ShieldAlert, RefreshCw, AlertTriangle, FileText, Loader2
} from 'lucide-react';
import { PlanningEntry, StudyPlan, RegisteredUser } from '../types';
import { getLocalDateString } from '../services/scheduler';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

interface DailyGoalsViewProps {
  planning: PlanningEntry[];
  plans: StudyPlan[];
  onComplete: (entryId: string, timeSpent: number) => void;
  onReplan: () => void;
  isPaused: boolean;
  globalStudyTime: number; 
  planStudyTime: number;  
  currentUser: RegisteredUser | null;
}

const DailyGoalsView: React.FC<DailyGoalsViewProps> = ({ 
  planning, plans, onComplete, onReplan, isPaused, globalStudyTime, planStudyTime, currentUser 
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [isPausedTimer, setIsPausedTimer] = useState(false);
  const [isWatermarking, setIsWatermarking] = useState(false);
  const timerRef = useRef<any>(null);

  const todayStr = getLocalDateString(new Date());
  const todayGoals = planning.filter(e => getLocalDateString(new Date(e.date)) === todayStr);
  const overdueGoals = planning.filter(e => getLocalDateString(new Date(e.date)) < todayStr && e.status !== 'COMPLETED');

  useEffect(() => {
    if (activeId && !isPausedTimer) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeId, isPausedTimer]);

  const handleOpenPdf = async (pdfData: string, fileName: string) => {
    if (!currentUser) return;
    setIsWatermarking(true);
    try {
      // Decode base64 para ArrayBuffer
      const base64Content = pdfData.split(',')[1] || pdfData;
      const binaryString = window.atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pdfDoc = await PDFDocument.load(bytes.buffer);
      const pages = pdfDoc.getPages();
      const watermarkText = `${currentUser.name.toUpperCase()} (CPF: ${currentUser.cpf}) - USO EXCLUSIVO`;

      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Sistema de Mosaico (Tiling) para segurança máxima
        // Adiciona a marca d'água em 9 pontos da página para evitar recortes
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            page.drawText(watermarkText, {
              x: (width / 3) * i + 30,
              y: (height / 3) * j + 50,
              size: 10,
              color: rgb(0.8, 0.1, 0.1), // Vermelho Insanus
              opacity: 0.12, // Suave para não atrapalhar a leitura
              rotate: degrees(35),
            });
          }
        }

        // Rodapé de segurança fixo
        page.drawText(`Documento rastreado: ${currentUser.email} | IP registrado no servidor`, {
          x: 20,
          y: 20,
          size: 7,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.3,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Abrir em nova aba com o nome do arquivo original
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.click();
      
      // Limpeza de memória após um tempo
      setTimeout(() => URL.revokeObjectURL(url), 10000);

    } catch (err) {
      console.error("Erro ao processar PDF:", err);
      alert("Houve um erro ao processar a segurança do seu material. Tente novamente.");
    } finally {
      setIsWatermarking(false);
    }
  };

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
        <p className="text-zinc-500 text-sm leading-relaxed mb-8 font-medium">Você ativou o modo de pausa. O cronograma foi congelado.</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700">
      {isWatermarking && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6">
           <Loader2 className="text-red-600 animate-spin" size={64} />
           <p className="text-white font-black uppercase tracking-widest text-xs text-center">
             Gerando Cópia de Segurança Personalizada...<br/>
             <span className="text-zinc-500 font-bold mt-2 block">Protegendo contra pirataria</span>
           </p>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Linha de Frente</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">Sua ofensiva diária contra o cansaço.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-8 py-5 flex items-center gap-5 shadow-2xl group hover:border-red-600/50 transition-all">
            <Trophy className="text-red-600" size={24} />
            <div>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Global</span>
              <span className="text-xl font-mono text-white font-black">{formatMins(globalStudyTime)}</span>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-8 py-5 flex items-center gap-5 shadow-2xl group hover:border-red-600/50 transition-all">
            <Clock className="text-red-600" size={24} />
            <div>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Neste Plano</span>
              <span className="text-xl font-mono text-white font-black">{formatMins(planStudyTime)}</span>
            </div>
          </div>
        </div>
      </header>

      {activeId && (
        <div className="bg-red-600 rounded-[3.5rem] p-12 flex flex-col md:flex-row items-center justify-between shadow-[0_0_80px_rgba(220,38,38,0.25)] animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-10">
             <div className="p-8 bg-black/20 rounded-[2rem] border border-white/10"><Timer size={64} className="text-white animate-pulse" /></div>
             <div><h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Em Execução</h3></div>
           </div>
           <div className="flex flex-col items-center gap-8 mt-10 md:mt-0">
             <div className="text-8xl font-mono font-black text-white tracking-tighter">{formatSecs(seconds)}</div>
             <div className="flex items-center gap-4">
               <button onClick={() => setIsPausedTimer(!isPausedTimer)} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 shadow-xl">
                 {isPausedTimer ? <Play size={20} /> : <Pause size={20} />} {isPausedTimer ? 'Retomar' : 'Pausar'}
               </button>
               <button onClick={() => { onComplete(activeId, Math.floor(seconds / 60)); setActiveId(null); setSeconds(0); }} className="bg-black/20 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest border border-white/20 hover:bg-black/40 transition-all">Finalizar</button>
             </div>
           </div>
        </div>
      )}

      {overdueGoals.length > 0 && (
        <section className="space-y-6 animate-in slide-in-from-left duration-500">
           <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-black text-red-500 flex items-center gap-3 uppercase tracking-tighter">
                <AlertTriangle size={22} /> Setor de Recuperação (Em Atraso)
              </h3>
              <button onClick={onReplan} className="flex items-center gap-2 px-6 py-2.5 bg-red-600/10 border border-red-600/20 rounded-2xl text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
                <RefreshCw size={14} /> Replanejar Calendário
              </button>
           </div>
           <div className="grid grid-cols-1 gap-4 opacity-80">
              {overdueGoals.map(entry => <GoalCard key={entry.id} entry={entry} plans={plans} activeId={activeId} setActiveId={setActiveId} setSeconds={setSeconds} isOverdue onOpenPdf={handleOpenPdf} />)}
           </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6">
        {todayGoals.length > 0 ? todayGoals.map(entry => (
          <GoalCard key={entry.id} entry={entry} plans={plans} activeId={activeId} setActiveId={setActiveId} setSeconds={setSeconds} onOpenPdf={handleOpenPdf} />
        )) : overdueGoals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-800 border-2 border-dashed border-zinc-900 rounded-[4rem] bg-zinc-900/5">
             <Trophy size={100} className="opacity-10 mb-6" />
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700">Setor de Combate Limpo</p>
          </div>
        )}
      </div>
    </div>
  );
};

const GoalCard = ({ entry, plans, activeId, setActiveId, setSeconds, isOverdue = false, onOpenPdf }: any) => {
  const plan = plans.find((p: StudyPlan) => p.disciplines.some(d => d.id === entry.disciplineId));
  const discipline = plan?.disciplines.find((d: any) => d.id === entry.disciplineId);
  const topic = discipline?.topics.find((t: any) => t.id === entry.topicId);
  const goal = topic?.goals.find((g: any) => g.id === entry.goalId);
  const isComp = entry.status === 'COMPLETED';

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 flex flex-col transition-all duration-500 ${isComp ? 'opacity-30' : 'hover:border-red-600/40 shadow-2xl group/card'}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-8 flex-1">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-2xl ${isOverdue ? 'animate-pulse' : ''}`} style={{ backgroundColor: goal?.color || '#333' }}>
            <History size={36} />
          </div>
          <div className="space-y-2 flex-1 overflow-hidden">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">{discipline?.name}</span>
              {isOverdue && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-black">ATRASADA</span>}
            </div>
            <h4 className="text-2xl font-black text-zinc-100 truncate uppercase tracking-tighter">{topic?.title}</h4>
            <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <span className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-xl border border-zinc-800"><Clock size={14} className="text-red-500" /> {entry.durationMinutes} min</span>
              {entry.isReview && <span className="text-red-500 font-black">REVISÃO • ETAPA {entry.reviewStep}</span>}
              {goal?.pdfData && !isComp && (
                <button onClick={() => onOpenPdf(goal.pdfData, goal.pdfName)} className="flex items-center gap-2 text-red-500 hover:text-white transition-colors bg-red-600/10 border border-red-600/20 px-3 py-1.5 rounded-xl">
                   <FileText size={14} /> MATERIAL SEGURO (PDF)
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 w-full md:w-auto flex flex-col gap-2">
          {!isComp && (
            <button onClick={() => { setActiveId(entry.id); setSeconds(0); }} disabled={!!activeId} className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all ${activeId ? 'bg-zinc-800 text-zinc-700 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200 shadow-xl'}`}>
              Iniciar
            </button>
          )}
          {goal?.links?.map((link: string, idx: number) => (
             <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 text-[8px] font-black text-zinc-600 hover:text-red-500 transition-colors uppercase py-1 border border-zinc-800 rounded-lg">
                LINK EXTERNO {idx + 1} <ExternalLink size={10} />
             </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyGoalsView;
