
import React, { useState, useRef } from 'react';
import { 
  Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Image as ImageIcon, Link as LinkIcon, RefreshCw, 
  Clock, GraduationCap, Folder as FolderIcon, 
  Users, Code, Search, UserPlus, Key, ShieldCheck,
  Calendar, Edit, X, Save, Layers, Settings2, ExternalLink,
  Lock, CheckCircle2, AlertCircle, Copy, Upload, FileImage,
  GripVertical, Send
} from 'lucide-react';
import { 
  StudyPlan, Discipline, Topic, Goal, GoalType, 
  CycleSystem, StudyCycle, Folder, RegisteredUser, 
  PlanAccess, CycleItem 
} from '../types.ts';
import { GOAL_COLORS } from '../constants.tsx';
import { db } from '../firebase.ts';
import { doc, setDoc, deleteDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore";

interface AdminViewProps {
  plans: StudyPlan[];
  updatePlans: (plans: StudyPlan[]) => void;
  users: RegisteredUser[];
  updateUsers: (users: RegisteredUser[]) => void;
  logoUrl: string;
  updateLogo: (url: string) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ plans, updatePlans, users, updateUsers, logoUrl, updateLogo }) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'users' | 'identity' | 'embed'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const planImageInputRef = useRef<HTMLInputElement>(null);

  const [isEditingGoal, setIsEditingGoal] = useState<{ dId: string, tId: string, gId: string | null } | null>(null);

  const activePlan = plans.find(p => p.id === selectedPlanId);

  const savePlan = async (plan: StudyPlan) => {
    const sanitizedPlan = JSON.parse(JSON.stringify(plan));
    await setDoc(doc(db, "plans", plan.id), sanitizedPlan);
  };

  const handleGlobalSync = async () => {
    if (!activePlan) return;
    setSyncing(true);
    try {
      await savePlan(activePlan);
      alert("Plano sincronizado com sucesso no banco de dados central!");
    } catch (err) {
      alert("Erro ao sincronizar plano.");
    } finally {
      setSyncing(false);
    }
  };

  const createPlan = async () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newPlan: StudyPlan = {
      id,
      name: 'Novo Plano de Estudos',
      imageUrl: 'https://picsum.photos/400/200',
      disciplines: [],
      folders: [],
      cycles: [],
      cycleSystem: CycleSystem.CONTINUOUS
    };
    await savePlan(newPlan);
    setSelectedPlanId(id);
  };

  const addFolder = async () => {
    if (!activePlan) return;
    const newFolder: Folder = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Nova Pasta',
      order: activePlan.folders.length
    };
    await savePlan({ ...activePlan, folders: [...activePlan.folders, newFolder] });
  };

  const moveFolder = async (folderId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const idx = activePlan.folders.findIndex(f => f.id === folderId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === activePlan.folders.length - 1)) return;
    const newFolders = [...activePlan.folders];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newFolders[idx], newFolders[targetIdx]] = [newFolders[targetIdx], newFolders[idx]];
    await savePlan({ ...activePlan, folders: newFolders.map((f, i) => ({ ...f, order: i })) });
  };

  const addDiscipline = async () => {
    if (!activePlan) return;
    const newD: Discipline = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Nova Disciplina',
      topics: [],
      folderId: null,
      order: activePlan.disciplines.length
    };
    await savePlan({ ...activePlan, disciplines: [...activePlan.disciplines, newD] });
  };

  const moveDiscipline = async (dId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const idx = activePlan.disciplines.findIndex(d => d.id === dId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === activePlan.disciplines.length - 1)) return;
    const newDiscs = [...activePlan.disciplines];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newDiscs[idx], newDiscs[targetIdx]] = [newDiscs[targetIdx], newDiscs[idx]];
    await savePlan({ ...activePlan, disciplines: newDiscs.map((d, i) => ({ ...d, order: i })) });
  };

  const addTopic = async (dId: string) => {
    if (!activePlan) return;
    const dIdx = activePlan.disciplines.findIndex(d => d.id === dId);
    if (dIdx === -1) return;
    const newT: Topic = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Assunto',
      order: activePlan.disciplines[dIdx].topics.length,
      goals: []
    };
    const updatedDiscs = [...activePlan.disciplines];
    updatedDiscs[dIdx] = { ...updatedDiscs[dIdx], topics: [...updatedDiscs[dIdx].topics, newT] };
    await savePlan({ ...activePlan, disciplines: updatedDiscs });
  };

  const moveTopic = async (dId: string, tId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const dIdx = activePlan.disciplines.findIndex(d => d.id === dId);
    if (dIdx === -1) return;
    const topics = [...activePlan.disciplines[dIdx].topics];
    const tIdx = topics.findIndex(t => t.id === tId);
    if ((direction === 'up' && tIdx === 0) || (direction === 'down' && tIdx === topics.length - 1)) return;
    const targetIdx = direction === 'up' ? tIdx - 1 : tIdx + 1;
    [topics[tIdx], topics[targetIdx]] = [topics[targetIdx], topics[tIdx]];
    const updatedDiscs = [...activePlan.disciplines];
    updatedDiscs[dIdx] = { ...updatedDiscs[dIdx], topics: topics.map((t, i) => ({ ...t, order: i })) };
    await savePlan({ ...activePlan, disciplines: updatedDiscs });
  };

  const handleGoalSave = async (dId: string, tId: string, goal: Goal) => {
    if (!activePlan) return;
    const updated = activePlan.disciplines.map(d => {
      if (d.id !== dId) return d;
      return {
        ...d,
        topics: d.topics.map(t => {
          if (t.id !== tId) return t;
          const exists = t.goals.find(g => g.id === goal.id);
          const goals = exists ? t.goals.map(g => g.id === goal.id ? goal : g) : [...t.goals, { ...goal, order: t.goals.length }];
          return { ...t, goals };
        })
      };
    });
    await savePlan({ ...activePlan, disciplines: updated });
    setIsEditingGoal(null);
  };

  const moveGoal = async (dId: string, tId: string, gId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const updated = activePlan.disciplines.map(d => {
      if (d.id !== dId) return d;
      return {
        ...d,
        topics: d.topics.map(t => {
          if (t.id !== tId) return t;
          const idx = t.goals.findIndex(g => g.id === gId);
          if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === t.goals.length - 1)) return t;
          const newGoals = [...t.goals];
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          [newGoals[idx], newGoals[targetIdx]] = [newGoals[targetIdx], newGoals[idx]];
          return { ...t, goals: newGoals.map((g, i) => ({ ...g, order: i })) };
        })
      };
    });
    await savePlan({ ...activePlan, disciplines: updated });
  };

  const addCycle = async () => {
    if (!activePlan) return;
    const newCycle: StudyCycle = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Ciclo ' + (activePlan.cycles.length + 1),
      order: activePlan.cycles.length,
      items: [],
      topicsPerDiscipline: 1
    };
    await savePlan({ ...activePlan, cycles: [...activePlan.cycles, newCycle] });
  };

  const moveCycle = async (cId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const idx = activePlan.cycles.findIndex(c => c.id === cId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === activePlan.cycles.length - 1)) return;
    const newCycles = [...activePlan.cycles];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newCycles[idx], newCycles[targetIdx]] = [newCycles[targetIdx], newCycles[idx]];
    await savePlan({ ...activePlan, cycles: newCycles.map((c, i) => ({ ...c, order: i })) });
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Configurações Avançadas</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Controle Total de Hierarquia e Ciclos</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl flex-wrap">
          {[
            { id: 'plans', label: 'Planos', icon: Layers },
            { id: 'users', label: 'Alunos', icon: Users },
            { id: 'identity', label: 'Visual', icon: ImageIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
          {selectedPlanId && (
            <button 
              onClick={handleGlobalSync}
              disabled={syncing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-zinc-800 text-red-500 hover:bg-zinc-700 ml-2 transition-all border border-zinc-700"
            >
              {syncing ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />} 
              {syncing ? 'Sincronizando...' : 'Sincronizar Plano'}
            </button>
          )}
        </div>
      </header>

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <button onClick={createPlan} className="w-full bg-red-600 hover:bg-red-700 py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl">
              <Plus size={20} /> Novo Plano
            </button>
            <div className="space-y-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left p-6 rounded-3xl border transition-all relative overflow-hidden ${
                    selectedPlanId === plan.id ? 'bg-red-600/10 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-black uppercase tracking-tighter text-sm">{plan.name}</div>
                  <div className="text-[10px] mt-1 font-bold opacity-60 uppercase">{plan.disciplines.length} Disciplinas</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            {activePlan ? (
              <div className="space-y-10">
                <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row gap-8 shadow-2xl">
                   <div className="w-full md:w-48 h-48 bg-black rounded-3xl overflow-hidden group relative">
                    <img src={activePlan.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <button onClick={() => planImageInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-all text-white text-[10px] font-black uppercase">Trocar Imagem</button>
                    <input type="file" ref={planImageInputRef} className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if(file) {
                        const reader = new FileReader();
                        reader.onload = () => savePlan({ ...activePlan, imageUrl: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </div>
                  <div className="flex-1 space-y-6">
                    <input 
                      value={activePlan.name}
                      onChange={(e) => savePlan({ ...activePlan, name: e.target.value })}
                      className="text-3xl md:text-4xl font-black bg-transparent border-none text-white w-full outline-none uppercase tracking-tighter"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
                        <Settings2 size={14} className="text-red-500" />
                        <select 
                          value={activePlan.cycleSystem}
                          onChange={(e) => savePlan({ ...activePlan, cycleSystem: e.target.value as CycleSystem })}
                          className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-400"
                        >
                          <option value={CycleSystem.CONTINUOUS}>Contínuo (Hierárquico)</option>
                          <option value={CycleSystem.ROTATING}>Rotativo (Rodadas)</option>
                        </select>
                      </div>
                      <button onClick={addFolder} className="text-[10px] font-black uppercase bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 rounded-xl border border-zinc-700 flex items-center gap-2">
                        <FolderIcon size={14} /> + Pasta
                      </button>
                      <button onClick={addDiscipline} className="text-[10px] font-black uppercase bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 rounded-xl border border-zinc-700 flex items-center gap-2">
                        <GraduationCap size={14} /> + Disciplina
                      </button>
                    </div>
                  </div>
                </div>

                <section className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                      <RefreshCw size={22} className="text-red-500" /> Ciclos Operacionais
                    </h3>
                    <button onClick={addCycle} className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border border-red-600/20 transition-all">+ Novo Ciclo</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activePlan.cycles.sort((a,b) => a.order - b.order).map(cycle => (
                      <div key={cycle.id} className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 space-y-6 hover:border-zinc-700 transition-colors group">
                        <div className="flex justify-between items-center">
                          <input 
                            value={cycle.name}
                            onChange={(e) => savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, name: e.target.value } : c) })}
                            className="font-black text-white bg-transparent outline-none uppercase tracking-tight focus:text-red-500 transition-colors"
                          />
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveCycle(cycle.id, 'up')} className="p-2 text-zinc-600 hover:text-white"><ChevronUp size={16} /></button>
                            <button onClick={() => moveCycle(cycle.id, 'down')} className="p-2 text-zinc-600 hover:text-white"><ChevronDown size={16} /></button>
                            <button onClick={() => savePlan({ ...activePlan, cycles: activePlan.cycles.filter(c => c.id !== cycle.id) })} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block">Conteúdo do Ciclo</label>
                          <div className="flex flex-wrap gap-2">
                            {cycle.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl text-[10px] font-bold text-zinc-400">
                                {item.type === 'DISCIPLINE' ? <GraduationCap size={12} className="text-red-500" /> : <FolderIcon size={12} className="text-red-500" />}
                                {item.type === 'DISCIPLINE' ? activePlan.disciplines.find(d => d.id === item.id)?.name : activePlan.folders.find(f => f.id === item.id)?.name}
                                <button onClick={() => {
                                  const newItems = [...cycle.items];
                                  newItems.splice(idx, 1);
                                  savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, items: newItems } : c) });
                                }} className="hover:text-red-500 ml-1"><X size={12} /></button>
                              </div>
                            ))}
                            <select 
                              onChange={(e) => {
                                const [type, id] = e.target.value.split(':');
                                if(!id) return;
                                savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, items: [...c.items, { type: type as any, id }] } : c) });
                                e.target.value = "";
                              }}
                              className="bg-zinc-800 text-[10px] font-black uppercase rounded-xl px-3 py-2 outline-none border border-zinc-700 hover:border-red-500 transition-colors"
                            >
                              <option value="">+ Inserir Item</option>
                              <optgroup label="Disciplinas Individuais">
                                {activePlan.disciplines.sort((a,b) => a.order - b.order).map(d => <option key={d.id} value={`DISCIPLINE:${d.id}`}>{d.name}</option>)}
                              </optgroup>
                              <optgroup label="Pastas">
                                {activePlan.folders.sort((a,b) => a.order - b.order).map(f => <option key={f.id} value={`FOLDER:${f.id}`}>{f.name}</option>)}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                        {activePlan.cycleSystem === CycleSystem.ROTATING && (
                          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Assuntos p/ Rodada</span>
                            <div className="flex items-center gap-3">
                               <button onClick={() => savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, topicsPerDiscipline: Math.max(1, (c.topicsPerDiscipline || 1) - 1) } : c) })} className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white">-</button>
                               <span className="text-lg font-mono font-black text-white">{cycle.topicsPerDiscipline || 1}</span>
                               <button onClick={() => savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, topicsPerDiscipline: (c.topicsPerDiscipline || 1) + 1 } : c) })} className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white">+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-8">
                   <div className="flex items-center gap-4 px-4">
                      <FolderIcon size={22} className="text-red-500" />
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Estrutura de Conteúdo</h3>
                   </div>
                   {activePlan.folders.sort((a,b) => a.order - b.order).map(folder => (
                     <div key={folder.id} className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <button onClick={() => moveFolder(folder.id, 'up')} className="text-zinc-700 hover:text-white"><ChevronUp size={12} /></button>
                                <button onClick={() => moveFolder(folder.id, 'down')} className="text-zinc-700 hover:text-white"><ChevronDown size={12} /></button>
                            </div>
                            <FolderIcon className="text-red-500" />
                            <input 
                              value={folder.name}
                              onChange={(e) => savePlan({ ...activePlan, folders: activePlan.folders.map(f => f.id === folder.id ? { ...f, name: e.target.value } : f) })}
                              className="bg-transparent font-black text-white uppercase outline-none focus:text-red-500 transition-colors"
                            />
                          </div>
                          <button onClick={() => {
                             const newFolders = activePlan.folders.filter(f => f.id !== folder.id);
                             const newDiscs = activePlan.disciplines.map(d => d.folderId === folder.id ? { ...d, folderId: null } : d);
                             savePlan({ ...activePlan, folders: newFolders, disciplines: newDiscs });
                          }} className="text-zinc-600 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {activePlan.disciplines.filter(d => d.folderId === folder.id).sort((a,b) => a.order - b.order).map(disc => (
                             <DisciplineNode key={disc.id} disc={disc} activePlan={activePlan} savePlan={savePlan} moveDiscipline={moveDiscipline} addTopic={addTopic} moveTopic={moveTopic} moveGoal={moveGoal} setIsEditingGoal={setIsEditingGoal} />
                           ))}
                        </div>
                     </div>
                   ))}
                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] px-4">Independentes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activePlan.disciplines.filter(d => !d.folderId).sort((a,b) => a.order - b.order).map(disc => (
                          <DisciplineNode key={disc.id} disc={disc} activePlan={activePlan} savePlan={savePlan} moveDiscipline={moveDiscipline} addTopic={addTopic} moveTopic={moveTopic} moveGoal={moveGoal} setIsEditingGoal={setIsEditingGoal} />
                        ))}
                      </div>
                   </div>
                </section>
              </div>
            ) : (
              <div className="h-[500px] border-2 border-dashed border-zinc-800 rounded-[3rem] flex items-center justify-center bg-zinc-900/10">
                <p className="text-zinc-800 font-black uppercase tracking-[0.3em] text-sm">Selecione uma base de dados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditingGoal && (
        <GoalEditorModal activePlan={activePlan!} context={isEditingGoal} onClose={() => setIsEditingGoal(null)} onSave={handleGoalSave} />
      )}
    </div>
  );
};

const DisciplineNode = ({ disc, activePlan, savePlan, moveDiscipline, addTopic, moveTopic, moveGoal, setIsEditingGoal }: any) => {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden group/disc hover:border-zinc-700 transition-colors">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/10">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <button onClick={() => moveDiscipline(disc.id, 'up')} className="text-zinc-800 hover:text-white"><ChevronUp size={12} /></button>
            <button onClick={() => moveDiscipline(disc.id, 'down')} className="text-zinc-800 hover:text-white"><ChevronDown size={12} /></button>
          </div>
          <input value={disc.name} onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, name: e.target.value } : d) })} className="bg-transparent font-black text-white uppercase outline-none text-xs focus:text-red-500 w-32 md:w-48" />
        </div>
        <div className="flex items-center gap-2">
           <select value={disc.folderId || ""} onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, folderId: e.target.value || null } : d) })} className="bg-zinc-900 text-[8px] font-black uppercase rounded-lg px-2 py-1 outline-none text-zinc-600 border border-zinc-800">
             <option value="">Raiz</option>
             {activePlan.folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
           </select>
           <button onClick={() => addTopic(disc.id)} className="p-1.5 bg-zinc-900 text-zinc-500 hover:text-red-500 transition-all"><Plus size={16} /></button>
           <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.filter((d: any) => d.id !== disc.id) })} className="p-1.5 text-zinc-800 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {disc.topics.sort((a: any, b: any) => a.order - b.order).map((topic: any) => (
          <div key={topic.id} className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-4 space-y-3 group/topic">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => moveTopic(disc.id, topic.id, 'up')} className="text-zinc-800 hover:text-red-500"><ChevronUp size={10} /></button>
                  <button onClick={() => moveTopic(disc.id, topic.id, 'down')} className="text-zinc-800 hover:text-red-500"><ChevronDown size={10} /></button>
                </div>
                <input value={topic.title} onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, topics: d.topics.map((t: any) => t.id === topic.id ? { ...t, title: e.target.value } : t) } : d) })} className="bg-transparent font-bold text-[10px] text-zinc-400 outline-none uppercase focus:text-white" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/topic:opacity-100 transition-opacity">
                <button onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: null })} className="text-red-500 hover:scale-110 transition-transform"><Plus size={14} /></button>
                <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => { if(d.id !== disc.id) return d; return { ...d, topics: d.topics.filter((t: any) => t.id !== topic.id) }; }) })} className="text-zinc-800 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            </div>
            <div className="space-y-1.5 pl-4 border-l border-zinc-800/50">
              {topic.goals.sort((a: any, b: any) => a.order - b.order).map((goal: any) => (
                <div key={goal.id} className="flex items-center justify-between gap-3 group/goal">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col">
                      <button onClick={() => moveGoal(disc.id, topic.id, goal.id, 'up')} className="text-zinc-800 hover:text-red-500"><ChevronUp size={10} /></button>
                      <button onClick={() => moveGoal(disc.id, topic.id, goal.id, 'down')} className="text-zinc-800 hover:text-red-500"><ChevronDown size={10} /></button>
                    </div>
                    <button onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: goal.id })} className="text-[8px] font-black uppercase px-2 py-1 rounded-lg border flex-1 text-left truncate transition-all hover:brightness-125" style={{ backgroundColor: `${goal.color}10`, color: goal.color, borderColor: `${goal.color}30` }}>
                      {goal.type}: {goal.title}
                    </button>
                  </div>
                  <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => { if(d.id !== disc.id) return d; return { ...d, topics: d.topics.map((t: any) => { if(t.id !== topic.id) return t; return { ...t, goals: t.goals.filter((g: any) => g.id !== goal.id) }; }) }; }) })} className="opacity-0 group-hover/goal:opacity-100 text-zinc-800 hover:text-red-500 transition-all"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const GoalEditorModal = ({ activePlan, context, onClose, onSave }: any) => {
  const existingGoal = context.gId ? activePlan.disciplines.find((d: any) => d.id === context.dId)?.topics.find((t: any) => t.id === context.tId)?.goals.find((g: any) => g.id === context.gId) : null;
  const [goal, setGoal] = useState<Goal>(existingGoal || { id: Math.random().toString(36).substr(2, 9), type: GoalType.CLASS, title: 'Nova Atividade', color: GOAL_COLORS[0], order: 0, links: [], reviewConfig: { enabled: false, intervals: [1, 7, 15, 30], repeatLast: false }, observations: '', multiplier: 1, articles: '' });
  const [linkInput, setLinkInput] = useState('');
  const [intervalsInput, setIntervalsInput] = useState(goal.reviewConfig?.intervals.join(', ') || '1, 7, 15, 30');

  const handleSave = () => {
    const intervals = intervalsInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    onSave(context.dId, context.tId, { ...goal, reviewConfig: { ...goal.reviewConfig!, intervals } });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
          <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Parâmetros da Meta</h4>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-all"><X size={24} className="text-zinc-500" /></button>
        </div>
        <div className="p-8 space-y-8 flex-1 overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Identificação</label>
              <input value={goal.title} onChange={e => setGoal({...goal, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-red-600 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Modalidade</label>
              <select value={goal.type} onChange={e => setGoal({...goal, type: e.target.value as GoalType})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-black uppercase outline-none focus:border-red-600">
                {Object.values(GoalType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Carga de Trabalho</label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4">
                {(goal.type === GoalType.CLASS || goal.type === GoalType.SUMMARY) ? (
                  <> <Clock size={16} className="text-zinc-700" /> <input type="number" value={goal.minutes || ""} onChange={e => setGoal({...goal, minutes: Number(e.target.value)})} className="bg-transparent text-white font-black outline-none w-full" placeholder="Minutos" /> </>
                ) : (
                  <> <FileText size={16} className="text-zinc-700" /> <input type="number" value={goal.pages || ""} onChange={e => setGoal({...goal, pages: Number(e.target.value)})} className="bg-transparent text-white font-black outline-none w-full" placeholder="Páginas" /> </>
                )}
              </div>
            </div>
            {goal.type === GoalType.LEI_SECA && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Multiplicador de Leitura (2x, 3x...)</label>
                <input type="number" min="1" max="5" value={goal.multiplier || 1} onChange={e => setGoal({...goal, multiplier: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-red-600" />
              </div>
            )}
          </div>

          {goal.type === GoalType.LEI_SECA && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Artigos a serem lidos</label>
              <input value={goal.articles || ""} onChange={e => setGoal({...goal, articles: e.target.value})} placeholder="Ex: Art. 1 ao 15 da CF" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-red-600" />
            </div>
          )}

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Links de Redirecionamento</label>
            <div className="flex gap-2">
               <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://..." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs" />
               <button onClick={() => { if(linkInput) { setGoal({...goal, links: [...goal.links, linkInput]}); setLinkInput(""); } }} className="bg-red-600 text-white p-3 rounded-xl hover:bg-red-700"><Plus size={18} /></button>
            </div>
            <div className="space-y-2">
              {goal.links.map((link, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl">
                  <span className="text-[10px] text-zinc-400 truncate flex-1">{link}</span>
                  <button onClick={() => setGoal({...goal, links: goal.links.filter((_, idx) => idx !== i)})} className="text-zinc-600 hover:text-red-500 ml-2"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sistema de Revisão</label>
                <button onClick={() => setGoal({...goal, reviewConfig: {...goal.reviewConfig!, enabled: !goal.reviewConfig?.enabled}})} className={`w-12 h-6 rounded-full transition-colors relative ${goal.reviewConfig?.enabled ? 'bg-red-600' : 'bg-zinc-800'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${goal.reviewConfig?.enabled ? 'left-7' : 'left-1'}`} />
                </button>
             </div>
             {goal.reviewConfig?.enabled && (
               <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Espaçamento em Dias (separados por vírgula)</label>
                    <input value={intervalsInput} onChange={e => setIntervalsInput(e.target.value)} placeholder="1, 7, 15, 30" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-mono text-xs" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={goal.reviewConfig.repeatLast} onChange={e => setGoal({...goal, reviewConfig: {...goal.reviewConfig!, repeatLast: e.target.checked}})} className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-red-600" />
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Repetir último indicador infinitamente</label>
                  </div>
               </div>
             )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Instruções Extras</label>
            <textarea value={goal.observations} onChange={e => setGoal({...goal, observations: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-zinc-400 outline-none focus:border-red-600 min-h-[100px]" placeholder="Orientações específicas..." />
          </div>

          <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Esquema Visual</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map(c => (
                  <button key={c} onClick={() => setGoal({...goal, color: c})} className={`w-8 h-8 rounded-lg border-2 transition-all ${goal.color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
          </div>
        </div>
        <div className="p-8 border-t border-zinc-800 flex gap-4 bg-zinc-950/50">
          <button onClick={onClose} className="flex-1 py-4 rounded-xl border border-zinc-800 text-zinc-500 font-black uppercase text-xs tracking-widest hover:bg-zinc-900 transition-colors">Abortar</button>
          <button onClick={handleSave} className="flex-1 py-4 rounded-xl bg-red-600 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-red-600/30 hover:bg-red-700 transition-colors">Salvar Meta</button>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
