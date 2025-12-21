
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import AdminView from './components/AdminView.tsx';
import RoutineView from './components/RoutineView.tsx';
import PlanningView from './components/PlanningView.tsx';
import DailyGoalsView from './components/DailyGoalsView.tsx';
import LoginView from './components/LoginView.tsx';
import { AppState, StudyPlan, UserRoutine, PlanningEntry, RegisteredUser, Goal } from './types.ts';
import { INITIAL_LOGO } from './constants.tsx';
import { generatePlanning, getLocalDateString } from './services/scheduler.ts';
import { Eye, ShieldAlert, Loader2, ExternalLink, LogOut } from 'lucide-react';

import { auth, db } from './firebase.ts';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot
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

  const statistics = useMemo(() => {
    let globalMinutes = 0;
    const planMinutes: { [key: string]: number } = {};
    Object.entries(state.user.allPlannings).forEach(([planId, planning]) => {
      const entries = planning as PlanningEntry[];
      const total = entries.filter(e => e.status === 'COMPLETED').reduce((acc, curr) => acc + (curr.actualTimeSpent || 0), 0);
      planMinutes[planId] = total;
      globalMinutes += total;
    });
    return { globalMinutes, planMinutes };
  }, [state.user.allPlannings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === ADMIN_CREDENTIALS.email) {
          const adminUser: RegisteredUser = { id: user.uid, name: 'Administrador Insanus', cpf: '000', email: user.email!, role: 'ADMIN', accessList: [] };
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
    const unsubConfig = onSnapshot(doc(db, "config", "global"), (d) => {
      if (d.exists()) setState(prev => ({ ...prev, admin: { ...prev.admin, logoUrl: d.data().logoUrl } }));
    });
    return () => { unsubPlans(); unsubConfig(); };
  }, [state.auth.isAuthenticated]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !state.auth.currentUser) return;
    const uid = state.auth.currentUser.id;
    const unsubProgress = onSnapshot(doc(db, "user_progress", uid), (d) => {
      if (d.exists()) {
        const data = sanitize(d.data());
        setState(prev => ({ ...prev, user: { ...prev.user, ...data } }));
      }
    });
    return () => unsubProgress();
  }, [state.auth.isAuthenticated, state.auth.currentUser?.id]);

  const handleUpdateRoutine = async (routine: UserRoutine) => {
    if (!state.auth.currentUser) return;
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { routine: sanitize(routine) }, { merge: true });
  };

  const handleCompleteGoal = async (entryId: string, timeSpent: number) => {
    if (!state.auth.currentUser || !state.user.routine.selectedPlanId) return;
    
    const planId = state.user.routine.selectedPlanId;
    const currentPlanning = [...(state.user.allPlannings[planId] || [])];
    const entryIdx = currentPlanning.findIndex(e => e.id === entryId);
    if (entryIdx === -1) return;

    const entry = currentPlanning[entryIdx];
    currentPlanning[entryIdx] = { ...entry, status: 'COMPLETED', actualTimeSpent: timeSpent };

    const activePlan = state.admin.plans.find(p => p.id === planId);
    const disc = activePlan?.disciplines.find(d => d.id === entry.disciplineId);
    const topic = disc?.topics.find(t => t.id === entry.topicId);
    const goal = topic?.goals.find(g => g.id === entry.goalId);

    if (goal?.reviewConfig?.enabled) {
      const currentStep = entry.reviewStep || 0;
      const intervals = goal.reviewConfig.intervals;
      let nextInterval = intervals[currentStep];
      let nextStep = currentStep + 1;

      if (currentStep >= intervals.length && goal.reviewConfig.repeatLast) {
        nextInterval = intervals[intervals.length - 1];
        nextStep = currentStep + 1;
      }

      if (nextInterval !== null && nextInterval !== undefined) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + nextInterval);
        currentPlanning.push({
          id: Math.random().toString(36).substr(2, 9),
          goalId: entry.goalId,
          topicId: entry.topicId,
          disciplineId: entry.disciplineId,
          date: nextDate.toISOString(),
          durationMinutes: entry.durationMinutes,
          status: 'PENDING',
          isReview: true,
          reviewStep: nextStep
        });
      }
    }

    const newAllPlannings = { ...state.user.allPlannings, [planId]: sanitize(currentPlanning) };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
  };

  const handleGeneratePlanning = async () => {
    const selectedPlanId = state.user.routine.selectedPlanId;
    const selectedPlan = state.admin.plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan || !state.auth.currentUser || !selectedPlanId) return;

    const currentPlanning = state.user.allPlannings[selectedPlanId] || [];
    const newPlanning = generatePlanning(selectedPlan, state.user.routine, new Date(), currentPlanning, 'new');
    
    const newAllPlannings = { ...state.user.allPlannings, [selectedPlanId]: sanitize(newPlanning) };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
    setCurrentView('planning');
  };

  const handleReplanPlan = async () => {
    const selectedPlanId = state.user.routine.selectedPlanId;
    const selectedPlan = state.admin.plans.find(p => p.id === selectedPlanId);
    if (!selectedPlan || !state.auth.currentUser || !selectedPlanId) return;

    const currentPlanning = state.user.allPlannings[selectedPlanId] || [];
    const newPlanning = generatePlanning(selectedPlan, state.user.routine, new Date(), currentPlanning, 'replan');
    
    const newAllPlannings = { ...state.user.allPlannings, [selectedPlanId]: sanitize(newPlanning) };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
    alert("Replanejamento concluído! Suas metas pendentes foram reorganizadas a partir de hoje.");
  };

  const handleTogglePause = async () => {
    if (!state.auth.currentUser) return;
    const newPaused = !state.user.routine.isPaused;
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { 
      routine: { ...state.user.routine, isPaused: newPaused } 
    }, { merge: true });
  };

  const handleRestartPlan = async () => {
    if (!state.auth.currentUser || !state.user.routine.selectedPlanId) return;
    const planId = state.user.routine.selectedPlanId;
    const newAllPlannings = { ...state.user.allPlannings, [planId]: [] };
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { allPlannings: newAllPlannings }, { merge: true });
  };

  const handleUpdatePlans = (plans: StudyPlan[]) => setState(prev => ({ ...prev, admin: { ...prev.admin, plans } }));
  const handleUpdateUsers = (users: RegisteredUser[]) => setState(prev => ({ ...prev, admin: { ...prev.admin, users } }));
  const handleUpdateLogo = async (url: string) => { await setDoc(doc(db, "config", "global"), { logoUrl: url }); };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <Loader2 className="text-red-600 animate-spin" size={64} />
    </div>
  );

  if (!state.auth.isAuthenticated) return <LoginView onLogin={async (e, p) => { await signInWithEmailAndPassword(auth, e, p); }} logoUrl={state.admin.logoUrl} />;

  const availablePlans = state.auth.currentUser?.role === 'ADMIN' ? state.admin.plans : state.admin.plans.filter(p => state.auth.currentUser?.accessList.some(a => a.planId === p.id));
  const activePlanning = state.user.routine.selectedPlanId ? (state.user.allPlannings[state.user.routine.selectedPlanId] || []) : [];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      <div className={`fixed top-0 left-0 right-0 h-12 z-[100] flex items-center justify-between px-6 shadow-2xl backdrop-blur-md md:ml-64 ${state.auth.currentUser?.role === 'ADMIN' ? 'bg-red-600' : 'bg-zinc-900/80 border-b border-zinc-800'}`}>
         <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
           <ShieldAlert size={14} /> {state.auth.currentUser?.role === 'ADMIN' ? 'ADMIN' : 'ESTUDANTE'}
         </div>
         <div className="flex items-center gap-3">
           {state.auth.currentUser?.role === 'ADMIN' && (
             <button onClick={() => { setIsPreviewMode(!isPreviewMode); setCurrentView(isPreviewMode ? 'admin' : 'daily'); }} className="bg-black/20 hover:bg-black/40 text-white px-3 py-1.5 rounded-lg text-[9px] font-black border border-white/20 transition-all flex items-center gap-2">
               <Eye size={12} /> {isPreviewMode ? 'VOLTAR AO ADMIN' : 'MODO SIMULAÇÃO'}
             </button>
           )}
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
            {currentView === 'planning' && <PlanningView planning={activePlanning} plans={state.admin.plans} isPaused={state.user.routine.isPaused} onReplan={handleReplanPlan} />}
            {currentView === 'daily' && <DailyGoalsView planning={activePlanning} plans={state.admin.plans} onComplete={handleCompleteGoal} onReplan={handleReplanPlan} isPaused={state.user.routine.isPaused} globalStudyTime={statistics.globalMinutes} planStudyTime={statistics.planMinutes[state.user.routine.selectedPlanId || ''] || 0} currentUser={state.auth.currentUser} />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
