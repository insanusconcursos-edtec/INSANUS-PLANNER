
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

const getDisciplinesFromCycleItems = (plan: StudyPlan, items: CycleItem[]): string[] => {
  const disciplineIds: string[] = [];
  items.forEach(item => {
    if (item.type === 'DISCIPLINE') {
      disciplineIds.push(item.id);
    } else {
      // Expand folder: find disciplines belonging to this folder, sorted by their position in plan.disciplines
      const folderDisciplines = plan.disciplines
        .filter(d => d.folderId === item.id)
        .map(d => d.id);
      disciplineIds.push(...folderDisciplines);
    }
  });
  // Remove duplicates while preserving order
  return [...new Set(disciplineIds)];
};

export const generatePlanning = (
  plan: StudyPlan,
  routine: UserRoutine,
  startDate: Date = new Date()
): PlanningEntry[] => {
  if (!plan) return [];

  const entries: PlanningEntry[] = [];
  const allOrderedGoals: { goal: Goal; topicId: string; disciplineId: string }[] = [];

  // Flatten goals based on Cycles and sorting
  const sortedCycles = [...plan.cycles].sort((a, b) => a.order - b.order);

  if (plan.cycleSystem === CycleSystem.CONTINUOUS) {
    sortedCycles.forEach(cycle => {
      const disciplinesInCycle = getDisciplinesFromCycleItems(plan, cycle.items);
      disciplinesInCycle.forEach(dId => {
        const discipline = plan.disciplines.find(d => d.id === dId);
        if (discipline) {
          discipline.topics.forEach(topic => {
            topic.goals.forEach(goal => {
              allOrderedGoals.push({ goal, topicId: topic.id, disciplineId: discipline.id });
            });
          });
        }
      });
    });
  } else {
    // Rotating System
    let hasMore = true;
    let topicOffsetMap: Record<string, number> = {}; // disciplineId -> count

    while (hasMore) {
      hasMore = false;
      sortedCycles.forEach(cycle => {
        const disciplinesInCycle = getDisciplinesFromCycleItems(plan, cycle.items);
        disciplinesInCycle.forEach(dId => {
          const discipline = plan.disciplines.find(d => d.id === dId);
          if (discipline) {
            const start = topicOffsetMap[dId] || 0;
            const topicsToTake = discipline.topics.slice(start, start + cycle.topicsPerDiscipline);
            if (topicsToTake.length > 0) {
              hasMore = true;
              topicsToTake.forEach(topic => {
                topic.goals.forEach(goal => {
                  allOrderedGoals.push({ goal, topicId: topic.id, disciplineId: discipline.id });
                });
              });
              topicOffsetMap[dId] = start + topicsToTake.length;
            }
          }
        });
      });
    }
  }

  // Distribute over days
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  let currentGoalIndex = 0;
  let remainingMinutesFromGoal = 0;

  while (currentGoalIndex < allOrderedGoals.length) {
    const dayOfWeek = currentDate.getDay();
    const availableMinutesToday = routine.days[dayOfWeek] || 0;

    if (availableMinutesToday <= 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let spentToday = 0;
    while (spentToday < availableMinutesToday && currentGoalIndex < allOrderedGoals.length) {
      const { goal, topicId, disciplineId } = allOrderedGoals[currentGoalIndex];
      const fullDuration = calculateGoalDuration(goal, routine.profile);
      const needed = remainingMinutesFromGoal > 0 ? remainingMinutesFromGoal : fullDuration;
      
      const canDo = Math.min(needed, availableMinutesToday - spentToday);

      if (canDo > 0) {
        entries.push({
          id: Math.random().toString(36).substr(2, 9),
          goalId: goal.id,
          topicId,
          disciplineId,
          date: currentDate.toISOString(),
          durationMinutes: canDo,
          status: 'PENDING',
          isReview: false
        });
        
        spentToday += canDo;
        const stillNeeded = needed - canDo;
        
        if (stillNeeded <= 0) {
          currentGoalIndex++;
          remainingMinutesFromGoal = 0;
        } else {
          remainingMinutesFromGoal = stillNeeded;
        }
      } else {
        break; // Day full
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Safety break
    if (entries.length > 2000) break; 
  }

  return entries;
};
