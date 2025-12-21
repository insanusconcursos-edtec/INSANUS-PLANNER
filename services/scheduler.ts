
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

/**
 * Transforma itens de ciclo (Disciplinas ou Pastas) em uma lista flat de IDs de Disciplinas.
 */
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

export const generatePlanning = (
  plan: StudyPlan,
  routine: UserRoutine,
  startDate: Date = new Date(),
  existingPlanning: PlanningEntry[] = []
): PlanningEntry[] => {
  if (!plan || !plan.cycles.length) return [];

  const sortedCycles = [...plan.cycles].sort((a, b) => a.order - b.order);
  const allOrderedGoals: { goal: Goal; topicId: string; disciplineId: string }[] = [];

  if (plan.cycleSystem === CycleSystem.CONTINUOUS) {
    // SISTEMA CONTÍNUO: Ciclo A (Todo) -> Ciclo B (Todo) -> Ciclo C (Todo)
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
    // SISTEMA ROTATIVO: Round 1 de Todos os Ciclos -> Round 2 de Todos os Ciclos
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

  // Preservar progresso: Mantém concluídos e revisões já agendadas
  const historicEntries = existingPlanning.filter(e => e.status === 'COMPLETED' || e.isReview);
  const completedGoalIds = new Set(historicEntries.filter(e => !e.isReview).map(e => e.goalId));
  
  const pendingGoals = allOrderedGoals.filter(item => !completedGoalIds.has(item.goal.id));

  let cursorDate = new Date(startDate);
  cursorDate.setHours(0, 0, 0, 0);
  
  const finalPlanning: PlanningEntry[] = [...historicEntries];
  let pendingIdx = 0;
  let carryOverMinutes = 0;

  while (pendingIdx < pendingGoals.length) {
    const dow = cursorDate.getDay();
    const capacity = routine.days[dow] || 0;

    if (capacity <= 0) {
      cursorDate.setDate(cursorDate.getDate() + 1);
      continue;
    }

    let spentToday = 0;
    
    // Injeta revisões pendentes do histórico para hoje antes das metas novas
    const reviewsToday = historicEntries.filter(e => 
      e.isReview && e.status === 'PENDING' && 
      e.date.split('T')[0] === cursorDate.toISOString().split('T')[0]
    );
    reviewsToday.forEach(r => spentToday += r.durationMinutes);

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
          status: 'PENDING',
          isReview: false
        });
        
        spentToday += sessionDuration;
        const diff = remainingForGoal - sessionDuration;
        
        if (diff < 1) {
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
    if (finalPlanning.length > 25000) break; 
  }

  return finalPlanning.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
