
import { 
  StudyPlan, 
  UserRoutine, 
  PlanningEntry, 
  Goal, 
  GoalType, 
  CycleSystem,
  UserProfile,
  CycleItem
} from '../types';
import { PROFILE_SPEEDS } from '../constants';

// Helper para obter data local YYYY-MM-DD
export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateGoalDuration = (goal: Goal, profile: UserProfile): number => {
  if (goal.type === GoalType.CLASS || goal.type === GoalType.SUMMARY) {
    return goal.minutes || 0;
  }
  
  const baseMinutes = PROFILE_SPEEDS[goal.type][profile] || 1;
  let total = (goal.pages || 0) * baseMinutes;
  
  if (goal.type === GoalType.LEI_SECA && goal.multiplier) {
    total *= goal.multiplier;
  }
  
  return total;
};

const getOrderedDisciplineIdsFromCycle = (plan: StudyPlan, items: CycleItem[]): string[] => {
  const ids: string[] = [];
  items.forEach(item => {
    if (item.type === 'DISCIPLINE') {
      ids.push(item.id);
    } else {
      const folderDisciplines = plan.disciplines
        .filter(d => d.folderId === item.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(d => d.id);
      ids.push(...folderDisciplines);
    }
  });
  return [...new Set(ids)];
};

/**
 * Gera ou Replaneja o cronograma.
 * Se mode === 'replan', ele ignora datas passadas para itens não concluídos e joga tudo pra frente.
 */
export const generatePlanning = (
  plan: StudyPlan,
  routine: UserRoutine,
  startDate: Date = new Date(),
  existingPlanning: PlanningEntry[] = [],
  mode: 'new' | 'replan' = 'new'
): PlanningEntry[] => {
  if (!plan || !plan.cycles.length) return [];

  const todayStr = getLocalDateString(new Date());

  // 1. Identificar Metas Concluídas e Metas de Revisão já agendadas para o futuro
  // Se for REPLAN, mantemos apenas COMPLETED e descartamos PENDING do futuro para recriar
  const completedEntries = existingPlanning.filter(e => e.status === 'COMPLETED');
  const completedGoalIds = new Set(completedEntries.filter(e => !e.isReview).map(e => e.goalId));
  
  // 2. Extrair Ordem de Metas do Plano
  const sortedCycles = [...plan.cycles].sort((a, b) => a.order - b.order);
  const allOrderedGoals: { goal: Goal; topicId: string; disciplineId: string }[] = [];

  if (plan.cycleSystem === CycleSystem.CONTINUOUS) {
    sortedCycles.forEach(cycle => {
      const disciplineIds = getOrderedDisciplineIdsFromCycle(plan, cycle.items);
      disciplineIds.forEach(dId => {
        const discipline = plan.disciplines.find(d => d.id === dId);
        if (discipline) {
          [...discipline.topics].sort((a, b) => a.order - b.order).forEach(topic => {
            [...topic.goals].sort((a, b) => a.order - b.order).forEach(goal => {
              allOrderedGoals.push({ goal, topicId: topic.id, disciplineId: dId });
            });
          });
        }
      });
    });
  } else {
    let hasMore = true;
    let topicOffsets: Record<string, number> = {};
    while (hasMore) {
      hasMore = false;
      sortedCycles.forEach(cycle => {
        const disciplineIds = getOrderedDisciplineIdsFromCycle(plan, cycle.items);
        disciplineIds.forEach(dId => {
          const discipline = plan.disciplines.find(d => d.id === dId);
          if (discipline) {
            const start = topicOffsets[dId] || 0;
            const topicsBatch = [...discipline.topics]
              .sort((a, b) => a.order - b.order)
              .slice(start, start + (cycle.topicsPerDiscipline || 1));

            if (topicsBatch.length > 0) {
              hasMore = true;
              topicsBatch.forEach(topic => {
                [...topic.goals].sort((a, b) => a.order - b.order).forEach(goal => {
                  allOrderedGoals.push({ goal, topicId: topic.id, disciplineId: dId });
                });
              });
              topicOffsets[dId] = start + topicsBatch.length;
            }
          }
        });
      });
    }
  }

  // 3. Filtrar apenas as metas que ainda não foram concluídas
  const pendingGoals = allOrderedGoals.filter(item => !completedGoalIds.has(item.goal.id));

  // 4. Iniciar Distribuição
  let cursorDate = new Date(startDate);
  cursorDate.setHours(0, 0, 0, 0);
  
  const finalPlanning: PlanningEntry[] = [...completedEntries];
  
  // Adicionar as revisões que já existem e são futuras ou de hoje
  const existingReviews = existingPlanning.filter(e => e.isReview && (getLocalDateString(new Date(e.date)) >= todayStr || e.status === 'COMPLETED'));
  existingReviews.forEach(r => {
    if (!finalPlanning.find(f => f.id === r.id)) finalPlanning.push(r);
  });

  let pendingIdx = 0;
  let carryOverMinutes = 0;

  while (pendingIdx < pendingGoals.length) {
    const dow = cursorDate.getDay();
    const currentDayStr = getLocalDateString(cursorDate);
    const capacity = routine.days[dow] || 0;

    if (capacity <= 0) {
      cursorDate.setDate(cursorDate.getDate() + 1);
      continue;
    }

    let spentToday = 0;
    
    // Contabilizar tempo de metas que JÁ ESTÃO agendadas para este dia (Concluídas ou Revisões)
    const alreadyScheduled = finalPlanning.filter(e => getLocalDateString(new Date(e.date)) === currentDayStr);
    alreadyScheduled.forEach(e => spentToday += e.durationMinutes);

    while (spentToday < capacity && pendingIdx < pendingGoals.length) {
      const { goal, topicId, disciplineId } = pendingGoals[pendingIdx];
      const fullTime = calculateGoalDuration(goal, routine.profile);
      const remainingForGoal = carryOverMinutes > 0 ? carryOverMinutes : fullTime;
      
      const sessionDuration = Math.min(remainingForGoal, capacity - spentToday);

      if (sessionDuration > 0) {
        finalPlanning.push({
          id: Math.random().toString(36).substr(2, 9),
          goalId: goal.id,
          topicId,
          disciplineId,
          date: cursorDate.toISOString(),
          durationMinutes: Math.round(sessionDuration),
          status: currentDayStr < todayStr ? 'DELAYED' : 'PENDING',
          isReview: false
        });
        
        spentToday += sessionDuration;
        const diff = remainingForGoal - sessionDuration;
        
        if (diff < 0.1) {
          pendingIdx++;
          carryOverMinutes = 0;
        } else {
          carryOverMinutes = diff;
        }
      } else {
        break; 
      }
    }
    cursorDate.setDate(cursorDate.getDate() + 1);
    if (finalPlanning.length > 5000) break; 
  }

  return finalPlanning.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
