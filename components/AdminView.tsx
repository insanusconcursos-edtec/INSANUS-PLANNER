
import React, { useState } from 'react';
import { 
  Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Image as ImageIcon, Link as LinkIcon, RefreshCw, 
  Clock, GraduationCap, Folder as FolderIcon, 
  Users, Code, Search, UserPlus, Key, ShieldCheck,
  Calendar, Edit, X, Save, Layers, Settings2, ExternalLink,
  Lock, CheckCircle2, AlertCircle, Copy
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

  // Melhoria na altura do Embed: Deixando fixo em 850px para garantir que caiba o planejamento completo
  const embedCode = `<div style="width: 100%; height: 850px; max-height: 95vh; overflow: hidden; background: #0a0a0a; border-radius: 24px; border: 1px solid #27272a; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
  <iframe src="${window.location.origin}" style="width: 100%; height: 100%; border:0;" allow="camera; microphone; geolocation" allowfullscreen></iframe>
</div>`;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Painel de Administração</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Controle o ecossistema Concurseiro Pro</p>
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
              <h3 className="text-2xl font-black text-white uppercase">Personalização da Marca</h3>
              <p className="text-zinc-500 text-xs font-bold">Gerencie como a logo aparece no sistema</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">URL da Logomarca (Transparente)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={logoUrl} 
                  onChange={(e) => updateLogo(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-red-500 outline-none transition-all"
                  placeholder="Ex: https://dominio.com/logo.png"
                />
              </div>
              <p className="text-[10px] text-zinc-600 italic">As mudanças são aplicadas instantaneamente para todos os alunos.</p>
            </div>
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-950 rounded-[2.5rem] border border-zinc-800 border-dashed">
              <span className="text-[10px] font-bold text-zinc-700 uppercase mb-6">Pré-visualização da Logo</span>
              <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
                <img src={logoUrl} alt="Logo Preview" className="max-w-[120px] max-h-[120px] object-contain" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA: EMBED */}
      {activeTab === 'embed' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 max-w-4xl mx-auto animate-in zoom-in-95">
          <div className="flex items-center gap-4 text-red-500">
            <Code size={32} />
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Código de Incorporação (Embed)</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Insira o planner em seu site com altura otimizada</p>
            </div>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Utilize o código abaixo para embutir a plataforma de estudos em sua área de membros. 
            O código foi configurado com uma altura de <span className="text-white font-bold">850px</span> para garantir que o calendário e as metas fiquem visíveis sem cortes excessivos.
          </p>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 to-zinc-800/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <pre className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-[11px] text-red-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {embedCode}
            </pre>
            <button 
              onClick={() => { navigator.clipboard.writeText(embedCode); alert("Código copiado para a área de transferência!"); }}
              className="absolute top-6 right-6 bg-red-600 hover:bg-red-500 p-3 rounded-xl text-white shadow-xl transition-all flex items-center gap-2 font-bold text-[10px] uppercase"
            >
              <Copy size={16} /> Copiar Código
            </button>
          </div>
          <div className="bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 flex items-start gap-3">
            <AlertCircle className="text-zinc-600 shrink-0" size={20} />
            <p className="text-zinc-500 text-xs">
              <strong>Dica:</strong> Se precisar de uma altura ainda maior, você pode alterar o valor de <code className="text-zinc-300">height: 850px</code> para o valor desejado no código acima.
            </p>
          </div>
        </div>
      )}

      {/* ABA: USUÁRIOS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl sticky top-20">
              <h3 className="text-xl font-black text-white mb-8 flex items-center gap-2 uppercase tracking-tighter">
                <UserPlus size={22} className="text-red-500" /> Novo Aluno
              </h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Nome Completo</label>
                  <input name="name" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">CPF (Login)</label>
                  <input name="cpf" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500 outline-none transition-all" placeholder="Apenas números" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">E-mail</label>
                  <input name="email" type="email" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase ml-1">Senha de Acesso</label>
                  <input name="password" type="text" required className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm text-white focus:border-red-500 outline-none transition-all" />
                </div>
                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all mt-6">
                  Cadastrar Aluno
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4.5 shadow-lg">
              <Search className="text-zinc-600" size={20} />
              <input 
                placeholder="Pesquisar por Nome, E-mail ou CPF..." 
                className="bg-transparent border-none outline-none text-sm text-white w-full font-medium"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950/50 text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em] border-b border-zinc-800">
                  <tr>
                    <th className="px-8 py-6">Informações do Aluno</th>
                    <th className="px-8 py-6 text-center">Planos Liberados</th>
                    <th className="px-8 py-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredUsers.length > 0 ? filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-black text-zinc-100 uppercase tracking-tighter text-base">{user.name}</div>
                        <div className="text-[10px] text-zinc-600 font-bold mt-0.5">{user.email} • CPF: {user.cpf}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button 
                          onClick={() => setIsManagingAccess(user.id)}
                          className="bg-zinc-800 hover:bg-red-600/10 hover:text-red-500 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-700 transition-all"
                        >
                          {user.accessList.length} PLANO(S)
                        </button>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setEditingUser(user)} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"><Edit size={16} /></button>
                          <button onClick={async () => {
                            if(confirm(`Tem certeza que deseja remover permanentemente o acesso de ${user.name}?`)) await deleteDoc(doc(db, "users", user.id));
                          }} className="p-2.5 bg-zinc-800 hover:bg-red-900/40 rounded-xl text-zinc-400 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <Users size={40} className="mx-auto text-zinc-800 mb-4 opacity-20" />
                        <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Nenhum aluno encontrado.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA: PLANOS */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in">
           <div className="lg:col-span-1 space-y-4">
              <button onClick={createPlan} className="w-full bg-red-600 hover:bg-red-700 py-4.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-600/20">
                <Plus size={20} /> Criar Novo Plano
              </button>
              <div className="space-y-2">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-6 rounded-2xl border transition-all relative overflow-hidden group ${
                      selectedPlanId === plan.id ? 'bg-red-600/10 border-red-500 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-black uppercase tracking-tighter text-sm">{plan.name}</div>
                    <div className="text-[10px] mt-1.5 uppercase font-bold tracking-widest opacity-60">{plan.disciplines.length} Disciplinas Ativas</div>
                    {selectedPlanId === plan.id && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-600" />}
                  </button>
                ))}
              </div>
           </div>

           <div className="lg:col-span-3">
              {activePlan ? (
                <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 space-y-6 shadow-2xl relative overflow-hidden group/plan">
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover/plan:scale-110 transition-transform duration-1000">
                      <FileText size={180} />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex-1">
                        <input 
                          value={activePlan.name}
                          onChange={(e) => savePlan({ ...activePlan, name: e.target.value })}
                          className="text-4xl font-black bg-transparent border-none focus:ring-0 text-white w-full outline-none uppercase tracking-tighter"
                        />
                        <div className="mt-6 flex flex-wrap items-center gap-6">
                           <div className="flex items-center gap-2 text-zinc-500 bg-zinc-950 px-4 py-2.5 rounded-2xl border border-zinc-800">
                             <ImageIcon size={14} className="text-red-500" />
                             <input 
                               value={activePlan.imageUrl}
                               onChange={(e) => savePlan({ ...activePlan, imageUrl: e.target.value })}
                               className="text-[10px] font-bold bg-transparent outline-none w-56"
                               placeholder="URL da Capa do Plano"
                             />
                           </div>
                           <div className="flex items-center gap-2 text-zinc-500 bg-zinc-950 px-4 py-2.5 rounded-2xl border border-zinc-800">
                             <Settings2 size={14} className="text-red-500" />
                             <select 
                               value={activePlan.cycleSystem}
                               onChange={(e) => savePlan({ ...activePlan, cycleSystem: e.target.value as CycleSystem })}
                               className="text-[10px] bg-transparent outline-none uppercase font-black"
                             >
                               <option value={CycleSystem.CONTINUOUS}>Fluxo Contínuo</option>
                               <option value={CycleSystem.ROTATING}>Fluxo Rotativo</option>
                             </select>
                           </div>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if(confirm("ATENÇÃO: Deseja apagar este plano e TODAS as suas disciplinas permanentemente?")) {
                          await deleteDoc(doc(db, "plans", activePlan.id));
                          setSelectedPlanId(null);
                        }
                      }} className="text-red-500 font-black text-[10px] uppercase tracking-widest hover:text-white hover:bg-red-600 bg-red-600/10 px-6 py-3 rounded-2xl transition-all">Apagar Plano</button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                      <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                        <Layers size={22} className="text-red-500" /> Estrutura do Plano
                      </h3>
                      <button onClick={addDiscipline} className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 py-4 rounded-[1.5rem] transition-all shadow-xl">
                        + Nova Disciplina
                      </button>
                    </div>

                    <div className="space-y-8">
                      {activePlan.disciplines.map(disc => (
                        <div key={disc.id} className="bg-zinc-900/60 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-md">
                          <div className="px-10 py-7 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/40">
                            <div className="flex-1 flex items-center gap-5">
                              <FolderIcon size={24} className="text-red-500" />
                              <input 
                                value={disc.name}
                                onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, name: e.target.value } : d) })}
                                className="font-black text-xl bg-transparent border-none text-white outline-none w-full uppercase tracking-tight"
                              />
                            </div>
                            <div className="flex items-center gap-4">
                              <button onClick={() => addTopic(disc.id)} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white px-5 py-2.5 bg-zinc-800 rounded-2xl transition-all">+ Assunto</button>
                              <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.filter(d => d.id !== disc.id) })} className="p-3.5 text-zinc-600 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                            </div>
                          </div>
                          
                          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-5">
                            {disc.topics.sort((a,b) => a.order - b.order).map(topic => (
                              <div key={topic.id} className="bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 flex items-center justify-between group hover:border-red-600/30 transition-all duration-500">
                                <div className="flex items-center gap-5">
                                  <div className="flex flex-col gap-1.5">
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'up')} className="text-zinc-700 hover:text-red-500"><ChevronUp size={18} /></button>
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'down')} className="text-zinc-700 hover:text-red-500"><ChevronDown size={18} /></button>
                                  </div>
                                  <div>
                                    <input 
                                      value={topic.title}
                                      onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.map(t => t.id === topic.id ? { ...t, title: e.target.value } : t) } : d) })}
                                      className="font-black text-sm bg-transparent text-zinc-200 outline-none uppercase tracking-tight mb-2 block"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      {topic.goals.map(g => (
                                        <button 
                                          key={g.id} 
                                          onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: g.id })}
                                          className="text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border shadow-sm transition-all hover:brightness-125"
                                          style={{ backgroundColor: `${g.color}20`, color: g.color, borderColor: `${g.color}40` }}
                                        >
                                          {g.type}
                                        </button>
                                      ))}
                                      <button 
                                        onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: null })}
                                        className="text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border border-dashed border-zinc-800 text-zinc-700 hover:text-zinc-400 hover:border-zinc-600 transition-all"
                                      >
                                        + Meta
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.filter(t => t.id !== topic.id) } : d) })} className="opacity-0 group-hover:opacity-100 p-4 text-zinc-800 hover:text-red-500 transition-all">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                            {disc.topics.length === 0 && (
                              <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-900 rounded-[2rem]">
                                <p className="text-zinc-800 font-black uppercase text-[10px] tracking-widest">Nenhum assunto cadastrado.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[600px] border-2 border-dashed border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center text-zinc-800 space-y-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-600 blur-[80px] opacity-10 animate-pulse" />
                    <FileText size={100} className="relative z-10 opacity-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="font-black uppercase tracking-[0.5em] text-[10px] text-zinc-700">Selecione um plano de estudos</p>
                    <p className="text-[10px] text-zinc-800 font-bold uppercase tracking-widest">Ou crie um novo para gerenciar</p>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* MODAL: GESTÃO DE ACESSO */}
      {isManagingAccess && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-10 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 shrink-0">
                <div>
                  <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Planos Disponíveis</h4>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Habilite ou revogue acessos individuais</p>
                </div>
                <button onClick={() => setIsManagingAccess(null)} className="p-4 hover:bg-zinc-800 rounded-2xl transition-all"><X size={28} className="text-zinc-500" /></button>
              </div>
              <div className="p-10 space-y-4 overflow-y-auto flex-1">
                {plans.length > 0 ? plans.map(plan => {
                  const user = users.find(u => u.id === isManagingAccess);
                  const hasAccess = user?.accessList.some(a => a.planId === plan.id);
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-6 bg-zinc-950 rounded-3xl border border-zinc-800 hover:border-zinc-700 transition-all group">
                      <div className="flex items-center gap-5">
                        <img src={plan.imageUrl} className="w-14 h-14 rounded-2xl object-cover shadow-lg group-hover:scale-105 transition-transform" />
                        <div>
                          <div className="font-black text-sm uppercase text-white tracking-tight">{plan.name}</div>
                          <div className={`text-[9px] font-black uppercase tracking-widest mt-1 ${hasAccess ? 'text-green-500' : 'text-zinc-700'}`}>
                            {hasAccess ? 'Acesso Permitido' : 'Sem Autorização'}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => togglePlanAccess(isManagingAccess!, plan.id)}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          hasAccess ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white'
                        }`}
                      >
                        {hasAccess ? 'Revogar' : 'Liberar'}
                      </button>
                    </div>
                  );
                }) : (
                  <div className="text-center py-20">
                    <AlertCircle size={48} className="mx-auto text-zinc-800 mb-6 opacity-20" />
                    <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Nenhum plano disponível para vincular.</p>
                  </div>
                )}
              </div>
              <div className="p-10 bg-zinc-950/80 text-center border-t border-zinc-800 shrink-0">
                 <p className="text-[9px] text-zinc-600 uppercase font-black tracking-[0.3em]">Gerenciamento de licenças do aluno • 365 dias de vigência</p>
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

// Subcomponent for Goal Editing
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-10 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-zinc-900/80 backdrop-blur-md z-10 shrink-0">
          <div>
            <h4 className="text-3xl font-black text-white uppercase tracking-tighter">Configuração da Meta</h4>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Defina os parâmetros técnicos de estudo</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-zinc-800 rounded-2xl transition-all"><X size={32} className="text-zinc-500" /></button>
        </div>
        
        <div className="p-10 space-y-10 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Selecione o Tipo</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(GoalType).map(type => (
                  <button 
                    key={type}
                    onClick={() => setGoal({ ...goal, type })}
                    className={`py-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${goal.type === type ? 'bg-red-600 border-red-500 text-white shadow-xl' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Escolha a Cor de Identificação</label>
              <div className="flex flex-wrap gap-3">
                {GOAL_COLORS.map(color => (
                  <button 
                    key={color} 
                    onClick={() => setGoal({ ...goal, color })}
                    className={`w-10 h-10 rounded-2xl border-2 transition-all hover:scale-110 ${goal.color === color ? 'border-white ring-4 ring-white/10 scale-110 shadow-xl' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Métricas de Planejamento</label>
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {(goal.type === GoalType.CLASS || goal.type === GoalType.SUMMARY) && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Duração Total (Minutos)</span>
                  <input 
                    type="number"
                    value={goal.minutes || ''}
                    onChange={(e) => setGoal({ ...goal, minutes: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-red-500 transition-all"
                    placeholder="Ex: 120"
                  />
                </div>
              )}
              {(goal.type === GoalType.MATERIAL || goal.type === GoalType.QUESTIONS || goal.type === GoalType.LEI_SECA) && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Volume de Páginas</span>
                  <input 
                    type="number"
                    value={goal.pages || ''}
                    onChange={(e) => setGoal({ ...goal, pages: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-red-500 transition-all"
                    placeholder="Ex: 30"
                  />
                </div>
              )}
              {goal.type === GoalType.LEI_SECA && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Intensidade (Multiplicador)</span>
                  <select 
                    value={goal.multiplier || 1}
                    onChange={(e) => setGoal({ ...goal, multiplier: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-black uppercase outline-none focus:border-red-500 appearance-none transition-all"
                  >
                    {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}x Repetições</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Conteúdo Externo (Links)</label>
              <button 
                onClick={() => setGoal({ ...goal, links: [...goal.links, ''] })}
                className="text-[10px] font-black uppercase text-red-500 bg-red-600/10 px-4 py-2 rounded-xl border border-red-600/20 hover:bg-red-600/20 transition-all"
              >+ Link Adicional</button>
            </div>
            <div className="space-y-3">
              {goal.links.map((link, idx) => (
                <div key={idx} className="flex gap-3 animate-in slide-in-from-right-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
                    <input 
                      value={link}
                      onChange={(e) => {
                        const newLinks = [...goal.links];
                        newLinks[idx] = e.target.value;
                        setGoal({ ...goal, links: newLinks });
                      }}
                      placeholder="https://sua-plataforma.com/aula-123"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-12 pr-6 py-4 text-xs text-zinc-300 outline-none focus:border-red-500 transition-all"
                    />
                  </div>
                  <button onClick={() => setGoal({ ...goal, links: goal.links.filter((_, i) => i !== idx) })} className="p-4 bg-zinc-950 hover:bg-red-900/20 border border-zinc-800 rounded-2xl text-zinc-700 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
              {goal.links.length === 0 && <p className="text-center py-6 border-2 border-dashed border-zinc-900 rounded-3xl text-zinc-800 font-bold text-[10px] uppercase">Nenhum link configurado.</p>}
            </div>
          </div>

          {(goal.type === GoalType.QUESTIONS || goal.type === GoalType.LEI_SECA || goal.type === GoalType.SUMMARY) && (
            <div className="bg-red-950/10 border border-red-600/20 rounded-[2.5rem] p-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20">
                    <RefreshCw size={24} className="text-white" />
                  </div>
                  <div>
                    <span className="font-black text-xl text-white uppercase tracking-tighter block">Revisão Espaçada</span>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Automatize o retorno deste conteúdo</span>
                  </div>
                </div>
                <div className="relative inline-block w-14 h-8">
                  <input 
                    type="checkbox"
                    checked={goal.reviewConfig?.enabled || false}
                    onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, enabled: e.target.checked } })}
                    className="sr-only peer"
                    id="review-toggle"
                  />
                  <label htmlFor="review-toggle" className="absolute cursor-pointer inset-0 bg-zinc-800 rounded-full transition-colors peer-checked:bg-red-600"></label>
                  <div className="absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
                </div>
              </div>
              
              {goal.reviewConfig?.enabled && (
                <div className="space-y-6 pt-6 border-t border-red-900/30 animate-in fade-in duration-500">
                  <div className="space-y-3">
                    <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest block ml-1">Sequência de Dias (Intervalos)</span>
                    <input 
                      value={goal.reviewConfig.intervals.join(', ')}
                      onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, intervals: e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)) } })}
                      className="w-full bg-zinc-950 border border-red-900/20 rounded-2xl px-6 py-4 text-sm text-red-100 font-bold focus:border-red-500 outline-none"
                      placeholder="Ex: 1, 7, 15, 30"
                    />
                    <p className="text-[9px] text-zinc-600 italic">Cada número representa os dias após a última conclusão da meta.</p>
                  </div>
                  <label className="flex items-center gap-4 group cursor-pointer">
                    <div className="relative w-5 h-5 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-center transition-all group-hover:border-red-500">
                      {goal.reviewConfig.repeatLast && <CheckCircle2 size={16} className="text-red-500" />}
                      <input 
                        type="checkbox"
                        checked={goal.reviewConfig.repeatLast}
                        onChange={(e) => setGoal({ ...goal, reviewConfig: { ...goal.reviewConfig!, repeatLast: e.target.checked } })}
                        className="sr-only"
                      />
                    </div>
                    <span className="text-xs text-zinc-400 font-bold">Repetir o último ciclo de revisão infinitamente</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-10 border-t border-zinc-800 flex gap-6 bg-zinc-950/50 shrink-0">
          <button onClick={onClose} className="flex-1 py-5 rounded-2xl border border-zinc-800 text-zinc-500 font-black uppercase text-xs tracking-widest hover:bg-zinc-900 transition-all">Cancelar</button>
          <button onClick={() => onSave(context.dId, context.tId, goal)} className="flex-1 py-5 rounded-2xl bg-red-600 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-red-600/30 hover:bg-red-500 transition-all">Sincronizar Meta</button>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
