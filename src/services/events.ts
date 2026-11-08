import { db } from '../db/index.js';
import { EventItem, EventFilter, EventDirection, EventFormat } from '../types/events.js';
import { eventParserService } from './parser.js';

interface EventDbRow {
  id: string;
  title: string;
  short_title: string;
  organizer: string;
  direction: string;
  direction_label: string;
  description: string;
  grades: string;
  format: string;
  format_label: string;
  stages: string;
  deadline: string;
  deadline_date: string | null;
  has_exact_deadline: number;
  bonuses: string;
  has_ege_bonus: number;
  url: string;
  source: string;
  created_at: number;
}

class EventsService {
  public getAllEvents(): EventItem[] {
    const rows = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all() as EventDbRow[];
    return rows.map(this.rowToEvent);
  }

  public getEventById(id: string): EventItem | undefined {
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventDbRow | undefined;
    return row ? this.rowToEvent(row) : undefined;
  }

  public filterEvents(filter: EventFilter): EventItem[] {
    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (filter.direction && filter.direction !== 'all') {
      query += ' AND direction = ?';
      params.push(filter.direction);
    }

    // фильтруем олимпиады которые дают 100 баллов или поступление без экзаменов
    if (filter.bonusOnly) {
      query += ' AND has_ege_bonus = 1';
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as EventDbRow[];
    const events = rows.map(this.rowToEvent);

    if (filter.grade !== undefined && filter.grade > 0) {
      return events.filter((e) => e.grades.includes(filter.grade!));
    }

    return events;
  }

  public isBookmarked(userId: number, eventId: string): boolean {
    const row = db
      .prepare('SELECT 1 FROM user_bookmarks WHERE user_id = ? AND event_id = ?')
      .get(userId, eventId);
    return !!row;
  }

  public toggleBookmark(userId: number, eventId: string): boolean {
    const exists = this.isBookmarked(userId, eventId);
    if (exists) {
      db.prepare('DELETE FROM user_bookmarks WHERE user_id = ? AND event_id = ?').run(userId, eventId);
      return false;
    } else {
      db.prepare('INSERT INTO user_bookmarks (user_id, event_id, created_at) VALUES (?, ?, ?)').run(
        userId,
        eventId,
        Date.now()
      );
      return true;
    }
  }

  public getUserBookmarks(userId: number): EventItem[] {
    const rows = db
      .prepare(
        `SELECT e.* FROM events e 
         INNER JOIN user_bookmarks b ON e.id = b.event_id 
         WHERE b.user_id = ? 
         ORDER BY e.created_at DESC`
      )
      .all(userId) as EventDbRow[];

    return rows.map(this.rowToEvent);
  }

  public async syncWithWeb(): Promise<{ totalFound: number; addedOrUpdated: number }> {
    return await eventParserService.syncFromWeb();
  }

  // Карточка с красивым форматированием и честным дедлайном
  public formatEventCard(event: EventItem, isBookmarked = false): string {
    let deadlineNotice = '';

    if (event.hasExactDeadline && event.deadlineDate) {
      const daysLeft = this.calculateDaysLeft(event.deadlineDate);
      if (daysLeft > 0) {
        deadlineNotice = ` (⏳ осталось: **${daysLeft} дн.**)`;
      } else if (daysLeft === 0) {
        deadlineNotice = ` (🔥 **дедлайн сегодня!**)`;
      } else {
        deadlineNotice = ` (⚠️ прием заявок на этот этап завершен)`;
      }
    } else {
      deadlineNotice = ` *(сроки этапов уточняются в регламенте)*`;
    }

    const bookmarkStatus = isBookmarked ? '⭐ *(В ваших дедлайнах)*' : '';

    return (
      `📌 **${event.title}** ${bookmarkStatus}\n\n` +
      `🏢 **Организатор:** ${event.organizer}\n` +
      `🧭 **Направление:** ${event.directionLabel}\n` +
      `🎓 **Классы:** ${event.grades.join(', ')} классы\n` +
      `📍 **Формат:** ${event.formatLabel}\n\n` +
      `📅 **Текущий дедлайн:** **${event.deadline}**${deadlineNotice}\n` +
      `⏱️ **График этапов:** _${event.stages}_\n\n` +
      `🎁 **Бонусы:** ${event.bonuses}\n\n` +
      `📖 _${event.description}_\n\n` +
      `🔗 [Официальный сайт / Регистрация](${event.url})`
    );
  }

  private rowToEvent(row: EventDbRow): EventItem {
    let grades: number[] = [7, 8, 9, 10, 11];
    try {
      grades = JSON.parse(row.grades);
    } catch {
      // fallback
    }

    return {
      id: row.id,
      title: row.title,
      shortTitle: row.short_title || row.title.substring(0, 22),
      organizer: row.organizer,
      direction: row.direction as EventDirection,
      directionLabel: row.direction_label,
      description: row.description,
      grades,
      format: row.format as EventFormat,
      formatLabel: row.format_label,
      stages: row.stages || 'Уточняется в положении',
      deadline: row.deadline,
      deadlineDate: row.deadline_date,
      hasExactDeadline: row.has_exact_deadline === 1,
      bonuses: row.bonuses,
      hasEgeBonus: row.has_ege_bonus === 1,
      url: row.url,
    };
  }

  private calculateDaysLeft(deadlineDateStr: string): number {
    const target = new Date(deadlineDateStr).getTime();
    const now = new Date().getTime();
    const diffMs = target - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

export const eventsService = new EventsService();
