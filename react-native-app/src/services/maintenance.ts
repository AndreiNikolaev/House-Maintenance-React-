import { addDays, addMonths, addYears, isAfter, parseISO } from 'date-fns';

export const maintenanceLogic = {
  parsePeriodicity: (period: string): { value: number; unit: 'day' | 'month' | 'year' } | null => {
    const lower = period.toLowerCase();
    const num = parseInt(lower.match(/\d+/)?.[0] || '1');
    
    if (lower.includes('день') || lower.includes('дня') || lower.includes('дней')) return { value: num, unit: 'day' };
    if (lower.includes('месяц') || lower.includes('мес')) return { value: num, unit: 'month' };
    if (lower.includes('год') || lower.includes('лет')) return { value: num, unit: 'year' };
    
    if (lower.includes('раз в')) return { value: 1, unit: 'year' };
    
    return null;
  },

  getNextDate: (lastDate: string | null, periodicity: string): Date => {
    const start = lastDate ? parseISO(lastDate) : new Date(2000, 0, 1);
    const parsed = maintenanceLogic.parsePeriodicity(periodicity);
    
    if (!parsed) return addYears(start, 1);

    switch (parsed.unit) {
      case 'day': return addDays(start, parsed.value);
      case 'month': return addMonths(start, parsed.value);
      case 'year': return addYears(start, parsed.value);
    }
  },

  isOverdue: (lastDate: string | null, periodicity: string): boolean => {
    if (!lastDate) return true;
    const nextDate = maintenanceLogic.getNextDate(lastDate, periodicity);
    return isAfter(new Date(), nextDate);
  }
};
