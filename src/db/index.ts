import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { EventItem } from '../types/events.js';
import { EVENTS_DATABASE } from '../data/events.js';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'vector.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      short_title TEXT NOT NULL DEFAULT '',
      organizer TEXT NOT NULL,
      direction TEXT NOT NULL,
      direction_label TEXT NOT NULL,
      description TEXT NOT NULL,
      grades TEXT NOT NULL,
      format TEXT NOT NULL,
      format_label TEXT NOT NULL,
      stages TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL,
      deadline_date TEXT,
      has_exact_deadline INTEGER NOT NULL DEFAULT 1,
      bonuses TEXT NOT NULL,
      has_ege_bonus INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'verified',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_bookmarks (
      user_id INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_projects (
      user_id INTEGER NOT NULL PRIMARY KEY,
      topic TEXT,
      goal TEXT,
      hypothesis TEXT,
      tasks TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      topic TEXT,
      academic_title TEXT,
      goal TEXT,
      hypothesis TEXT,
      object TEXT,
      subject TEXT,
      tasks TEXT,
      mentor_tip TEXT,
      checklist TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // проверяем чтоб в таблице олимпиад были все нужные колонки
  const columns = db.pragma('table_info(events)') as { name: string }[];
  const columnNames = columns.map((c) => c.name);

  if (!columnNames.includes('short_title')) {
    db.exec("ALTER TABLE events ADD COLUMN short_title TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.includes('stages')) {
    db.exec("ALTER TABLE events ADD COLUMN stages TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.includes('has_exact_deadline')) {
    db.exec('ALTER TABLE events ADD COLUMN has_exact_deadline INTEGER NOT NULL DEFAULT 1');
  }

  // поля для нормального паспорта проекта
  const projectCols = db.pragma('table_info(user_projects)') as { name: string }[];
  const projectColNames = projectCols.map((c) => c.name);

  if (!projectColNames.includes('academic_title')) {
    db.exec('ALTER TABLE user_projects ADD COLUMN academic_title TEXT');
  }
  if (!projectColNames.includes('object')) {
    db.exec('ALTER TABLE user_projects ADD COLUMN object TEXT');
  }
  if (!projectColNames.includes('subject')) {
    db.exec('ALTER TABLE user_projects ADD COLUMN subject TEXT');
  }
  if (!projectColNames.includes('mentor_tip')) {
    db.exec('ALTER TABLE user_projects ADD COLUMN mentor_tip TEXT');
  }

  // переносим старые проекты в общий список чтоб ничего не потерялось
  try {
    const oldProjects = db.prepare('SELECT * FROM user_projects').all() as any[];
    for (const op of oldProjects) {
      const projId = `proj_${op.user_id}_1`;
      db.prepare(`
        INSERT OR IGNORE INTO projects (
          id, user_id, topic, academic_title, goal, hypothesis, object, subject, tasks, mentor_tip, checklist, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)
      `).run(
        projId,
        op.user_id,
        op.topic || null,
        op.academic_title || null,
        op.goal || null,
        op.hypothesis || null,
        op.object || null,
        op.subject || null,
        op.tasks || null,
        op.mentor_tip || null,
        op.updated_at || Date.now(),
        op.updated_at || Date.now()
      );
    }
  } catch (migErr) {
    console.warn('Миграция projects:', migErr);
  }

  console.log(`🗄️ База данных SQLite подключена: ${dbPath}`);

  // загружаем проверенные хакатоны и олимпиады
  syncVerifiedEvents();
}

// заполняем базу олимпиадами и хакатоном
export function syncVerifiedEvents() {
  try {
    db.prepare("DELETE FROM events WHERE id IN ('vector_hack', 'max_edu_hack')").run();
  } catch {}

  const insert = db.prepare(`
    INSERT OR REPLACE INTO events (
      id, title, short_title, organizer, direction, direction_label, description,
      grades, format, format_label, stages, deadline, deadline_date,
      has_exact_deadline, bonuses, has_ege_bonus, url, source, created_at
    ) VALUES (
      @id, @title, @shortTitle, @organizer, @direction, @directionLabel, @description,
      @grades, @format, @formatLabel, @stages, @deadline, @deadlineDate,
      @hasExactDeadline, @bonuses, @hasEgeBonus, @url, 'verified', @createdAt
    )
  `);

  const insertMany = db.transaction((items: EventItem[]) => {
    for (const item of items) {
      insert.run({
        id: item.id,
        title: item.title,
        shortTitle: item.shortTitle || item.title,
        organizer: item.organizer,
        direction: item.direction,
        directionLabel: item.directionLabel,
        description: item.description,
        grades: JSON.stringify(item.grades),
        format: item.format,
        formatLabel: item.formatLabel,
        stages: item.stages || '',
        deadline: item.deadline,
        deadlineDate: item.deadlineDate,
        hasExactDeadline: item.hasExactDeadline ? 1 : 0,
        bonuses: item.bonuses,
        hasEgeBonus: item.hasEgeBonus ? 1 : 0,
        url: item.url,
        createdAt: Date.now(),
      });
    }
  });

  insertMany(EVENTS_DATABASE);
  console.log(`✅ В базу SQLite загружено ${EVENTS_DATABASE.length} верифицированных мероприятий.`);
}
