export interface SummaryData {
  income: number;
  expenses: number;
  savings: number;
  spentPercentage: number;
}

export interface CategoryData {
  name: string;
  value: number;
  color: string;
}

export type TabType = 'summary' | 'income' | 'expenses' | 'goals';
