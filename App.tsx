
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import AdminView from './components/AdminView.tsx';
import RoutineView from './components/RoutineView.tsx';
import PlanningView from './components/PlanningView.tsx';
import DailyGoalsView from './components/DailyGoalsView.tsx';
import LoginView from './components/LoginView.tsx';
import { AppState, StudyPlan, UserRoutine, PlanningEntry, RegisteredUser } from './types.ts';
import { INITIAL_LOGO } from './constants.tsx';
import { generatePlanning } from './services/scheduler.ts';
import { Eye, ShieldAlert, Loader2, ExternalLink, LogOut } from 'lucide-react';

import { auth, db } from './firebase.ts';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  deleteDoc
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

const ADMIN_CREDENTIALS = {
  email: "insanusconcursos@gmail.com",
  pass: "Ins@nus110921"
};

// Sanitização rigorosa para evitar erros de estrutura circular do Firebase
const sanitize = (data: any) => {
  if (!data) return data;
  return JSON.parse(JSON.stringify(data));
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'admin' | 'routine' | 'planning' | 'daily'>('daily');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [state, setState] = useState<AppState>({
    admin: { plans: [], logoUrl: INITIAL_LOGO, users: [] },
    auth: { currentUser: null, isAuthenticated: false },
    user: {
      routine: { days: { 1: 120, 2: 120, 3: 120, 4: 120, 5: 120 }, profile: 'BEGINNER', selectedPlanId: null, isPaused: false },
      allPlannings: {},
      currentSession: { activeGoalId: null, startTime: null, totalPausedTime: 0, lastPauseTime: null }
    }
  });

  // Cálculos de Tempo Líquido (Memoized para performance)
  const statistics = useMemo(() => {
    let globalMinutes = 0;
    const planMinutes: { [key: string]: number } = {};

    Object.entries(state.user.allPlannings).forEach(([planId, planning]) => {
      const entries = planning as PlanningEntry[];
      const total = entries
        .filter(e => e.status === 'COMPLETED')
        .reduce((acc, curr) => acc + (curr.actualTimeSpent || 0), 0);
      
      planMinutes[planId] = total;
      globalMinutes += total;
    });

    return { globalMinutes, planMinutes };
  }, [state.user.allPlannings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === ADMIN_CREDENTIALS.email) {
          const adminUser: RegisteredUser = {
            id: user.uid,
            name: 'Administrador Insanus',
            cpf: '000',
            email: user.email!,
            role: 'ADMIN',
            accessList: []
          };
          setState(prev => ({ ...prev, auth: { currentUser: adminUser, isAuthenticated: true } }));
          setCurrentView('admin');
        } else {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as RegisteredUser;
            setState(prev => ({ ...prev, auth: { currentUser: { ...userData, id: user.uid }, isAuthenticated: true } }));
          }
        }
      } else {
        setState(prev => ({ ...prev, auth: { currentUser: null, isAuthenticated: false } }));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!state.auth.isAuthenticated) return;

    const unsubPlans = onSnapshot(collection(db, "plans"), (snapshot) => {
      const plans = snapshot.docs.map(d => ({ ...sanitize(d.data()), id: d.id } as StudyPlan));
      setState(prev => ({ ...prev, admin: { ...prev.admin, plans } }));
    });

    let unsubUsers = () => {};
    if (state.auth.currentUser?.role === 'ADMIN') {
      unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const users = snapshot.docs.map(d => ({ ...sanitize(d.data()), id: d.id } as RegisteredUser));
        setState(prev => ({ ...prev, admin: { ...prev.admin, users } }));
      });
    }

    const unsubConfig = onSnapshot(doc(db, "config", "global"), (d) => {
      if (d.exists()) {
        setState(prev => ({ ...prev, admin: { ...prev.admin, logoUrl: d.data().logoUrl } }));
      }
    });

    return () => { unsubPlans(); unsubUsers(); unsubConfig(); };
  }, [state.auth.isAuthenticated, state.auth.currentUser?.role]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !state.auth.currentUser) return;
    const uid = state.auth.currentUser.id;
    const unsubProgress = onSnapshot(doc(db, "user_progress", uid), (d) => {
      if (d.exists()) {
        const data = sanitize(d.data());
        setState(prev => ({ 
          ...prev, 
          user: { 
            routine: data.routine || prev.user.routine,
            allPlannings: data.allPlannings || {},
            currentSession: data.currentSession || prev.user.currentSession
          } 
        }));
      }
    });
    return () => unsubProgress();
  }, [state.auth.isAuthenticated, state.auth.currentUser?.id]);

  const handleUpdateRoutine = async (routine: UserRoutine) => {
    if (!state.auth.currentUser) return;
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { routine: sanitize(routine) }, { merge: true });
  };

  const handleTogglePause = async () => {
    const newRoutine = { ...state.user.routine, isPaused: !state.user.routine.isPaused };
    await handleUpdateRoutine(newRoutine);
  };

  const handleRestartPlan = async () => {
    if (!state.auth.currentUser || !state.user.routine.selectedPlanId) return;
    
    const confirmMessage = "⚠️ AVISO DE SEGURANÇA:\n\nEsta ação é IRREVERSÍVEL. Todo o seu progresso, histórico de tempo e metas concluídas deste plano serão APAGADOS.\n\nDeseja realmente reiniciar do zero?";
    
    if (window.confirm(confirmMessage)) {
      const planId = state.user.routine.selectedPlanId;
      const newAllPlannings = { ...state.user.allPlannings };
      delete newAllPlannings[planId];
      
      await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { 
        allPlannings: sanitize(newAllPlannings) 
      }, { merge: true });
      
      alert("Plano resetado com sucesso. Você pode gerar um novo cronograma agora.");
    }
  };

  const handleGeneratePlanning = async () => {
    const selectedPlanId = state.user.routine.selectedPlanId;
    const selectedPlan = state.admin.plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan || !state.auth.currentUser || !selectedPlanId) return;

    const currentPlanning = state.user.allPlannings[selectedPlanId] || [];
    const newPlanning = generatePlanning(selectedPlan, state.user.routine, new Date(), currentPlanning);
    
    const newAllPlannings = { ...state.user.allPlannings, [selectedPlanId]: sanitize(newPlanning) };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
    setCurrentView('planning');
  };

  const handleCompleteGoal = async (entryId: string, timeSpent: number) => {
    if (!state.auth.currentUser || !state.user.routine.selectedPlanId) return;
    
    const planId = state.user.routine.selectedPlanId;
    const currentPlanning = [...(state.user.allPlannings[planId] || [])];
    const entryIndex = currentPlanning.findIndex(e => e.id === entryId);
    
    if (entryIndex === -1) return;

    currentPlanning[entryIndex] = { 
      ...currentPlanning[entryIndex], 
      status: 'COMPLETED', 
      actualTimeSpent: timeSpent 
    };

    const newAllPlannings = { ...state.user.allPlannings, [planId]: sanitize(currentPlanning) };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
  };

  // Fixed missing handleUpdatePlans function
  const handleUpdatePlans = (plans: StudyPlan[]) => {
    setState(prev => ({ ...prev, admin: { ...prev.admin, plans } }));
  };

  // Fixed missing handleUpdateUsers function
  const handleUpdateUsers = (users: RegisteredUser[]) => {
    setState(prev => ({ ...prev, admin: { ...prev.admin, users } }));
  };

  // Fixed missing handleUpdateLogo function
  const handleUpdateLogo = async (url: string) => {
    await setDoc(doc(db, "config", "global"), { logoUrl: url });
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <Loader2 className="text-red-600 animate-spin" size={64} />
      <div className="text-center">
        <p className="text-white font-black uppercase tracking-[0.3em] text-xs">Carregando Ecossistema</p>
        <p className="text-zinc-700 text-[10px] font-bold mt-2 uppercase">Sincronizando com a Matrix</p>
      </div>
    </div>
  );

  if (!state.auth.isAuthenticated) return <LoginView onLogin={async (e, p) => { await signInWithEmailAndPassword(auth, e, p); }} logoUrl={state.admin.logoUrl} />;

  const availablePlans = state.auth.currentUser?.role === 'ADMIN' 
    ? state.admin.plans 
    : state.admin.plans.filter(p => state.auth.currentUser?.accessList.some(a => a.planId === p.id));

  const activePlanning = state.user.routine.selectedPlanId ? (state.user.allPlannings[state.user.routine.selectedPlanId] || []) : [];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      <div className={`fixed top-0 left-0 right-0 h-12 z-[100] flex items-center justify-between px-6 shadow-2xl backdrop-blur-md md:ml-64 ${state.auth.currentUser?.role === 'ADMIN' ? 'bg-red-600' : 'bg-zinc-900/80 border-b border-zinc-800'}`}>
         <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
           <ShieldAlert size={14} /> {state.auth.currentUser?.role === 'ADMIN' ? 'MODO ADMINISTRADOR' : 'PAINEL DO ESTUDANTE'}
         </div>
         <div className="flex items-center gap-3">
           {state.auth.currentUser?.role === 'ADMIN' && (
             <button onClick={() => { setIsPreviewMode(!isPreviewMode); setCurrentView(isPreviewMode ? 'admin' : 'daily'); }} className="bg-black/20 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg text-[9px] font-black border border-white/20 transition-all flex items-center gap-2">
               <Eye size={12} /> {isPreviewMode ? 'ADMIN' : 'SIMULAR'}
             </button>
           )}
           <button onClick={() => window.open(window.location.href, '_blank')} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black border border-zinc-700 transition-all"><ExternalLink size={12} /></button>
           <button onClick={() => signOut(auth)} className="bg-zinc-800 hover:bg-red-600/20 hover:text-red-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black border border-zinc-700 transition-all"><LogOut size={12} /></button>
         </div>
      </div>

      <Sidebar currentView={currentView} setView={setCurrentView} logoUrl={state.admin.logoUrl} role={state.auth.currentUser?.role || 'USER'} onLogout={() => signOut(auth)} isPreview={isPreviewMode} />
      
      <main className="flex-1 min-h-screen pt-12 transition-all md:ml-64 bg-[radial-gradient(circle_at_50%_0%,rgba(30,0,0,0.15)_0%,rgba(0,0,0,0)_50%)]">
        {currentView === 'admin' && !isPreviewMode ? (
          <AdminView plans={state.admin.plans} updatePlans={handleUpdatePlans} users={state.admin.users} updateUsers={handleUpdateUsers} logoUrl={state.admin.logoUrl} updateLogo={handleUpdateLogo} />
        ) : (
          <>
            {currentView === 'routine' && <RoutineView plans={availablePlans} routine={state.user.routine} updateRoutine={handleUpdateRoutine} onGeneratePlanning={handleGeneratePlanning} onTogglePause={handleTogglePause} onRestartPlan={handleRestartPlan} />}
            {currentView === 'planning' && <PlanningView planning={activePlanning} plans={state.admin.plans} isPaused={state.user.routine.isPaused} />}
            {currentView === 'daily' && <DailyGoalsView planning={activePlanning} plans={state.admin.plans} onComplete={handleCompleteGoal} isPaused={state.user.routine.isPaused} globalStudyTime={statistics.globalMinutes} planStudyTime={statistics.planMinutes[state.user.routine.selectedPlanId || ''] || 0} />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
