export type EventDirection = 'it' | 'robotics' | 'science' | 'engineering' | 'all';

export type EventFormat = 'online' | 'offline' | 'hybrid';

export interface EventItem {
  id: string;
  title: string;
  shortTitle: string; // Короткое название для аккуратных кнопок без обрезания
  organizer: string;
  direction: EventDirection;
  directionLabel: string;
  description: string;
  grades: number[]; // [7, 8, 9, 10, 11]
  format: EventFormat;
  formatLabel: string;
  stages: string; // Описание этапов (отбор, полуфинал, финал)
  deadline: string; // Дедлайн текущего этапа (например: "до 30 ноября 2026")
  deadlineDate: string | null; // "YYYY-MM-DD" или null, если дата плавающая
  hasExactDeadline: boolean;
  bonuses: string;
  hasEgeBonus: boolean;
  url: string;
}

export interface EventFilter {
  grade?: number;
  direction?: EventDirection;
  bonusOnly?: boolean;
}
