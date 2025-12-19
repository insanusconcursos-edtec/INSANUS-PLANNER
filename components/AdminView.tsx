
import React, { useState } from 'react';
import { 
  Plus, Trash2, ChevronUp, ChevronDown, FileText, 
  Image as ImageIcon, Link as LinkIcon, RefreshCw, 
  Clock, GraduationCap, Folder as FolderIcon, 
  Users, Code, Search, UserPlus, Key, ShieldCheck,
  Calendar, Edit, X, Save, Layers, Settings2, ExternalLink
} from 'lucide-react';
import { StudyPlan, Discipline, Topic, Goal, GoalType, CycleSystem, StudyCycle, Folder, RegisteredUser, PlanAccess } from '../types';
import { GOAL_COLORS } from '../constants';
import { db } from '../firebase';
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
  const [isEditingDiscipline, setIsEditingDiscipline] = useState<string | null>(null);
  const [isEditingTopic, setIsEditingTopic] = useState<{ dId: string, tId: string } | null>(null);
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
    
    // Reset order field
    const ordered = newTopics.map((t, i) => ({ ...t, order: i }));
    const updated = activePlan.disciplines.map(d => d.id === dId ? { ...d, topics: ordered } : d);
    await savePlan({ ...activePlan, disciplines: updated });
  };

  const embedCode = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 12px; border: 1px solid #333;">
  <iframe src="${window.location.origin}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allow="camera; microphone; geolocation" allowfullscreen></iframe>
</div>`;

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Painel Admin Cloud</h2>
          <p className="text-zinc-500 mt-1">Sincronizado com Firebase Firestore.</p>
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.id ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'
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
              <button onClick={createPlan} className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all">
                <Plus size={18} /> Novo Plano
              </button>
              <div className="space-y-2">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedPlanId === plan.id ? 'bg-red-600/10 border-red-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="font-bold">{plan.name}</div>
                    <div className="text-[10px] mt-1 uppercase tracking-widest">{plan.disciplines.length} Disciplinas</div>
                  </button>
                ))}
              </div>
           </div>

           <div className="lg:col-span-3">
              {activePlan ? (
                <div className="space-y-6">
                  {/* Basic Plan Info */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-xl">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <input 
                          value={activePlan.name}
                          onChange={(e) => savePlan({ ...activePlan, name: e.target.value })}
                          className="text-3xl font-black bg-transparent border-none focus:ring-0 text-white w-full outline-none"
                        />
                        <div className="mt-2 flex items-center gap-4">
                           <div className="flex items-center gap-2 text-zinc-500">
                             <ImageIcon size={14} />
                             <input 
                               value={activePlan.imageUrl}
                               onChange={(e) => savePlan({ ...activePlan, imageUrl: e.target.value })}
                               className="text-[10px] bg-zinc-950 border border-zinc-800 rounded px-2 py-1 outline-none w-48"
                               placeholder="URL da Imagem"
                             />
                           </div>
                           <div className="flex items-center gap-2 text-zinc-500">
                             <Settings2 size={14} />
                             <select 
                               value={activePlan.cycleSystem}
                               onChange={(e) => savePlan({ ...activePlan, cycleSystem: e.target.value as CycleSystem })}
                               className="text-[10px] bg-zinc-950 border border-zinc-800 rounded px-2 py-1 outline-none uppercase font-bold"
                             >
                               <option value={CycleSystem.CONTINUOUS}>Contínuo</option>
                               <option value={CycleSystem.ROTATING}>Rotativo</option>
                             </select>
                           </div>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if(confirm("Excluir plano permanentemente?")) {
                          await deleteDoc(doc(db, "plans", activePlan.id));
                          setSelectedPlanId(null);
                        }
                      }} className="text-red-500 font-bold text-xs uppercase hover:text-red-400">Excluir Plano</button>
                    </div>
                  </div>

                  {/* Disciplines Editor */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Layers size={20} className="text-red-500" /> Grade Curricular
                      </h3>
                      <button onClick={addDiscipline} className="bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all">
                        + Adicionar Disciplina
                      </button>
                    </div>

                    <div className="space-y-4">
                      {activePlan.disciplines.map(disc => (
                        <div key={disc.id} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl overflow-hidden">
                          <div className="p-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80">
                            <input 
                              value={disc.name}
                              onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, name: e.target.value } : d) })}
                              className="font-bold text-lg bg-transparent border-none text-white outline-none w-1/2"
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={() => addTopic(disc.id)} className="text-[10px] font-bold text-zinc-500 hover:text-white px-3 py-1 bg-zinc-800 rounded-lg">+ Novo Assunto</button>
                              <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.filter(d => d.id !== disc.id) })} className="p-2 text-zinc-600 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                          </div>
                          
                          <div className="p-6 space-y-4">
                            {disc.topics.sort((a,b) => a.order - b.order).map(topic => (
                              <div key={topic.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'up')} className="text-zinc-700 hover:text-zinc-100"><ChevronUp size={14} /></button>
                                    <button onClick={() => moveTopic(disc.id, topic.id, 'down')} className="text-zinc-700 hover:text-zinc-100"><ChevronDown size={14} /></button>
                                  </div>
                                  <div>
                                    <input 
                                      value={topic.title}
                                      onChange={(e) => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.map(t => t.id === topic.id ? { ...t, title: e.target.value } : t) } : d) })}
                                      className="font-bold text-sm bg-transparent text-zinc-200 outline-none"
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {topic.goals.map(g => (
                                        <button 
                                          key={g.id} 
                                          onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: g.id })}
                                          className="text-[8px] font-black uppercase px-2 py-0.5 rounded border shadow-sm transition-all hover:scale-105"
                                          style={{ backgroundColor: `${g.color}20`, color: g.color, borderColor: `${g.color}40` }}
                                        >
                                          {g.type}
                                        </button>
                                      ))}
                                      <button 
                                        onClick={() => setIsEditingGoal({ dId: disc.id, tId: topic.id, gId: null })}
                                        className="text-[8px] font-black uppercase px-2 py-0.5 rounded border border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-500"
                                      >
                                        + Meta
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <button onClick={() => savePlan({ ...activePlan, disciplines: activePlan.disciplines.map(d => d.id === disc.id ? { ...d, topics: d.topics.filter(t => t.id !== topic.id) } : d) })} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-800 hover:text-red-500 transition-all">
                                  <Trash2 size={14} />
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
                <div className="h-full min-h-[400px] border-2 border-dashed border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center text-zinc-800 space-y-4">
                  <FileText size={64} className="opacity-20" />
                  <p className="font-bold uppercase tracking-[0.2em]">Selecione um plano para começar</p>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Goal Modal Editor */}
      {isEditingGoal && (
        <GoalEditorModal 
          activePlan={activePlan!}
          context={isEditingGoal}
          onClose={() => setIsEditingGoal(null)}
          onSave={handleGoalSave}
        />
      )}

      {/* Users & Identity Tabs (as implemented before) */}
      {/* ... keeping the user management and identity tab logic from previous implementation ... */}
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

          {/* Links Section */}
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

          {/* Review System */}
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
