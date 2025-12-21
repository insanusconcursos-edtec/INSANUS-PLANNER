
import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Image as ImageIcon, Link as LinkIcon, RefreshCw, 
  Clock, GraduationCap, Folder as FolderIcon, 
  Users, Search, X, Save, Layers, Settings2, ExternalLink,
  ShieldCheck, CheckCircle2, AlertCircle, Send, UserPlus,
  Key, Mail, Fingerprint, Eye, Upload, Edit, GripVertical, 
  User as UserIcon, Lock, FileUp, Info, ChevronRight, Video
} from 'lucide-react';
import { 
  StudyPlan, Discipline, Topic, Goal, GoalType, 
  CycleSystem, StudyCycle, Folder, RegisteredUser, 
  PlanAccess, CycleItem, SubGoal
} from '../types.ts';
import { GOAL_COLORS } from '../constants.tsx';
import { db } from '../firebase.ts';
import { doc, setDoc, collection, updateDoc, arrayUnion, deleteDoc, addDoc } from "firebase/firestore";

interface AdminViewProps {
  plans: StudyPlan[];
  updatePlans: (plans: StudyPlan[]) => void;
  users: RegisteredUser[];
  updateUsers: (users: RegisteredUser[]) => void;
  logoUrl: string;
  updateLogo: (url: string) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ plans, users, updateUsers, logoUrl, updateLogo }) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'users' | 'identity'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', cpf: '', password: '' });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const planImageInputRef = useRef<HTMLInputElement>(null);
  const [isEditingGoal, setIsEditingGoal] = useState<{ dId: string, tId: string, gId: string | null } | null>(null);

  const activePlan = plans.find(p => p.id === selectedPlanId);

  const toggleFolder = (id: string) => {
    const newSet = new Set(collapsedFolders);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCollapsedFolders(newSet);
  };

  const savePlan = async (plan: StudyPlan) => {
    const sanitizedPlan = JSON.parse(JSON.stringify(plan));
    await setDoc(doc(db, "plans", plan.id), sanitizedPlan);
  };

  const handleGlobalSync = async () => {
    if (!activePlan) return;
    setSyncing(true);
    try {
      await savePlan(activePlan);
      alert("Plano sincronizado com sucesso!");
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

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userRef = collection(db, "users");
      await addDoc(userRef, {
        ...newUser,
        role: 'USER',
        accessList: []
      });
      alert("Usuário cadastrado com sucesso!");
      setNewUser({ name: '', email: '', cpf: '', password: '' });
      setIsAddingUser(false);
    } catch (err) {
      alert("Erro ao cadastrar usuário.");
    }
  };

  const moveItem = <T extends { order: number }>(list: T[], index: number, direction: 'up' | 'down'): T[] => {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return list;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    return newList.map((item, i) => ({ ...item, order: i }));
  };

  const handleMoveFolder = (id: string, dir: 'up' | 'down') => {
    if (!activePlan) return;
    const idx = activePlan.folders.findIndex(f => f.id === id);
    const newFolders = moveItem(activePlan.folders, idx, dir);
    savePlan({ ...activePlan, folders: newFolders });
  };

  const handleMoveDiscipline = (id: string, dir: 'up' | 'down') => {
    if (!activePlan) return;
    const idx = activePlan.disciplines.findIndex(d => d.id === id);
    const newDiscs = moveItem(activePlan.disciplines, idx, dir);
    savePlan({ ...activePlan, disciplines: newDiscs });
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
          const goals = exists 
            ? t.goals.map(g => g.id === goal.id ? goal : g) 
            : [...t.goals, { ...goal, order: t.goals.length }];
          return { ...t, goals };
        })
      };
    });
    await savePlan({ ...activePlan, disciplines: updated });
    setIsEditingGoal(null);
  };

  const toggleUserAccess = async (userId: string, planId: string, hasAccess: boolean) => {
    const userRef = doc(db, "users", userId);
    if (hasAccess) {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      const newAccess = user.accessList.filter(a => a.planId !== planId);
      await updateDoc(userRef, { accessList: newAccess });
    } else {
      const access: PlanAccess = {
        planId,
        assignedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      await updateDoc(userRef, { accessList: arrayUnion(access) });
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.cpf.includes(userSearch)
    );
  }, [users, userSearch]);

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Painel Administrativo</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Gestão Avançada de Ecossistemas</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl flex-wrap">
          {[
            { id: 'plans', label: 'Planos & Conteúdo', icon: Layers },
            { id: 'users', label: 'Gestão de Alunos', icon: Users },
            { id: 'identity', label: 'Visual', icon: ImageIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <button onClick={createPlan} className="w-full bg-red-600 hover:bg-red-700 py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-600/20">
              <Plus size={20} /> Novo Plano
            </button>
            <div className="space-y-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`w-full text-left p-6 rounded-3xl border transition-all relative overflow-hidden group ${
                    selectedPlanId === plan.id ? 'bg-red-600/10 border-red-500 text-white shadow-lg shadow-red-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-black uppercase tracking-tighter text-sm">{plan.name}</div>
                  <div className="text-[10px] mt-1 font-bold opacity-60 uppercase flex items-center gap-2">
                    <GraduationCap size={12} /> {plan.disciplines.length} Disciplinas
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            {activePlan ? (
              <div className="space-y-10">
                <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row gap-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] pointer-events-none" />
                   <div className="w-full md:w-48 h-48 flex flex-col gap-4 shrink-0">
                    <div className="w-full aspect-[2/1] bg-black rounded-3xl overflow-hidden group relative border border-zinc-800">
                      <img src={activePlan.imageUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <button onClick={() => planImageInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-all text-white text-[10px] font-black uppercase">Trocar Capa</button>
                      <input type="file" ref={planImageInputRef} className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if(file) {
                          const reader = new FileReader();
                          reader.onload = () => savePlan({ ...activePlan, imageUrl: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>
                    <div className="flex items-start gap-2 bg-red-600/5 border border-red-600/10 p-3 rounded-2xl animate-pulse">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <div className="text-[9px] font-bold text-zinc-400 leading-tight uppercase tracking-wider">
                        Recomendado: <span className="text-red-500">1200x600px</span> (Proporção 2:1). Alta resolução para evitar distorções.
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-6">
                    <input 
                      value={activePlan.name}
                      onChange={(e) => savePlan({ ...activePlan, name: e.target.value })}
                      className="text-3xl md:text-4xl font-black bg-transparent border-none text-white w-full outline-none uppercase tracking-tighter focus:text-red-500 transition-colors"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-zinc-950 px-4 py-2 rounded-xl border border-zinc-800">
                        <Settings2 size={14} className="text-red-500" />
                        <select 
                          value={activePlan.cycleSystem}
                          onChange={(e) => savePlan({ ...activePlan, cycleSystem: e.target.value as CycleSystem })}
                          className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-400"
                        >
                          <option value={CycleSystem.CONTINUOUS}>Sistema Contínuo</option>
                          <option value={CycleSystem.ROTATING}>Sistema Rotativo</option>
                        </select>
                      </div>
                      <button onClick={handleGlobalSync} disabled={syncing} className="bg-zinc-800 hover:bg-zinc-700 text-red-500 px-5 py-2.5 rounded-xl border border-zinc-700 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl">
                        {syncing ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />} Sincronizar Tudo
                      </button>
                    </div>
                  </div>
                </div>

                <section className="space-y-6 bg-zinc-900/40 p-8 rounded-[3rem] border border-zinc-800/50">
                  <div className="flex justify-between items-center px-4">
                    <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                      <RefreshCw size={22} className="text-red-500" /> Ciclos de Estudo
                    </h3>
                    <button onClick={() => {
                      const newCycle: StudyCycle = { id: Math.random().toString(36).substr(2, 9), name: `Ciclo ${activePlan.cycles.length + 1}`, order: activePlan.cycles.length, items: [], topicsPerDiscipline: 1 };
                      savePlan({ ...activePlan, cycles: [...activePlan.cycles, newCycle] });
                    }} className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl border border-red-600/20 transition-all">+ Novo Ciclo</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activePlan.cycles.sort((a,b) => a.order - b.order).map((cycle, cIdx) => (
                      <div key={cycle.id} className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
                        <div className="flex justify-between items-center">
                          <input value={cycle.name} onChange={(e) => savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, name: e.target.value } : c) })} className="font-black text-white bg-transparent outline-none uppercase text-xs" />
                          <div className="flex gap-2">
                             <button onClick={() => savePlan({ ...activePlan, cycles: moveItem(activePlan.cycles, cIdx, 'up') })} className="text-zinc-600 hover:text-white"><ChevronUp size={14} /></button>
                             <button onClick={() => savePlan({ ...activePlan, cycles: moveItem(activePlan.cycles, cIdx, 'down') })} className="text-zinc-600 hover:text-white"><ChevronDown size={14} /></button>
                             <button onClick={() => savePlan({ ...activePlan, cycles: activePlan.cycles.filter(c => c.id !== cycle.id) })} className="text-zinc-600 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="space-y-3">
                           <div className="flex flex-wrap gap-2">
                              {cycle.items.map((item, iIdx) => (
                                <div key={iIdx} className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase text-zinc-400 flex items-center gap-2">
                                  {item.type === 'DISCIPLINE' ? <GraduationCap size={12} className="text-red-500" /> : <FolderIcon size={12} className="text-red-500" />}
                                  {item.type === 'DISCIPLINE' ? activePlan.disciplines.find(d => d.id === item.id)?.name : activePlan.folders.find(f => f.id === item.id)?.name}
                                  <button onClick={() => {
                                    const newItems = [...cycle.items];
                                    newItems.splice(iIdx, 1);
                                    savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, items: newItems } : c) });
                                  }} className="hover:text-red-500"><X size={10} /></button>
                                </div>
                              ))}
                              <select 
                                onChange={(e) => {
                                  if(!e.target.value) return;
                                  const [type, id] = e.target.value.split(':');
                                  savePlan({ ...activePlan, cycles: activePlan.cycles.map(c => c.id === cycle.id ? { ...c, items: [...c.items, { type: type as any, id }] } : c) });
                                  e.target.value = "";
                                }}
                                className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase text-zinc-400 outline-none"
                              >
                                <option value="">+ Adicionar Item</option>
                                <optgroup label="Disciplinas">
                                  {activePlan.disciplines.map(d => <option key={d.id} value={`DISCIPLINE:${d.id}`}>{d.name}</option>)}
                                </optgroup>
                                <optgroup label="Pastas">
                                  {activePlan.folders.map(f => <option key={f.id} value={`FOLDER:${f.id}`}>{f.name}</option>)}
                                </optgroup>
                              </select>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-8">
                   <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-4">
                        <FolderIcon size={22} className="text-red-500" />
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Organização por Pastas</h3>
                      </div>
                      <button onClick={() => {
                        const newF: Folder = { id: Math.random().toString(36).substr(2, 9), name: 'Nova Pasta', order: activePlan.folders.length };
                        savePlan({ ...activePlan, folders: [...activePlan.folders, newF] });
                      }} className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase px-6 py-3 rounded-2xl border border-zinc-700 transition-all">+ Nova Pasta</button>
                   </div>
                   
                   {activePlan.folders.sort((a,b) => a.order - b.order).map((folder, fIdx) => {
                     const isCollapsed = collapsedFolders.has(folder.id);
                     return (
                      <div key={folder.id} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 transition-all duration-300">
                          <div className={`flex items-center justify-between ${!isCollapsed ? 'border-b border-zinc-800 pb-6' : ''}`}>
                            <div className="flex items-center gap-4">
                                <button onClick={() => toggleFolder(folder.id)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 transition-all">
                                  {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                                </button>
                                <div className="flex flex-col">
                                  <button onClick={() => handleMoveFolder(folder.id, 'up')} className="text-zinc-700 hover:text-white"><ChevronUp size={14} /></button>
                                  <button onClick={() => handleMoveFolder(folder.id, 'down')} className="text-zinc-700 hover:text-white"><ChevronDown size={14} /></button>
                                </div>
                                <input value={folder.name} onChange={(e) => savePlan({ ...activePlan, folders: activePlan.folders.map(f => f.id === folder.id ? { ...f, name: e.target.value } : f) })} className="bg-transparent font-black text-white uppercase text-lg outline-none focus:text-red-500" />
                            </div>
                            <button onClick={() => savePlan({ ...activePlan, folders: activePlan.folders.filter(f => f.id !== folder.id) })} className="text-zinc-700 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                          
                          {!isCollapsed && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                {activePlan.disciplines.filter(d => d.folderId === folder.id).sort((a,b) => a.order - b.order).map(disc => (
                                  <DisciplineNode key={disc.id} disc={disc} activePlan={activePlan} savePlan={savePlan} setIsEditingGoal={setIsEditingGoal} onMove={(dir) => handleMoveDiscipline(disc.id, dir)} />
                                ))}
                                <button onClick={() => {
                                  const newD: Discipline = { id: Math.random().toString(36).substr(2, 9), name: 'Nova Disciplina', topics: [], folderId: folder.id, order: activePlan.disciplines.length };
                                  savePlan({ ...activePlan, disciplines: [...activePlan.disciplines, newD] });
                                }} className="h-full min-h-[100px] border-2 border-dashed border-zinc-800 rounded-[2rem] flex items-center justify-center text-zinc-700 hover:text-red-500 font-black uppercase text-[10px] tracking-widest transition-all">+ Nova Disciplina</button>
                            </div>
                          )}
                      </div>
                     );
                   })}

                   <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] px-4">Independentes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activePlan.disciplines.filter(d => !d.folderId).sort((a,b) => a.order - b.order).map(disc => (
                          <DisciplineNode key={disc.id} disc={disc} activePlan={activePlan} savePlan={savePlan} setIsEditingGoal={setIsEditingGoal} onMove={(dir) => handleMoveDiscipline(disc.id, dir)} />
                        ))}
                        <button onClick={() => {
                          const newD: Discipline = { id: Math.random().toString(36).substr(2, 9), name: 'Nova Disciplina', topics: [], folderId: null, order: activePlan.disciplines.length };
                          savePlan({ ...activePlan, disciplines: [...activePlan.disciplines, newD] });
                        }} className="h-full min-h-[100px] border-2 border-dashed border-zinc-800 rounded-[2rem] flex items-center justify-center text-zinc-700 hover:text-red-500 font-black uppercase text-[10px] tracking-widest transition-all">+ Nova Disciplina</button>
                      </div>
                   </div>
                </section>
              </div>
            ) : (
              <div className="h-[500px] border-2 border-dashed border-zinc-800 rounded-[3rem] flex items-center justify-center bg-zinc-900/10">
                <p className="text-zinc-800 font-black uppercase tracking-[0.3em] text-sm">Selecione uma base de dados no menu lateral</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                 <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Gestão de Alunos</h3>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Controle total de acessos e cadastro de novos perfis</p>
                 </div>
                 <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                       <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar aluno..." className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-red-600 outline-none transition-all" />
                    </div>
                    <button onClick={() => setIsAddingUser(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-red-600/20">
                       <UserPlus size={18} /> Novo Aluno
                    </button>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-zinc-800">
                          <th className="py-4 px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Estudante</th>
                          <th className="py-4 px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">CPF</th>
                          <th className="py-4 px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Planos Ativos</th>
                          <th className="py-4 px-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-right">Ações</th>
                       </tr>
                    </thead>
                    <tbody>
                       {filteredUsers.map(user => (
                          <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                             <td className="py-5 px-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500 font-black">{user.name.charAt(0)}</div>
                                   <div>
                                      <div className="text-sm font-black text-white uppercase tracking-tight">{user.name}</div>
                                      <div className="text-[10px] text-zinc-500">{user.email}</div>
                                   </div>
                                </div>
                             </td>
                             <td className="py-5 px-4 font-mono text-[10px] text-zinc-400">{user.cpf}</td>
                             <td className="py-5 px-4">
                                <div className="flex flex-wrap gap-1">
                                   {user.accessList.map(acc => {
                                      const p = plans.find(plan => plan.id === acc.planId);
                                      return <span key={acc.planId} className="px-2 py-0.5 bg-red-600/10 text-red-500 rounded text-[8px] font-black uppercase border border-red-600/20">{p?.name || '---'}</span>;
                                   })}
                                </div>
                             </td>
                             <td className="py-5 px-4 text-right">
                                <select 
                                  onChange={(e) => {
                                     if(!e.target.value) return;
                                     const has = user.accessList.some(a => a.planId === e.target.value);
                                     toggleUserAccess(user.id, e.target.value, has);
                                     e.target.value = "";
                                  }}
                                  className="bg-zinc-800 text-[9px] font-black uppercase border border-zinc-700 px-3 py-1.5 rounded-lg outline-none hover:border-red-600 transition-colors"
                                >
                                  <option value="">Gerenciar Acesso</option>
                                  {plans.map(p => (
                                     <option key={p.id} value={p.id}>{user.accessList.some(a => a.planId === p.id) ? 'Revogar' : 'Liberar'}: {p.name}</option>
                                  ))}
                                </select>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'identity' && (
        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 space-y-10 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/5 blur-3xl pointer-events-none" />
              <div>
                 <h3 className="text-2xl font-black text-white uppercase tracking-tight">Identidade Visual</h3>
                 <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Personalize a experiência da marca</p>
              </div>
              <div className="flex flex-col items-center gap-8">
                 <div className="w-56 h-56 bg-black rounded-[2.5rem] border-2 border-dashed border-zinc-800 p-8 flex items-center justify-center relative group shadow-2xl">
                    <img src={logoUrl} className="max-w-full max-h-full object-contain transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center rounded-[2.5rem]">
                       <Upload className="text-white" size={32} />
                    </div>
                    <input type="file" ref={logoInputRef} className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if(file) {
                          const reader = new FileReader();
                          reader.onload = () => updateLogo(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                    }} />
                 </div>
                 <div className="flex items-start gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-2xl max-w-sm">
                    <Info size={18} className="text-red-600 shrink-0" />
                    <div className="text-left">
                       <span className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">Guia de Proporção</span>
                       <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed">
                          Recomendado: <span className="text-white">512x512px</span> (Quadrada). Formatos ideais: PNG com fundo transparente ou JPG.
                       </p>
                    </div>
                 </div>
                 <button onClick={() => logoInputRef.current?.click()} className="w-full bg-red-600 hover:bg-red-700 py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-600/20 transition-all">Trocar Logomarca</button>
              </div>
           </div>
        </div>
      )}

      {isAddingUser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-md p-10 space-y-8 shadow-2xl relative">
            <button onClick={() => setIsAddingUser(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X size={24} /></button>
            <div className="text-center">
              <UserPlus className="text-red-600 mx-auto mb-4" size={48} />
              <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Novo Aluno</h4>
            </div>
            <form onSubmit={handleRegisterUser} className="space-y-4">
              <input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Nome Completo" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-600 outline-none" required />
              <input value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} type="email" placeholder="E-mail" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-600 outline-none" required />
              <input value={newUser.cpf} onChange={e => setNewUser({...newUser, cpf: e.target.value})} placeholder="CPF" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-600 outline-none" required />
              <input value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} type="password" placeholder="Senha Provisória" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-600 outline-none" required />
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-4.5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20">Cadastrar Agora</button>
            </form>
          </div>
        </div>
      )}

      {isEditingGoal && (
        <GoalEditorModal activePlan={activePlan!} context={isEditingGoal} onClose={() => setIsEditingGoal(null)} onSave={handleGoalSave} />
      )}
    </div>
  );
};

const DisciplineNode = ({ disc, activePlan, savePlan, setIsEditingGoal, onMove }: any) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (id: string) => {
    const newSet = new Set(collapsedTopics);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCollapsedTopics(newSet);
  };

  const handleMoveTopic = (tIdx: number, dir: 'up' | 'down') => {
    const newList = [...disc.topics];
    const targetIdx = dir === 'up' ? tIdx - 1 : tIdx + 1;
    if(targetIdx < 0 || targetIdx >= newList.length) return;
    [newList[tIdx], newList[targetIdx]] = [newList[targetIdx], newList[tIdx]];
    savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, topics: newList.map((t, i) => ({ ...t, order: i })) } : d) });
  };

  const handleMoveGoal = (topicId: string, gIdx: number, dir: 'up' | 'down') => {
    const updatedDiscs = activePlan.disciplines.map((d: any) => {
      if(d.id !== disc.id) return d;
      return {
        ...d,
        topics: d.topics.map((t: any) => {
          if(t.id !== topicId) return t;
          const newList = [...t.goals];
          const targetIdx = dir === 'up' ? gIdx - 1 : gIdx + 1;
          if(targetIdx < 0 || targetIdx >= newList.length) return t;
          [newList[gIdx], newList[targetIdx]] = [newList[targetIdx], newList[gIdx]];
          return { ...t, goals: newList.map((g, i) => ({ ...g, order: i })) };
        })
      };
    });
    savePlan({ ...activePlan, disciplines: updatedDiscs });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-6 hover:border-zinc-700 transition-all duration-300">
      <div className={`flex items-center justify-between ${!isCollapsed ? 'border-b border-zinc-800 pb-4' : ''}`}>
        <div className="flex items-center gap-3">
           <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-500 transition-all">
             {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
           </button>
           <div className="flex flex-col">
              <button onClick={() => onMove('up')} className="text-zinc-800 hover:text-white"><ChevronUp size={12} /></button>
              <button onClick={() => onMove('down')} className="text-zinc-800 hover:text-white"><ChevronDown size={12} /></button>
           </div>
           <input value={disc.name} onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, name: e.target.value } : d) })} className="bg-transparent font-black text-white uppercase text-xs outline-none focus:text-red-500 transition-colors" />
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => {
              const newT: Topic = { id: Math.random().toString(36).substr(2, 9), title: 'Novo Assunto', order: disc.topics.length, goals: [] };
              savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, topics: [...d.topics, newT] } : d) });
           }} className="p-1.5 bg-zinc-900 hover:bg-red-600/10 hover:text-red-500 rounded-lg transition-all"><Plus size={16} /></button>
           <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.filter((d: any) => d.id !== disc.id) })} className="p-1.5 text-zinc-800 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
          {disc.topics.sort((a: any, b: any) => a.order - b.order).map((topic: any, tIdx: number) => {
            const topicCollapsed = collapsedTopics.has(topic.id);
            return (
              <div key={topic.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => toggleTopic(topic.id)} className="p-1 hover:bg-zinc-800 rounded text-zinc-600 transition-all">
                          {topicCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <div className="flex flex-col">
                          <button onClick={() => handleMoveTopic(tIdx, 'up')} className="text-zinc-800 hover:text-red-500"><ChevronUp size={10} /></button>
                          <button onClick={() => handleMoveTopic(tIdx, 'down')} className="text-zinc-800 hover:text-red-500"><ChevronDown size={10} /></button>
                        </div>
                        <div className="flex-1">
                          <textarea 
                            rows={1}
                            value={topic.title} 
                            onChange={(e) => {
                              savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, topics: d.topics.map((t: any) => t.id === topic.id ? { ...t, title: e.target.value } : t) } : d) });
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            className="bg-transparent font-bold text-zinc-400 text-[10px] uppercase outline-none focus:text-white transition-colors w-full resize-none whitespace-normal break-words leading-relaxed overflow-hidden py-1"
                            onFocus={(e) => {
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                          />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: null })} className="text-red-500 hover:scale-110 transition-transform"><Plus size={14} /></button>
                        <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map((d: any) => d.id === disc.id ? { ...d, topics: d.topics.filter((t: any) => t.id !== topic.id) } : d) })} className="text-zinc-800 hover:text-red-500"><X size={12} /></button>
                    </div>
                  </div>
                  
                  {!topicCollapsed && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                        {topic.goals.sort((a: any, b: any) => a.order - b.order).map((goal: any, gIdx: number) => (
                          <div key={goal.id} className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <button onClick={() => handleMoveGoal(topic.id, gIdx, 'up')} className="text-zinc-900 hover:text-red-500"><ChevronUp size={8} /></button>
                                <button onClick={() => handleMoveGoal(topic.id, gIdx, 'down')} className="text-zinc-900 hover:text-red-500"><ChevronDown size={8} /></button>
                              </div>
                              <button onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: goal.id })} className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg border border-zinc-800 transition-all text-left" style={{ backgroundColor: `${goal.color}10`, borderColor: `${goal.color}20` }}>
                                <span className="text-[8px] font-black uppercase whitespace-normal break-words leading-tight pr-2" style={{ color: goal.color }}>{goal.type}: {goal.title}</span>
                                <Edit size={10} className="text-zinc-800 shrink-0" />
                              </button>
                          </div>
                        ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GoalEditorModal = ({ activePlan, context, onClose, onSave }: any) => {
  const existingGoal = context.gId ? activePlan.disciplines.find((d: any) => d.id === context.dId)?.topics.find((t: any) => t.id === context.tId)?.goals.find((g: any) => g.id === context.gId) : null;
  const [goal, setGoal] = useState<Goal>(existingGoal || { id: Math.random().toString(36).substr(2, 9), type: GoalType.CLASS, title: 'Nova Meta', color: GOAL_COLORS[0], order: 0, links: [], reviewConfig: { enabled: false, intervals: [1, 7, 15, 30], repeatLast: false }, observations: '', multiplier: 1, articles: '', pdfData: '', pdfName: '', subGoals: [] });
  const [linkInput, setLinkInput] = useState('');
  const [intervalsInput, setIntervalsInput] = useState(goal.reviewConfig?.intervals.join(', ') || '1, 7, 15, 30');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Estados para submetas
  const [newSubGoal, setNewSubGoal] = useState({ title: '', minutes: 0, link: '' });

  const handleSave = () => {
    const intervals = intervalsInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    // Se for aula, calcular minutagem total antes de salvar
    let finalGoal = { ...goal, reviewConfig: { ...goal.reviewConfig!, intervals } };
    if (goal.type === GoalType.CLASS) {
      finalGoal.minutes = (goal.subGoals || []).reduce((acc, sub) => acc + sub.minutes, 0);
    }
    onSave(context.dId, context.tId, finalGoal);
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Por favor, selecione um arquivo PDF.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGoal({ ...goal, pdfData: ev.target?.result as string, pdfName: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const addSubGoal = () => {
    if (!newSubGoal.title || newSubGoal.minutes <= 0) return;
    const sub: SubGoal = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSubGoal.title,
      minutes: newSubGoal.minutes,
      link: newSubGoal.link,
      order: (goal.subGoals || []).length
    };
    setGoal({ ...goal, subGoals: [...(goal.subGoals || []), sub] });
    setNewSubGoal({ title: '', minutes: 0, link: '' });
  };

  const removeSubGoal = (id: string) => {
    setGoal({ ...goal, subGoals: (goal.subGoals || []).filter(s => s.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col relative">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
           <div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Editor de Metas</h4>
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mt-1">Configurações precisas de estudo</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-all"><X size={24} className="text-zinc-500" /></button>
        </div>
        <div className="p-8 space-y-8 flex-1 overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Nome da Meta</label>
              <input value={goal.title} onChange={e => setGoal({...goal, title: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-red-600 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Tipo de Atividade</label>
              <select value={goal.type} onChange={e => setGoal({...goal, type: e.target.value as GoalType})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-black uppercase outline-none focus:border-red-600">
                {Object.values(GoalType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {goal.type === GoalType.CLASS ? (
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
               <div className="flex items-center justify-between">
                  <h5 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <Video size={16} /> Cadastro de Submetas de Aulas
                  </h5>
                  <span className="text-white font-black text-xs">Total: {(goal.subGoals || []).reduce((a,b) => a+b.minutes, 0)} min</span>
               </div>
               
               <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <input value={newSubGoal.title} onChange={e => setNewSubGoal({...newSubGoal, title: e.target.value})} placeholder="Nome da Aula" className="md:col-span-5 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-[10px] font-bold outline-none" />
                    <input type="number" value={newSubGoal.minutes || ""} onChange={e => setNewSubGoal({...newSubGoal, minutes: Number(e.target.value)})} placeholder="Min" className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-[10px] font-bold outline-none" />
                    <input value={newSubGoal.link} onChange={e => setNewSubGoal({...newSubGoal, link: e.target.value})} placeholder="Link da Aula" className="md:col-span-4 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-[10px] font-bold outline-none" />
                    <button onClick={addSubGoal} className="md:col-span-1 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700"><Plus size={18} /></button>
                  </div>
                  
                  <div className="space-y-2">
                    {(goal.subGoals || []).sort((a,b) => a.order - b.order).map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/50 p-3 rounded-xl">
                        <div className="flex items-center gap-4">
                           <div className="text-[9px] font-black text-zinc-600">{sub.minutes}M</div>
                           <input 
                             value={sub.title} 
                             onChange={(e) => setGoal({ ...goal, subGoals: (goal.subGoals || []).map(s => s.id === sub.id ? { ...s, title: e.target.value } : s) })}
                             className="bg-transparent text-white text-[10px] font-black uppercase outline-none focus:text-red-500"
                           />
                        </div>
                        <button onClick={() => removeSubGoal(sub.id)} className="text-zinc-800 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Esforço Estimado</label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-4">
                  {goal.type === GoalType.SUMMARY ? (
                    <> <Clock size={16} className="text-zinc-700" /> <input type="number" value={goal.minutes || ""} onChange={e => setGoal({...goal, minutes: Number(e.target.value)})} className="bg-transparent text-white font-black outline-none w-full" placeholder="Minutos" /> </>
                  ) : (
                    <> <FileText size={16} className="text-zinc-700" /> <input type="number" value={goal.pages || ""} onChange={e => setGoal({...goal, pages: Number(e.target.value)})} className="bg-transparent text-white font-black outline-none w-full" placeholder="Páginas" /> </>
                  )}
                </div>
              </div>
              {goal.type === GoalType.LEI_SECA && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Fator Multiplicador (Releitura)</label>
                  <input type="number" min="1" max="5" value={goal.multiplier || 1} onChange={e => setGoal({...goal, multiplier: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:border-red-600" />
                </div>
              )}
            </div>
          )}

          {(goal.type === GoalType.MATERIAL || goal.type === GoalType.QUESTIONS) && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Arquivo Complementar (PDF)</label>
              <div className="flex items-center gap-4">
                 <button onClick={() => pdfInputRef.current?.click()} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-6 py-4 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:border-red-600 transition-all">
                   <FileUp size={16} /> Carregar PDF
                 </button>
                 <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf" onChange={handlePdfUpload} />
                 {goal.pdfName && (
                   <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-4 py-3 rounded-xl">
                      <FileText size={14} className="text-red-500" />
                      <span className="text-[10px] font-bold text-zinc-300 truncate max-w-[200px]">{goal.pdfName}</span>
                      <button onClick={() => setGoal({...goal, pdfData: '', pdfName: ''})} className="text-zinc-600 hover:text-red-500"><X size={14} /></button>
                   </div>
                 )}
              </div>
            </div>
          )}

          {goal.type === GoalType.LEI_SECA && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Artigos Citados</label>
              <input value={goal.articles || ""} onChange={e => setGoal({...goal, articles: e.target.value})} placeholder="Art. 1º ao 10º" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold outline-none" />
            </div>
          )}

          {goal.type !== GoalType.CLASS && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Links de Redirecionamento</label>
              <div className="flex gap-2">
                 <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://..." className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs outline-none" />
                 <button onClick={() => { if(linkInput) { setGoal({...goal, links: [...goal.links, linkInput]}); setLinkInput(""); } }} className="bg-red-600 text-white p-3 rounded-xl"><Plus size={18} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {goal.links.map((link, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 px-3 py-1 rounded-lg flex items-center gap-2">
                    <span className="text-[8px] text-zinc-500 truncate max-w-[150px]">{link}</span>
                    <button onClick={() => setGoal({...goal, links: goal.links.filter((_, idx) => idx !== i)})} className="text-zinc-700 hover:text-red-500"><X size={10} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 space-y-6">
             <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Revisão Espaçada Automática</label>
                <button onClick={() => setGoal({...goal, reviewConfig: {...goal.reviewConfig!, enabled: !goal.reviewConfig?.enabled}})} className={`w-12 h-6 rounded-full transition-colors relative ${goal.reviewConfig?.enabled ? 'bg-red-600' : 'bg-zinc-800'}`}>
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${goal.reviewConfig?.enabled ? 'left-7' : 'left-1'}`} />
                </button>
             </div>
             {goal.reviewConfig?.enabled && (
               <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Intervalos (Dias separador por vírgula)</label>
                    <input value={intervalsInput} onChange={e => setIntervalsInput(e.target.value)} placeholder="1, 7, 15, 30" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={goal.repeatLast || (goal.reviewConfig && goal.reviewConfig.repeatLast)} onChange={e => setGoal({...goal, reviewConfig: {...goal.reviewConfig!, repeatLast: e.target.checked}})} className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-red-600" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Repetir último indicador infinitamente</span>
                  </label>
               </div>
             )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Cor no Calendário</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map(c => (
                <button key={c} onClick={() => setGoal({...goal, color: c})} className={`w-10 h-10 rounded-xl border-2 transition-all ${goal.color === c ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="p-8 border-t border-zinc-800 flex gap-4 bg-zinc-950/50">
          <button onClick={onClose} className="flex-1 py-4.5 rounded-2xl border border-zinc-800 text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:bg-zinc-900 transition-colors">Cancelar</button>
          <button onClick={handleSave} className="flex-1 py-4.5 rounded-2xl bg-red-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/30 hover:bg-red-700 transition-colors">Confirmar Alterações</button>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
