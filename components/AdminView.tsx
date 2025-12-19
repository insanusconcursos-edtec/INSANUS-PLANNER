
import React, { useState } from 'react';
import { 
  Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Image as ImageIcon, Link as LinkIcon, RefreshCw, 
  Clock, GraduationCap, Folder as FolderIcon, 
  Users, Code, Search, UserPlus, Key, ShieldCheck,
  Calendar, Edit, X, Save, Layers, Settings2, ExternalLink,
  Lock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { StudyPlan, Discipline, Topic, Goal, GoalType, CycleSystem, StudyCycle, Folder, RegisteredUser, PlanAccess } from '../types.ts';
import { GOAL_COLORS } from '../constants.tsx';
import { db } from '../firebase.ts';
import { doc, setDoc, deleteDoc, collection, addDoc } from "firebase/firestore";

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
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [isManagingAccess, setIsManagingAccess] = useState<string | null>(null);
  
  // UI States for Plan Editor
  const [isEditingGoal, setIsEditingGoal] = useState<{ dId: string, tId: string, gId: string | null } | null>(null);

  const activePlan = plans.find(p => p.id === selectedPlanId);

  const filteredUsers = users.filter(u => 
    u.role === 'USER' && (
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.cpf.includes(userSearch)
    )
  );

  const savePlan = async (plan: StudyPlan) => {
    await setDoc(doc(db, "plans", plan.id), plan);
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

  const addDiscipline = async () => {
    if (!activePlan) return;
    const newD: Discipline = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Nova Disciplina',
      topics: [],
      folderId: null
    };
    await savePlan({ ...activePlan, disciplines: [...activePlan.disciplines, newD] });
  };

  const addTopic = async (dId: string) => {
    if (!activePlan) return;
    const newT: Topic = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Assunto',
      order: activePlan.disciplines.find(d => d.id === dId)?.topics.length || 0,
      goals: []
    };
    const updated = activePlan.disciplines.map(d => 
      d.id === dId ? { ...d, topics: [...d.topics, newT] } : d
    );
    await savePlan({ ...activePlan, disciplines: updated });
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
          return {
            ...t,
            goals: exists ? t.goals.map(g => g.id === goal.id ? goal : g) : [...t.goals, goal]
          };
        })
      };
    });
    await savePlan({ ...activePlan, disciplines: updated });
    setIsEditingGoal(null);
  };

  const moveTopic = async (dId: string, tId: string, direction: 'up' | 'down') => {
    if (!activePlan) return;
    const disc = activePlan.disciplines.find(d => d.id === dId);
    if (!disc) return;
    const idx = disc.topics.findIndex(t => t.id === tId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === disc.topics.length - 1)) return;
    
    const newTopics = [...disc.topics];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newTopics[idx], newTopics[targetIdx]] = [newTopics[targetIdx], newTopics[idx]];
    
    const ordered = newTopics.map((t, i) => ({ ...t, order: i }));
    const updated = activePlan.disciplines.map(d => d.id === dId ? { ...d, topics: ordered } : d);
    await savePlan({ ...activePlan, disciplines: updated });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const id = Math.random().toString(36).substr(2, 9);
    const newUser: RegisteredUser = {
      id,
      name: formData.get('name') as string,
      cpf: formData.get('cpf') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: 'USER',
      accessList: []
    };

    await setDoc(doc(db, "users", id), newUser);
    form.reset();
    alert("Usuário criado com sucesso!");
  };

  const togglePlanAccess = async (userId: string, planId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const hasAccess = user.accessList.some(a => a.planId === planId);
    let newAccessList: PlanAccess[] = [];

    if (hasAccess) {
      newAccessList = user.accessList.filter(a => a.planId !== planId);
    } else {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 ano de acesso
      newAccessList = [...user.accessList, { 
        planId, 
        assignedAt: new Date().toISOString(), 
        expiresAt: expiresAt.toISOString() 
      }];
    }

    await setDoc(doc(db, "users", userId), { accessList: newAccessList }, { merge: true });
  };

  const embedCode = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 12px; border: 1px solid #333;">
  <iframe src="${window.location.origin}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allow="camera; microphone; geolocation" allowfullscreen></iframe>
</div>`;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Sistema Administrativo</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Controle total do ecossistema Insanus</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'plans', label: 'Planos', icon: FileText },
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'identity', label: 'Visual', icon: ImageIcon },
            { id: 'embed', label: 'Embed', icon: Code },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ABA: IDENTIDADE VISUAL */}
      {activeTab === 'identity' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4 text-red-500">
            <ImageIcon size={32} />
            <div>
              <h3 className="text-2xl font-black text-white uppercase">Personalização Visual</h3>
              <p className="text-zinc-500 text-xs font-bold">Defina a logomarca que aparecerá para todos os usuários</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">URL da Logomarca (PNG/SVG recomendado)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={logoUrl} 
                  onChange={(e) => updateLogo(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-500 outline-none transition-all"
                  placeholder="https://sua-logo.com/imagem.png"
                />
              </div>
              <p className="text-[10px] text-zinc-600 italic">* Alterações são salvas automaticamente na nuvem.</p>
            </div>
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 rounded-[2.5rem] border border-zinc-800 border-dashed">
              <span className="text-[10px] font-bold text-zinc-700 uppercase mb-4">Pré-visualização</span>
              <img src={logoUrl} alt="Logo Preview" className="w-32 h-32 object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* ABA: EMBED */}
      {activeTab === 'embed' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6 max-w-3xl mx-auto animate-in zoom-in-95">
          <div className="flex items-center gap-4 text-red-500">
            <Code size={32} />
            <h3 className="text-2xl font-black text-white uppercase">Código de Incorporação</h3>
          </div>
          <p className="text-zinc-500 text-sm">Copie o código abaixo para inserir o sistema em qualquer outro site ou plataforma de membros.</p>
          <div className="relative">
            <pre className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-[10px] text-red-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {embedCode}
            </pre>
            <button 
              onClick={() => { navigator.clipboard.writeText(embedCode); alert("Código copiado!"); }}
              className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg text-white transition-all"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ABA: USUÁRIOS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl">
              <h3 className="text-xl font-black text-white mb-8 flex items-center gap-2 uppercase tracking-tighter">
                <UserPlus size={20} className="text-red-500" /> Cadastrar Aluno
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Nome Completo</label>
                  <input name="name" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">CPF (Apenas números)</label>
                  <input name="cpf" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">E-mail de Acesso</label>
                  <input name="email" type="email" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Senha Inicial</label>
                  <input name="password" type="text" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm text-white focus:border-red-500 outline-none" />
                </div>
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all mt-4">
                  Confirmar Cadastro
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4">
              <Search className="text-zinc-600" size={20} />
              <input 
                placeholder="Buscar por Nome, E-mail ou CPF..." 
                className="bg-transparent border-none outline-none text-sm text-white w-full font-medium"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950/50 text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em] border-b border-zinc-800">
                  <tr>
                    <th className="px-8 py-5">Perfil do Aluno</th>
                    <th className="px-8 py-5 text-center">Acessos Ativos</th>
                    <th className="px-8 py-5 text-right">Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-black text-zinc-100 uppercase tracking-tighter">{user.name}</div>
                        <div className="text-[10px] text-zinc-600 font-bold">{user.email} • CPF: {user.cpf}</div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button 
                          onClick={() => setIsManagingAccess(user.id)}
                          className="bg-zinc-800 hover:bg-red-600/20 hover:text-red-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-700 transition-all"
                        >
                          {user.accessList.length} Plano(s)
                        </button>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-all">
                          <button onClick={() => setEditingUser(user)} className="p-2 text-zinc-400 hover:text-white"><Edit size={18} /></button>
                          <button onClick={async () => {
                            if(confirm(`Excluir usuário ${user.name}?`)) await deleteDoc(doc(db, "users", user.id));
                          }} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA: PLANOS (EDITOR EXISTENTE) */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
           <div className="lg:col-span-1 space-y-4">
              <button onClick={createPlan} className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-600/20">
                <Plus size={18} /> Novo Plano
              </button>
              <div className="space-y-2">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                      selectedPlanId === plan.id ? 'bg-red-600/10 border-red-500 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-black uppercase tracking-tighter text-sm">{plan.name}</div>
                    <div className="text-[10px] mt-1 uppercase font-bold tracking-widest opacity-60">{plan.disciplines.length} Disciplinas</div>
                    {selectedPlanId === plan.id && <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-600" />}
                  </button>
                ))}
              </div>
           </div>

           <div className="lg:col-span-3">
              {activePlan ? (
                <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                      <FileText size={160} />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex-1">
                        <input 
                          value={activePlan.name}
                          onChange={(e) => savePlan({ ...activePlan, name: e.target.value })}
                          className="text-4xl font-black bg-transparent border-none focus:ring-0 text-white w-full outline-none uppercase tracking-tighter"
                        />
                        <div className="mt-4 flex flex-wrap items-center gap-6">
                           <div className="flex items-center gap-2 text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                             <ImageIcon size={14} className="text-red-500" />
                             <input 
                               value={activePlan.imageUrl}
                               onChange={(e) => savePlan({ ...activePlan, imageUrl: e.target.value })}
                               className="text-[10px] font-bold bg-transparent outline-none w-48"
                               placeholder="URL da Imagem de Capa"
                             />
                           </div>
                           <div className="flex items-center gap-2 text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
                             <Settings2 size={14} className="text-red-500" />
                             <select 
                               value={activePlan.cycleSystem}
                               onChange={(e) => savePlan({ ...activePlan, cycleSystem: e.target.value as CycleSystem })}
                               className="text-[10px] bg-transparent outline-none uppercase font-black"
                             >
                               <option value={CycleSystem.CONTINUOUS}>Sistema Contínuo</option>
                               <option value={CycleSystem.ROTATING}>Sistema Rotativo</option>
                             </select>
                           </div>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if(confirm("Excluir plano permanentemente?")) {
                          await deleteDoc(doc(db, "plans", activePlan.id));
                          setSelectedPlanId(null);
                        }
                      }} className="text-red-500 font-black text-[10px] uppercase tracking-widest hover:text-red-400 bg-red-500/10 px-4 py-2 rounded-xl transition-all">Excluir Plano</button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                      <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                        <Layers size={22} className="text-red-500" /> Grade Curricular do Plano
                      </h3>
                      <button onClick={addDiscipline} className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-2xl transition-all shadow-lg">
                        + Nova Disciplina
                      </button>
                    </div>

                    <div className="space-y-6">
                      {activePlan.disciplines.map(disc => (
                        <div key={disc.id} className="bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-xl backdrop-blur-sm">
                          <div className="px-8 py-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/40">
                            <div className="flex-1 flex items-center gap-4">
                              <FolderIcon size={20} className="text-red-500" />
                              <input 
                                value={disc.name}
                                onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, name: e.target.value } : d) })}
                                className="font-black text-lg bg-transparent border-none text-white outline-none w-full uppercase tracking-tight"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => addTopic(disc.id)} className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white px-4 py-2 bg-zinc-800 rounded-xl transition-all">+ Assunto</button>
                              <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.filter(d => d.id !== disc.id) })} className="p-3 text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                            </div>
                          </div>
                          
                          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {disc.topics.sort((a,b) => a.order - b.order).map(topic => (
                              <div key={topic.id} className="bg-zinc-950 border border-zinc-800 rounded-[1.5rem] p-5 flex items-center justify-between group hover:border-zinc-600 transition-all">
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'up')} className="text-zinc-700 hover:text-zinc-100"><ChevronUp size={16} /></button>
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'down')} className="text-zinc-700 hover:text-zinc-100"><ChevronDown size={16} /></button>
                                  </div>
                                  <div>
                                    <input 
                                      value={topic.title}
                                      onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.map(t => t.id === topic.id ? { ...t, title: e.target.value } : t) } : d) })}
                                      className="font-black text-sm bg-transparent text-zinc-200 outline-none uppercase tracking-tight"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {topic.goals.map(g => (
                                        <button 
                                          key={g.id} 
                                          onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: g.id })}
                                          className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-sm transition-all hover:scale-110"
                                          style={{ backgroundColor: `${g.color}20`, color: g.color, borderColor: `${g.color}40` }}
                                        >
                                          {g.type}
                                        </button>
                                      ))}
                                      <button 
                                        onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: null })}
                                        className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-all"
                                      >
                                        + Meta
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.filter(t => t.id !== topic.id) } : d) })} className="opacity-0 group-hover:opacity-100 p-3 text-zinc-800 hover:text-red-500 transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[500px] border-2 border-dashed border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center text-zinc-800 space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-600 blur-[60px] opacity-10 animate-pulse" />
                    <FileText size={80} className="relative z-10 opacity-20" />
                  </div>
                  <p className="font-black uppercase tracking-[0.4em] text-xs">Selecione um plano no menu lateral</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* MODAL: GESTÃO DE ACESSO */}
      {isManagingAccess && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden">
              <div className="p-10 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                <div>
                  <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Gestão de Acesso</h4>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Liberar planos para o aluno</p>
                </div>
                <button onClick={() => setIsManagingAccess(null)} className="p-3 hover:bg-zinc-800 rounded-2xl transition-all"><X size={24} className="text-zinc-500" /></button>
              </div>
              <div className="p-10 space-y-4 max-h-[50vh] overflow-y-auto">
                {plans.length > 0 ? plans.map(plan => {
                  const user = users.find(u => u.id === isManagingAccess);
                  const hasAccess = user?.accessList.some(a => a.planId === plan.id);
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-5 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <div className="flex items-center gap-4">
                        <img src={plan.imageUrl} className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                          <div className="font-black text-sm uppercase text-white">{plan.name}</div>
                          <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{hasAccess ? 'Acesso Ativo' : 'Acesso Negado'}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => togglePlanAccess(isManagingAccess!, plan.id)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          hasAccess ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {hasAccess ? 'Revogar' : 'Liberar'}
                      </button>
                    </div>
                  );
                }) : (
                  <div className="text-center py-10">
                    <AlertCircle size={40} className="mx-auto text-zinc-800 mb-4" />
                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Nenhum plano cadastrado ainda.</p>
                  </div>
                )}
              </div>
              <div className="p-8 bg-zinc-950/80 text-center">
                 <p className="text-[9px] text-zinc-600 uppercase font-black tracking-[0.2em]">O acesso expira automaticamente após 1 ano da liberação.</p>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: EDITOR DE META */}
      {isEditingGoal && (
        <GoalEditorModal 
          activePlan={activePlan!}
          context={isEditingGoal}
          onClose={() => setIsEditingGoal(null)}
          onSave={handleGoalSave}
        />
      )}
    </div>
  );
};

// Subcomponent for Goal Editing (Mantendo o que já estava implementado mas garantindo importações)
const GoalEditorModal = ({ activePlan, context, onClose, onSave }: any) => {
  const existingGoal = context.gId ? 
    activePlan.disciplines.find((d: any) => d.id === context.dId)?.topics.find((t: any) => t.id === context.tId)?.goals.find((g: any) => g.id === context.gId) : null;

  const [goal, setGoal] = useState<Goal>(existingGoal || {
    id: Math.random().toString(36).substr(2, 9),
    type: GoalType.CLASS,
    title: 'Nova Meta',
    color: GOAL_COLORS[0],
    order: 0,
    links: [],
    reviewConfig: { enabled: false, intervals: [1, 7, 15, 30], repeatLast: false }
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900 z-10">
          <h4 className="text-2xl font-black text-white uppercase tracking-tight">Configurar Meta</h4>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-all"><X size={24} className="text-zinc-500" /></button>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Tipo de Meta</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(GoalType).map(type => (
                  <button 
                    key={type}
                    onClick={() => setGoal({ ...goal, type })}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${goal.type === type ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Cor de Destaque</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map(color => (
                  <button 
                    key={color} 
                    onClick={() => setGoal({ ...goal, color })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${goal.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Parâmetros da Meta</label>
            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {(goal.type === GoalType.CLASS || goal.type === GoalType.SUMMARY) && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-400">Duração (Minutos)</span>
                  <input 
                    type="number"
                    value={goal.minutes || ''}
                    onChange={(e) => setGoal({ ...goal, minutes: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>
              )}
              {(goal.type === GoalType.MATERIAL || goal.type === GoalType.QUESTIONS || goal.type === GoalType.LEI_SECA) && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-400">Quantidade de Páginas</span>
                  <input 
                    type="number"
                    value={goal.pages || ''}
                    onChange={(e) => setGoal({ ...goal, pages: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
                  />
                </div>
              )}
              {goal.type === GoalType.LEI_SECA && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-400">Fator Multiplicador</span>
                  <select 
                    value={goal.multiplier || 1}
                    onChange={(e) => setGoal({ ...goal, multiplier: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
                  >
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}x</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Links de Referência (Abrem em nova guia)</label>
              <button 
                onClick={() => setGoal({ ...goal, links: [...goal.links, ''] })}
                className="text-[10px] font-bold text-red-500"
              >+ Adicionar Link</button>
            </div>
            {goal.links.map((link, idx) => (
              <div key={idx} className="flex gap-2">
                <input 
                  value={link}
                  onChange={(e) => {
                    const newLinks = [...goal.links];
                    newLinks[idx] = e.target.value;
                    setGoal({ ...goal, links: newLinks });
                  }}
                  placeholder="https://..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300 outline-none"
                />
                <button onClick={() => setGoal({ ...goal, links: goal.links.filter((_, i) => i !== idx) })} className="p-3 text-zinc-700 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {(goal.type === GoalType.QUESTIONS || goal.type === GoalType.LEI_SECA || goal.type === GoalType.SUMMARY) && (
            <div className="bg-red-950/10 border border-red-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-red-500" />
                  <span className="font-bold text-white">Sistema de Revisão Espaçada</span>
                </div>
                <input 
                  type="checkbox"
                  checked={goal.reviewConfig?.enabled || false}
                  onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, enabled: e.target.checked } })}
                  className="w-5 h-5 rounded border-zinc-800 bg-zinc-900 checked:bg-red-600 transition-all"
                />
              </div>
              {goal.reviewConfig?.enabled && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-black">Intervalos (em dias, separados por vírgula)</span>
                    <input 
                      value={goal.reviewConfig.intervals.join(', ')}
                      onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, intervals: e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) } })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300"
                      placeholder="1, 7, 15, 30"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={goal.reviewConfig.repeatLast}
                      onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, repeatLast: e.target.checked } })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-xs text-zinc-400">Repetir último indicador indefinidamente</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-8 border-t border-zinc-800 flex gap-4 bg-zinc-900/50">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-zinc-800 text-zinc-500 font-bold uppercase text-xs">Cancelar</button>
          <button onClick={() => onSave(context.dId, context.tId, goal)} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold uppercase text-xs shadow-lg shadow-red-600/20">Salvar Meta</button>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
