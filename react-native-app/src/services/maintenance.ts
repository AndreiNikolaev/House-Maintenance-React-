import { addDays, addMonths, addYears, isAfter, parseISO } from 'date-fns';

export const maintenanceLogic = {
  getNextDate(lastCompleted: string | null, periodicity: string): Date {
    const baseDate = lastCompleted ? parseISO(lastCompleted) : new Date();
    
    const p = periodicity.toLowerCase();
    if (p.includes('месяц')) {
      const num = parseInt(p) || 1;
      return addMonths(baseDate, num);
    }
    if (p.includes('год')) {
      const num = parseInt(p) || 1;
      return addYears(baseDate, num);
    }
    if (p.includes('день') || p.includes('дней')) {
      const num = parseInt(p) || 1;
      return addDays(baseDate, num);
    }
    
    return addMonths(baseDate, 6); // Default
  },

  isOverdue(lastCompleted: string | null, periodicity: string): boolean {
    if (!lastCompleted) return true;
    const nextDate = this.getNextDate(lastCompleted, periodicity);
    return isAfter(new Date(), nextDate);
  }
};
