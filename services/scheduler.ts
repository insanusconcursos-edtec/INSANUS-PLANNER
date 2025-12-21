
import { 
  StudyPlan, 
  UserRoutine, 
  PlanningEntry, 
  Goal, 
  GoalType, 
  CycleSystem,
  UserProfile,
  CycleItem,
  SubGoal
} from '../types';
import { PROFILE_SPEEDS } from '../constants';

export const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateGoalDuration = (goal: Goal, profile: UserProfile): number => {
  if (goal.type === GoalType.CLASS) {
    // Para metas de aula, a duração agora vem da soma das submetas
    return (goal.subGoals || []).reduce((acc, sub) => acc + sub.minutes, 0);
  }
  
  if (goal.type === GoalType.SUMMARY) {
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

// Interface auxiliar para planificar a fila de trabalho
interface WorkUnit {
  goal: Goal;
  subGoal?: SubGoal;
  topicId: string;
  disciplineId: string;
}

export const generatePlanning = (
  plan: StudyPlan,
  routine: UserRoutine,
  startDate: Date = new Date(),
  existingPlanning: PlanningEntry[] = [],
  mode: 'new' | 'replan' = 'new'
): PlanningEntry[] => {
  if (!plan || !plan.cycles.length) return [];

  const todayStr = getLocalDateString(new Date());
  const completedEntries = existingPlanning.filter(e => e.status === 'COMPLETED');
  // Se for aula, checamos a conclusão por subGoalId
  const completedSubGoalIds = new Set(completedEntries.filter(e => e.subGoalId).map(e => e.subGoalId));
  const completedGoalIds = new Set(completedEntries.filter(e => !e.isReview && !e.subGoalId).map(e => e.goalId));
  
  const sortedCycles = [...plan.cycles].sort((a, b) => a.order - b.order);
  const rawOrderedGoals: { goal: Goal; topicId: string; disciplineId: string }[] = [];

  // 1. Extrair ordem de metas original do plano
  if (plan.cycleSystem === CycleSystem.CONTINUOUS) {
    sortedCycles.forEach(cycle => {
      const disciplineIds = getOrderedDisciplineIdsFromCycle(plan, cycle.items);
      disciplineIds.forEach(dId => {
        const discipline = plan.disciplines.find(d => d.id === dId);
        if (discipline) {
          [...discipline.topics].sort((a, b) => a.order - b.order).forEach(topic => {
            [...topic.goals].sort((a, b) => a.order - b.order).forEach(goal => {
              rawOrderedGoals.push({ goal, topicId: topic.id, disciplineId: dId });
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
                  rawOrderedGoals.push({ goal, topicId: topic.id, disciplineId: dId });
                });
              });
              topicOffsets[dId] = start + topicsBatch.length;
            }
          }
        });
      });
    }
  }

  // 2. Expandir Metas de Aula em WorkUnits individuais (Submetas)
  const workQueue: WorkUnit[] = [];
  rawOrderedGoals.forEach(item => {
    if (item.goal.type === GoalType.CLASS && item.goal.subGoals && item.goal.subGoals.length > 0) {
      // Ordenar submetas
      const subs = [...item.goal.subGoals].sort((a, b) => a.order - b.order);
      subs.forEach(sub => {
        if (!completedSubGoalIds.has(sub.id)) {
          workQueue.push({ ...item, subGoal: sub });
        }
      });
    } else {
      if (!completedGoalIds.has(item.goal.id)) {
        workQueue.push(item);
      }
    }
  });

  // 3. Distribuição Inteligente
  let cursorDate = new Date(startDate);
  cursorDate.setHours(0, 0, 0, 0);
  
  const finalPlanning: PlanningEntry[] = [...completedEntries];
  
  // Incluir revisões agendadas
  const existingReviews = existingPlanning.filter(e => e.isReview && (getLocalDateString(new Date(e.date)) >= todayStr || e.status === 'COMPLETED'));
  existingReviews.forEach(r => {
    if (!finalPlanning.find(f => f.id === r.id)) finalPlanning.push(r);
  });

  let workIdx = 0;
  let carryOverMinutes = 0;

  while (workIdx < workQueue.length) {
    const dow = cursorDate.getDay();
    const currentDayStr = getLocalDateString(cursorDate);
    const capacity = routine.days[dow] || 0;

    if (capacity <= 0) {
      cursorDate.setDate(cursorDate.getDate() + 1);
      continue;
    }

    let spentToday = 0;
    const dayEntries = finalPlanning.filter(e => getLocalDateString(new Date(e.date)) === currentDayStr);
    dayEntries.forEach(e => spentToday += e.durationMinutes);

    while (spentToday < capacity && workIdx < workQueue.length) {
      const unit = workQueue[workIdx];
      const { goal, subGoal, topicId, disciplineId } = unit;
      
      const isClass = goal.type === GoalType.CLASS && !!subGoal;
      const fullTime = isClass ? subGoal!.minutes : calculateGoalDuration(goal, routine.profile);
      const remainingForUnit = carryOverMinutes > 0 ? carryOverMinutes : fullTime;
      
      const availableCapacity = capacity - spentToday;

      // LÓGICA DE NÃO FRACIONAMENTO DE AULAS
      if (isClass && carryOverMinutes === 0) {
        // Se a aula for maior que o tempo restante HOJE...
        if (fullTime > availableCapacity) {
          // ...e se a aula CABE em um dia inteiro do usuário (considerando a capacidade total do dia)
          if (fullTime <= capacity) {
            // Pula para o próximo dia (encerra o dia de hoje prematuramente)
            break; 
          }
          // Caso a aula seja maior que a capacidade TOTAL do dia do usuário (ex: aula de 120min e aluno estuda 60min/dia)
          // Nesse caso inevitável, permitimos o fracionamento.
        }
      }

      const sessionDuration = Math.min(remainingForUnit, availableCapacity);

      if (sessionDuration > 0) {
        finalPlanning.push({
          id: Math.random().toString(36).substr(2, 9),
          goalId: goal.id,
          subGoalId: subGoal?.id,
          topicId,
          disciplineId,
          date: cursorDate.toISOString(),
          durationMinutes: Math.round(sessionDuration),
          status: currentDayStr < todayStr ? 'DELAYED' : 'PENDING',
          isReview: false
        });
        
        spentToday += sessionDuration;
        const diff = remainingForUnit - sessionDuration;
        
        if (diff < 0.1) {
          workIdx++;
          carryOverMinutes = 0;
        } else {
          carryOverMinutes = diff;
        }
      } else {
        break; 
      }
    }
    cursorDate.setDate(cursorDate.getDate() + 1);
    if (finalPlanning.length > 10000) break; 
  }

  return finalPlanning.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
