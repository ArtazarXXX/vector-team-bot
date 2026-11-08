import { UserSession, BotStep, ProjectDraft } from '../types/index.js';
import { db } from '../db/index.js';

class SessionManager {
  private sessions = new Map<number, UserSession>();

  public getSession(userId: number): UserSession {
    let session = this.sessions.get(userId);
    if (!session) {
      // ищем в базе активный проект пользователя, чтоб после перезапуска бота ничего не сбрасывалось
      let activeRow = db
        .prepare('SELECT * FROM projects WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1')
        .get(userId) as any;

      // если галочки активного нет, просто берем самый свежий проект юзера
      if (!activeRow) {
        activeRow = db
          .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
          .get(userId) as any;
      }

      let projectDraft: ProjectDraft = {};
      let activeProjectId: string | undefined = undefined;

      if (activeRow) {
        activeProjectId = activeRow.id;
        projectDraft = this.mapRowToDraft(activeRow);
      }

      session = {
        userId,
        step: 'IDLE',
        activeProjectId,
        projectDraft,
        updatedAt: Date.now(),
      };
      this.sessions.set(userId, session);
    }
    session.updatedAt = Date.now();
    return session;
  }

  private mapRowToDraft(row: any): ProjectDraft {
    let tasks: string[] | undefined;
    let checklist: number[] = [];
    try {
      if (row.tasks) tasks = JSON.parse(row.tasks);
    } catch {}
    try {
      if (row.checklist) checklist = JSON.parse(row.checklist);
    } catch {}

    return {
      id: row.id,
      topic: row.topic || undefined,
      academicTitle: row.academic_title || undefined,
      goal: row.goal || undefined,
      hypothesis: row.hypothesis || undefined,
      object: row.object || undefined,
      subject: row.subject || undefined,
      tasks,
      mentorTip: row.mentor_tip || undefined,
      checklist,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public getUserProjects(userId: number): ProjectDraft[] {
    const rows = db
      .prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId) as any[];
    return rows.map((r) => this.mapRowToDraft(r));
  }

  public setActiveProject(userId: number, projectId: string): ProjectDraft | null {
    const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId) as any;
    if (!row) return null;

    db.prepare('UPDATE projects SET is_active = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE projects SET is_active = 1, updated_at = ? WHERE id = ?').run(Date.now(), projectId);

    const draft = this.mapRowToDraft(row);
    const session = this.getSession(userId);
    session.activeProjectId = projectId;
    session.projectDraft = draft;
    session.updatedAt = Date.now();
    return draft;
  }

  public createNewProject(userId: number): ProjectDraft {
    const projId = `proj_${userId}_${Date.now()}`;
    const now = Date.now();

    db.prepare('UPDATE projects SET is_active = 0 WHERE user_id = ?').run(userId);

    db.prepare(`
      INSERT INTO projects (
        id, user_id, topic, academic_title, goal, hypothesis, object, subject, tasks, mentor_tip, checklist, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)
    `).run(
      projId,
      userId,
      null,
      'Новый проект',
      null,
      null,
      null,
      null,
      null,
      null,
      now,
      now
    );

    const newDraft: ProjectDraft = {
      id: projId,
      academicTitle: 'Новый проект',
      checklist: [],
      createdAt: now,
      updatedAt: now,
    };

    const session = this.getSession(userId);
    session.activeProjectId = projId;
    session.projectDraft = newDraft;
    session.updatedAt = now;
    return newDraft;
  }

  public deleteProject(userId: number, projectId: string): boolean {
    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(projectId, userId);
    const session = this.getSession(userId);
    if (session.activeProjectId === projectId) {
      const remaining = this.getUserProjects(userId);
      if (remaining.length > 0) {
        this.setActiveProject(userId, remaining[0].id!);
      } else {
        session.activeProjectId = undefined;
        session.projectDraft = {};
      }
    }
    return true;
  }

  public toggleChecklistItem(userId: number, itemNumber: number): { checklist: number[]; draft: ProjectDraft } {
    const session = this.getSession(userId);
    let projectId = session.activeProjectId;

    if (!projectId) {
      const newProj = this.createNewProject(userId);
      projectId = newProj.id!;
    }

    let checklist = session.projectDraft.checklist || [];
    if (checklist.includes(itemNumber)) {
      checklist = checklist.filter((n) => n !== itemNumber);
    } else {
      checklist = [...checklist, itemNumber].sort((a, b) => a - b);
    }

    session.projectDraft.checklist = checklist;
    session.updatedAt = Date.now();

    db.prepare('UPDATE projects SET checklist = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(checklist),
      Date.now(),
      projectId
    );

    return { checklist, draft: session.projectDraft };
  }

  public setStep(userId: number, step: BotStep): void {
    const session = this.getSession(userId);
    session.step = step;
    session.updatedAt = Date.now();
  }

  public reset(userId: number): void {
    const session = this.getSession(userId);
    session.step = 'IDLE';
    session.updatedAt = Date.now();
  }

  public updateProjectDraft(userId: number, update: Partial<ProjectDraft>): void {
    const session = this.getSession(userId);
    let projectId = session.activeProjectId;

    if (!projectId) {
      projectId = `proj_${userId}_${Date.now()}`;
      session.activeProjectId = projectId;
      db.prepare('UPDATE projects SET is_active = 0 WHERE user_id = ?').run(userId);
      db.prepare(`
        INSERT INTO projects (
          id, user_id, topic, academic_title, goal, hypothesis, object, subject, tasks, mentor_tip, checklist, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1, ?, ?)
      `).run(
        projectId,
        userId,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        Date.now(),
        Date.now()
      );
    }

    session.projectDraft = {
      ...session.projectDraft,
      ...update,
      id: projectId,
    };
    session.updatedAt = Date.now();

    // Сохраняем в таблицу projects персистентно
    db.prepare(`
      UPDATE projects SET
        topic = ?,
        academic_title = ?,
        goal = ?,
        hypothesis = ?,
        object = ?,
        subject = ?,
        tasks = ?,
        mentor_tip = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      session.projectDraft.topic || null,
      session.projectDraft.academicTitle || null,
      session.projectDraft.goal || null,
      session.projectDraft.hypothesis || null,
      session.projectDraft.object || null,
      session.projectDraft.subject || null,
      session.projectDraft.tasks ? JSON.stringify(session.projectDraft.tasks) : null,
      session.projectDraft.mentorTip || null,
      Date.now(),
      projectId
    );

    // Обратная совместимость с таблицей user_projects
    try {
      db.prepare(`
        INSERT OR REPLACE INTO user_projects (
          user_id, topic, academic_title, goal, hypothesis, object, subject, tasks, mentor_tip, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        session.projectDraft.topic || null,
        session.projectDraft.academicTitle || null,
        session.projectDraft.goal || null,
        session.projectDraft.hypothesis || null,
        session.projectDraft.object || null,
        session.projectDraft.subject || null,
        session.projectDraft.tasks ? JSON.stringify(session.projectDraft.tasks) : null,
        session.projectDraft.mentorTip || null,
        Date.now()
      );
    } catch {}
  }
}

export const sessionManager = new SessionManager();
