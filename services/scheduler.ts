
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
      const folderDisciplines = plan.disciplines
        .filter(d => d.folderId === item.id)
        .map(d => d.id);
      disciplineIds.push(...folderDisciplines);
    }
  });
  return [...new Set(disciplineIds)];
};

export const generatePlanning = (
  plan: StudyPlan,
  routine: UserRoutine,
  startDate: Date = new Date(),
  existingPlanning: PlanningEntry[] = []
): PlanningEntry[] => {
  if (!plan) return [];

  const allOrderedGoals: { goal: Goal; topicId: string; disciplineId: string }[] = [];
  const sortedCycles = [...plan.cycles].sort((a, b) => a.order - b.order);

  if (plan.cycleSystem === CycleSystem.CONTINUOUS) {
    sortedCycles.forEach(cycle => {
      const disciplinesInCycle = getDisciplinesFromCycleItems(plan, cycle.items);
      disciplinesInCycle.forEach(dId => {
        const discipline = plan.disciplines.find(d => d.id === dId);
        if (discipline) {
          discipline.topics.sort((a,b) => a.order - b.order).forEach(topic => {
            topic.goals.sort((a,b) => a.order - b.order).forEach(goal => {
              allOrderedGoals.push({ goal, topicId: topic.id, disciplineId: discipline.id });
            });
          });
        }
      });
    });
  } else {
    // Rotating System
    let hasMore = true;
    let topicOffsetMap: Record<string, number> = {}; 

    while (hasMore) {
      hasMore = false;
      sortedCycles.forEach(cycle => {
        const disciplinesInCycle = getDisciplinesFromCycleItems(plan, cycle.items);
        disciplinesInCycle.forEach(dId => {
          const discipline = plan.disciplines.find(d => d.id === dId);
          if (discipline) {
            const start = topicOffsetMap[dId] || 0;
            const topicsToTake = discipline.topics
              .sort((a,b) => a.order - b.order)
              .slice(start, start + cycle.topicsPerDiscipline);
              
            if (topicsToTake.length > 0) {
              hasMore = true;
              topicsToTake.forEach(topic => {
                topic.goals.sort((a,b) => a.order - b.order).forEach(goal => {
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

  // Preserve already completed goals and reviews
  const completedEntries = existingPlanning.filter(e => e.status === 'COMPLETED' || e.isReview);
  
  // Start distribution logic
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  const finalEntries: PlanningEntry[] = [...completedEntries];
  
  // Only distribute pending base goals
  // Find which base goals are already completed
  const completedGoalIds = new Set(completedEntries.filter(e => !e.isReview).map(e => e.goalId));
  const pendingBaseGoals = allOrderedGoals.filter(item => !completedGoalIds.has(item.goal.id));

  let currentGoalIndex = 0;
  let remainingMinutesFromGoal = 0;

  // Review logic: Add reviews based on completion dates
  // This scheduler handles initial plan. Dynamic reviews are added by App.tsx upon completion.
  
  while (currentGoalIndex < pendingBaseGoals.length) {
    const dayOfWeek = currentDate.getDay();
    const availableMinutesToday = routine.days[dayOfWeek] || 0;

    if (availableMinutesToday <= 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let spentToday = 0;
    
    // Check if there are scheduled reviews for today first (priority)
    const reviewsForToday = completedEntries.filter(e => e.isReview && e.status === 'PENDING' && e.date.split('T')[0] === currentDate.toISOString().split('T')[0]);
    reviewsForToday.forEach(rev => { spentToday += rev.durationMinutes; });

    while (spentToday < availableMinutesToday && currentGoalIndex < pendingBaseGoals.length) {
      const { goal, topicId, disciplineId } = pendingBaseGoals[currentGoalIndex];
      const fullDuration = calculateGoalDuration(goal, routine.profile);
      const needed = remainingMinutesFromGoal > 0 ? remainingMinutesFromGoal : fullDuration;
      
      const canDo = Math.min(needed, availableMinutesToday - spentToday);

      if (canDo > 0) {
        finalEntries.push({
          id: Math.random().toString(36).substr(2, 9),
          goalId: goal.id,
          topicId,
          disciplineId,
          date: currentDate.toISOString(),
          durationMinutes: Math.round(canDo),
          status: 'PENDING',
          isReview: false
        });
        
        spentToday += canDo;
        const stillNeeded = needed - canDo;
        
        if (stillNeeded < 1) { // Close enough to zero
          currentGoalIndex++;
          remainingMinutesFromGoal = 0;
        } else {
          remainingMinutesFromGoal = stillNeeded;
        }
      } else {
        break; 
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
    if (finalEntries.length > 5000) break; 
  }

  return finalEntries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};
