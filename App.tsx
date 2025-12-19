
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import AdminView from './components/AdminView.tsx';
import RoutineView from './components/RoutineView.tsx';
import PlanningView from './components/PlanningView.tsx';
import DailyGoalsView from './components/DailyGoalsView.tsx';
import LoginView from './components/LoginView.tsx';
import { AppState, StudyPlan, UserRoutine, PlanningEntry, RegisteredUser, Goal } from './types.ts';
import { INITIAL_LOGO } from './constants.tsx';
import { generatePlanning } from './services/scheduler.ts';
import { Eye, ShieldAlert, Loader2 } from 'lucide-react';

// Firebase Imports
import { auth, db } from './firebase.ts';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  updateDoc,
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'admin' | 'routine' | 'planning' | 'daily'>('daily');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [state, setState] = useState<AppState>({
    admin: { plans: [], logoUrl: INITIAL_LOGO, users: [] },
    auth: { currentUser: null, isAuthenticated: false },
    user: {
      routine: { days: { 1: 120, 2: 120, 3: 120, 4: 120, 5: 120 }, profile: 'BEGINNER', selectedPlanId: null },
      planning: [],
      currentSession: { activeGoalId: null, startTime: null, totalPausedTime: 0, lastPauseTime: null }
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === ADMIN_CREDENTIALS.email) {
          const adminUser: RegisteredUser = {
            id: user.uid,
            name: 'Administrador Insanus',
            cpf: '000',
            email: user.email!,
            password: '',
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
      const plans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlan));
      setState(prev => ({ ...prev, admin: { ...prev.admin, plans } }));
    });
    let unsubUsers = () => {};
    if (state.auth.currentUser?.role === 'ADMIN') {
      unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as RegisteredUser));
        setState(prev => ({ ...prev, admin: { ...prev.admin, users } }));
      });
    }
    const unsubConfig = onSnapshot(doc(db, "config", "global"), (doc) => {
      if (doc.exists()) {
        setState(prev => ({ ...prev, admin: { ...prev.admin, logoUrl: doc.data().logoUrl } }));
      }
    });
    return () => { unsubPlans(); unsubUsers(); unsubConfig(); };
  }, [state.auth.isAuthenticated]);

  useEffect(() => {
    if (!state.auth.isAuthenticated || !state.auth.currentUser) return;
    const uid = state.auth.currentUser.id;
    const unsubProgress = onSnapshot(doc(db, "user_progress", uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setState(prev => ({ 
          ...prev, 
          user: { 
            routine: data.routine || prev.user.routine,
            planning: data.planning || [],
            currentSession: data.currentSession || prev.user.currentSession
          } 
        }));
      }
    });
    return () => unsubProgress();
  }, [state.auth.isAuthenticated, state.auth.currentUser?.id]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      alert("Erro ao entrar: E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setIsPreviewMode(false);
  };

  const handleUpdatePlans = async (plans: StudyPlan[]) => {
    setState(prev => ({ ...prev, admin: { ...prev.admin, plans } }));
  };

  const handleUpdateLogo = async (logoUrl: string) => {
    await setDoc(doc(db, "config", "global"), { logoUrl }, { merge: true });
  };

  const handleUpdateUsers = async (users: RegisteredUser[]) => {
    setState(prev => ({ ...prev, admin: { ...prev.admin, users } }));
  };

  const handleUpdateRoutine = async (routine: UserRoutine) => {
    if (!state.auth.currentUser) return;
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { routine }, { merge: true });
  };

  const handleGeneratePlanning = async () => {
    const selectedPlan = state.admin.plans.find(p => p.id === state.user.routine.selectedPlanId);
    if (!selectedPlan || !state.auth.currentUser) {
      alert("Selecione um plano!");
      return;
    }
    const newPlanning = generatePlanning(selectedPlan, state.user.routine, new Date(), state.user.planning);
    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { planning: newPlanning }, { merge: true });
    setCurrentView('planning');
  };

  const handleCompleteGoal = async (entryId: string, timeSpent: number) => {
    if (!state.auth.currentUser) return;
    
    const entry = state.user.planning.find(e => e.id === entryId);
    if (!entry) return;

    let updatedPlanning = state.user.planning.map(e => 
      e.id === entryId ? { ...e, status: 'COMPLETED' as const, actualTimeSpent: timeSpent } : e
    );

    const plan = state.admin.plans.find(p => p.id === state.user.routine.selectedPlanId);
    const goal = plan?.disciplines.find(d => d.id === entry.disciplineId)?.topics.find(t => t.id === entry.topicId)?.goals.find(g => g.id === entry.goalId);

    if (goal?.reviewConfig?.enabled) {
      const currentStep = entry.reviewStep ?? -1;
      const nextStep = currentStep + 1;
      const intervals = goal.reviewConfig.intervals;
      
      let daysToAdd = 0;
      if (nextStep < intervals.length) {
        daysToAdd = intervals[nextStep];
      } else if (goal.reviewConfig.repeatLast && intervals.length > 0) {
        daysToAdd = intervals[intervals.length - 1];
      }

      if (daysToAdd > 0) {
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + daysToAdd);
        
        const reviewEntry: PlanningEntry = {
          id: Math.random().toString(36).substr(2, 9),
          goalId: entry.goalId,
          topicId: entry.topicId,
          disciplineId: entry.disciplineId,
          date: reviewDate.toISOString(),
          durationMinutes: 30,
          status: 'PENDING',
          isReview: true,
          reviewStep: nextStep
        };
        updatedPlanning.push(reviewEntry);
      }
    }

    await setDoc(doc(db, "user_progress", state.auth.currentUser.id), { planning: updatedPlanning }, { merge: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="text-red-600 animate-spin" size={48} />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sincronizando com Firebase...</p>
      </div>
    );
  }

  if (!state.auth.isAuthenticated) {
    return <LoginView onLogin={handleLogin} logoUrl={state.admin.logoUrl} />;
  }

  const availablePlans = state.auth.currentUser?.role === 'ADMIN' 
    ? state.admin.plans 
    : state.admin.plans.filter(p => state.auth.currentUser?.accessList.some(a => a.planId === p.id));

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
      {state.auth.currentUser?.role === 'ADMIN' && (
        <div className="fixed top-0 left-0 right-0 h-12 bg-red-600 z-[100] flex items-center justify-between px-6 shadow-xl md:ml-64">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white">
             <ShieldAlert size={16} /> ADMINISTRADOR CONECTADO
           </div>
           <button 
            onClick={() => {
              setIsPreviewMode(!isPreviewMode);
              if (!isPreviewMode) setCurrentView('daily');
              else setCurrentView('admin');
            }}
            className="bg-black/20 hover:bg-black/40 text-white px-4 py-1.5 rounded-lg text-[10px] font-black border border-white/20 transition-all flex items-center gap-2"
           >
             <Eye size={14} /> {isPreviewMode ? 'VOLTAR PARA ADMIN' : 'SIMULAR VISÃO USUÁRIO'}
           </button>
        </div>
      )}

      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        logoUrl={state.admin.logoUrl}
        role={state.auth.currentUser?.role || 'USER'}
        onLogout={logout}
        isPreview={isPreviewMode}
      />
      
      <main className={`flex-1 min-h-screen bg-[radial-gradient(circle_at_50%_50%,rgba(24,24,27,1)_0%,rgba(9,9,11,1)_100%)] transition-all md:ml-64 ${state.auth.currentUser?.role === 'ADMIN' ? 'pt-12' : ''}`}>
        {currentView === 'admin' && state.auth.currentUser?.role === 'ADMIN' && !isPreviewMode ? (
          <AdminView 
            plans={state.admin.plans} 
            updatePlans={handleUpdatePlans} 
            users={state.admin.users}
            updateUsers={handleUpdateUsers}
            logoUrl={state.admin.logoUrl}
            updateLogo={handleUpdateLogo}
          />
        ) : null}
        
        {(currentView !== 'admin' || isPreviewMode) && (
          <>
            {currentView === 'routine' && (
              <RoutineView 
                plans={availablePlans} 
                routine={state.user.routine} 
                updateRoutine={handleUpdateRoutine}
                onGeneratePlanning={handleGeneratePlanning}
              />
            )}
            {currentView === 'planning' && (
              <PlanningView 
                planning={state.user.planning} 
                plans={state.admin.plans} 
              />
            )}
            {currentView === 'daily' && (
              <DailyGoalsView 
                planning={state.user.planning} 
                plans={state.admin.plans}
                onComplete={handleCompleteGoal}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
