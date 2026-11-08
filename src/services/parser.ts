import { XMLParser } from 'fast-xml-parser';
import { db } from '../db/index.js';
import { EventDirection, EventItem } from '../types/events.js';
import { llmService } from './llm.js';

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

class EventParserService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  public async syncFromWeb(): Promise<{ totalFound: number; addedOrUpdated: number }> {
    console.log('🌐 Запуск интеллектуального ИИ-парсера (RSS + LLM)...');
    const url = 'https://vsekonkursy.ru/feed';

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000), // таймаут 8 сек, чтоб бот не висел если сайт лежит
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const jsonObj = this.parser.parse(xmlText);
      const items: RSSItem[] = jsonObj?.rss?.channel?.item || [];

      // фильтруем школьные конкурсы и берем 3 штуки чтоб быстро обработать
      const candidateItems = items
        .filter((item) => {
          if (!item.title || !item.link) return false;
          const rawText = `${item.title} ${item.description || ''}`.toLowerCase();
          return (
            rawText.includes('школьн') ||
            rawText.includes('класс') ||
            rawText.includes('олимпиад') ||
            rawText.includes('хакатон') ||
            rawText.includes('проект') ||
            rawText.includes('чемпионат') ||
            rawText.includes('конкурс')
          );
        })
        .slice(0, 3); // Ровно 3 штуки для мгновенного параллельного разбора

      const insertOrUpdate = db.prepare(`
        INSERT OR REPLACE INTO events (
          id, title, short_title, organizer, direction, direction_label, description,
          grades, format, format_label, stages, deadline, deadline_date,
          has_exact_deadline, bonuses, has_ege_bonus, url, source, created_at
        ) VALUES (
          @id, @title, @shortTitle, @organizer, @direction, @directionLabel, @description,
          @grades, @format, @formatLabel, @stages, @deadline, @deadlineDate,
          @hasExactDeadline, @bonuses, @hasEgeBonus, @url, 'parsed', @createdAt
        )
      `);

      // прогоняем через модельку пачкой с таймаутом, чтоб долго не ждать
      const parsedEvents = await Promise.all(
        candidateItems.map(async (item) => {
          try {
            return await Promise.race([
              this.parseItemWithAI(item),
              new Promise<EventItem>((resolve) =>
                setTimeout(() => resolve(this.createFallbackEvent(item)), 10000)
              ),
            ]);
          } catch (err) {
            console.warn(`Не удалось обработать элемент через ИИ: ${item.title}`, err);
            return this.createFallbackEvent(item);
          }
        })
      );

      let addedCount = 0;
      for (const event of parsedEvents) {
        if (!event) continue;
        try {
          insertOrUpdate.run({
            id: event.id,
            title: event.title,
            shortTitle: event.shortTitle,
            organizer: event.organizer,
            direction: event.direction,
            directionLabel: event.directionLabel,
            description: event.description,
            grades: JSON.stringify(event.grades),
            format: event.format,
            formatLabel: event.formatLabel,
            stages: event.stages,
            deadline: event.deadline,
            deadlineDate: event.deadlineDate || '', // Защита от SQLITE_CONSTRAINT_NOTNULL
            hasExactDeadline: event.hasExactDeadline ? 1 : 0,
            bonuses: event.bonuses,
            hasEgeBonus: event.hasEgeBonus ? 1 : 0,
            url: event.url,
            createdAt: Date.now(),
          });
          addedCount++;
        } catch (dbErr) {
          console.warn(`Ошибка сохранения в БД для: ${event.title}`, dbErr);
        }
      }

      console.log(`✅ ИИ-парсер успешно сохранил/обновил: ${addedCount} мероприятий в SQLite.`);
      return { totalFound: items.length, addedOrUpdated: addedCount };
    } catch (error) {
      console.error('❌ Ошибка при выполнении парсера RSS:', error);
      throw error;
    }
  }

  // Интеллектуальный разбор статьи через нейросетевую модель
  private async parseItemWithAI(item: RSSItem): Promise<EventItem> {
    const title = item.title!.trim();
    const cleanDesc = (item.description || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#171;|&#187;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    const slugMatch = item.link!.match(/\/([^/]+)\.html/);
    const id = slugMatch ? `parsed_${slugMatch[1]}` : `parsed_${Math.abs(this.hashCode(item.link!))}`;

    const prompt =
      `Проанализируй публикацию о конкурсе/олимпиаде и верни СТРОГО валидный JSON-объект без markdown-разметки.\n\n` +
      `Заголовок: "${title}"\n` +
      `Текст: "${cleanDesc}"\n\n` +
      `Схема JSON:\n` +
      `{\n` +
      `  "shortTitle": "Короткое название до 22 символов для кнопки (например: Олимпиада Маркова, VK Case Champ)",\n` +
      `  "organizer": "Организатор (вуз, компания или ведомство)",\n` +
      `  "direction": "it | robotics | science | engineering | all",\n` +
      `  "directionLabel": "Тег со смайликом (например: 💻 IT & Код)",\n` +
      `  "stages": "Кратко этапы (например: Отбор до 19 фев 2027 | Финал в апреле)",\n` +
      `  "deadline": "Точный дедлайн текущего этапа (например: до 19 февраля 2027) ИЛИ 'Сроки в регламенте'",\n` +
      `  "deadlineDate": "YYYY-MM-DD или пустая строка если даты нет",\n` +
      `  "hasExactDeadline": true или false,\n` +
      `  "grades": [массив чисел классов, например [7, 8] или [8, 9, 10, 11]],\n` +
      `  "bonuses": "Какие льготы или призы (дипломы, баллы к ЕГЭ, техника)",\n` +
      `  "hasEgeBonus": true или false,\n` +
      `  "description": "Емкое описание сути проекта на 2 предложения"\n` +
      `}`;

    try {
      const rawAiResponse = await llmService.complete(
        prompt,
        'Ты — аналитический модуль парсера школьных конкурсов. Твой ответ — СТРОГО JSON-объект без лишних слов.'
      );

      const jsonClean = rawAiResponse
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const parsed = JSON.parse(jsonClean);

      return {
        id,
        title,
        shortTitle: parsed.shortTitle || (title.length > 22 ? title.substring(0, 19) + '...' : title),
        organizer: parsed.organizer || 'Оргкомитет',
        direction: (parsed.direction as EventDirection) || 'all',
        directionLabel: parsed.directionLabel || '🏆 Всероссийский конкурс',
        description: parsed.description || cleanDesc.substring(0, 200),
        grades: Array.isArray(parsed.grades) && parsed.grades.length > 0 ? parsed.grades : [7, 8, 9, 10, 11],
        format: 'online',
        formatLabel: '🌐 Онлайн / Дистанционный',
        stages: parsed.stages || 'Сроки этапов уточняются в положении',
        deadline: parsed.deadline || 'Уточняется в положении',
        deadlineDate: parsed.hasExactDeadline && parsed.deadlineDate ? parsed.deadlineDate : '',
        hasExactDeadline: Boolean(parsed.hasExactDeadline && parsed.deadlineDate),
        bonuses: parsed.bonuses || 'Дипломы всероссийского уровня, учет в портфолио',
        hasEgeBonus: Boolean(parsed.hasEgeBonus),
        url: item.link!,
      };
    } catch {
      return this.createFallbackEvent(item);
    }
  }

  // Быстрый эвристический fallback без ожидания нейросети
  private createFallbackEvent(item: RSSItem): EventItem {
    const title = (item.title || 'Всероссийский конкурс').trim();
    const cleanDesc = (item.description || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const slugMatch = (item.link || '').match(/\/([^/]+)\.html/);
    const id = slugMatch ? `parsed_${slugMatch[1]}` : `parsed_${Math.abs(this.hashCode(item.link || title))}`;

    return {
      id,
      title,
      shortTitle: title.length > 22 ? title.substring(0, 19) + '...' : title,
      organizer: 'Оргкомитет конкурса',
      direction: 'all',
      directionLabel: '🏆 Всероссийский конкурс',
      description: cleanDesc.length > 200 ? cleanDesc.substring(0, 197) + '...' : cleanDesc,
      grades: [7, 8, 9, 10, 11],
      format: 'online',
      formatLabel: '🌐 Онлайн',
      stages: 'Сроки и этапы указаны на официальном сайте',
      deadline: 'Уточняется в регламенте',
      deadlineDate: '',
      hasExactDeadline: false,
      bonuses: 'Сертификаты участников, учет в индивидуальных достижениях',
      hasEgeBonus: false,
      url: item.link || 'https://vsekonkursy.ru',
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const eventParserService = new EventParserService();
