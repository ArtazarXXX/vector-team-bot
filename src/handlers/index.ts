import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import {
  mainMenuKeyboard,
  backToMenuKeyboard,
  navigatorMainMenuKeyboard,
  gradeFilterKeyboard,
  directionFilterKeyboard,
  paginatedEventsKeyboard,
  eventCardKeyboard,
  bookmarksKeyboard,
  copilotMenuKeyboard,
  rehearsalMenuKeyboard,
  rehearsalActiveKeyboard,
  rehearsalFinishKeyboard,
  projectMenuKeyboard,
  projectsListKeyboard,
  checklistKeyboard,
} from '../keyboards/index.js';
import { sessionManager } from '../services/session.js';
import { llmService } from '../services/llm.js';
import { eventsService } from '../services/events.js';
import { guardrailsService } from '../services/guardrails.js';
import { EventDirection, EventItem } from '../types/events.js';

export function registerHandlers(bot: Bot) {
  // старт бота, сбрасываем состояние и показываем меню с кнопками
  bot.command('start', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.reset(userId);

    const userName = ctx.user?.first_name ? `, ${ctx.user.first_name}` : '';
    const text =
      `▲ **«ВЕКТОР» | Сферум / MAX**\n` +
      `_«Из хаоса идей — в чёткий результат»_\n\n` +
      `Привет${userName}! Я твой цифровой ИИ-наставник по проектной, исследовательской и конкурсной деятельности.\n\n` +
      `■ **Ключевые возможности:**\n` +
      `• 🧭 **Умный навигатор** — актуальный реестр всероссийских олимпиад и хакатонов с дедлайнами и льготами к ЕГЭ\n` +
      `• 💡 **ИИ-Ко-Пилот** — упакует твою идею в цель, задачи и научную гипотезу по канонам ФГОС\n` +
      `• 🎙️ **Репетиция защиты** — симулятор каверзных вопросов жюри с оценкой эксперта\n` +
      `• 📋 **Паспорт проекта** — сборка чистового документа для отправки твоему учителю в Сферуме\n` +
      `• ⭐ **Мои дедлайны** — персональный трекер сроков подачи заявок\n\n` +
      `Выбери раздел ниже 👇`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [mainMenuKeyboard()],
    });
  });

  bot.on('bot_started', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.reset(userId);

    const text =
      `▲ **Добро пожаловать в «ВЕКТОР»!**\n\n` +
      `Сервис готов помочь тебе побеждать в конкурсах и защищать проекты на максимум баллов.\n\n` +
      `Нажми на одну из кнопок ниже, чтобы начать:`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [mainMenuKeyboard()],
    });
  });

  // Главное меню
  bot.action('menu_main', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'IDLE');

    const text =
      `🏠 **Главное меню «ВЕКТОР»**\n\n` +
      `Выбери модуль для работы:`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [mainMenuKeyboard()],
    });
  });

  // заглушка для некликабельной кнопки (например номер страницы "1/3")
  bot.action('noop', async (ctx: Context) => {
    try {
      await ctx.answerOnCallback({ notification: 'Вы на этой странице' });
    } catch {
      // если клиент не ответил - ничего страшного
    }
  });

  // блок навигатора по конкурсам и фильтрам

  bot.action('nav_open', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'NAVIGATOR_DIRECTION');

    const allCount = eventsService.getAllEvents().length;
    const text =
      `🧭 **Модуль «Умный навигатор»**\n\n` +
      `В базе собрано **${allCount} всероссийских мероприятий** 2026/2027 учебного года (РСОШ, Минпросвещения, Сириус, Сферум, IT-куб).\n\n` +
      `🎯 **Как ищем? Выбери удобный фильтр:**`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [navigatorMainMenuKeyboard()],
    });
  });

  // Фильтр по направлениям
  bot.action('nav_filter_dir', async (ctx: Context) => {
    const text =
      `🔍 **Фильтр по направлениям:**\n\n` +
      `Выбери сферу, в которой хочешь участвовать или защищать проект:`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [directionFilterKeyboard()],
    });
  });

  // Фильтр по классам
  bot.action('nav_filter_grade', async (ctx: Context) => {
    const text =
      `🎓 **Фильтр по классам:**\n\n` +
      `Выбери свой класс обучения, чтобы отсеять неподходящие конкурсы:`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [gradeFilterKeyboard()],
    });
  });

  // Фильтр: Только с бонусами к ЕГЭ / БВИ
  bot.action('nav_filter_ege', async (ctx: Context) => {
    const events = eventsService.filterEvents({ bonusOnly: true });
    renderEventsPage(ctx, events, 0, 'nav_ege_page', '🎓 **Мероприятия с бонусами к ЕГЭ / БВИ:**');
  });

  bot.action(/nav_ege_page:(\d+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_ege_page:(\d+)/);
    const page = match ? parseInt(match[1], 10) : 0;
    const events = eventsService.filterEvents({ bonusOnly: true });
    renderEventsPage(ctx, events, page, 'nav_ege_page', '🎓 **Мероприятия с бонусами к ЕГЭ / БВИ:**');
  });

  // Все мероприятия с пагинацией (nav_page:<page>)
  bot.action(/nav_page:(\d+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_page:(\d+)/);
    const page = match ? parseInt(match[1], 10) : 0;
    const events = eventsService.getAllEvents();
    renderEventsPage(ctx, events, page, 'nav_page', `📋 **Все мероприятия базы «ВЕКТОР» (${events.length}):**`);
  });

  // Выбор направления с пагинацией (nav_set_dir:<dir>:<page>)
  bot.action(/nav_set_dir:([^:]+):?(\d+)?/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_set_dir:([^:]+):?(\d+)?/);
    const direction = (match ? match[1] : 'all') as EventDirection;
    const page = match && match[2] ? parseInt(match[2], 10) : 0;

    const events = eventsService.filterEvents({ direction });
    const dirNames: Record<string, string> = {
      it: '💻 IT & Код',
      robotics: '🤖 Робототехника & БАС',
      science: '🔬 Естественные науки',
      engineering: '📐 Инженерия & Физика',
      all: '🏆 Все направления',
    };

    renderEventsPage(
      ctx,
      events,
      page,
      `nav_dir_page:${direction}`,
      `🎯 **Направление: ${dirNames[direction] || 'Все'}** (${events.length} мероприятий):`
    );
  });

  bot.action(/nav_dir_page:([^:]+):(\d+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_dir_page:([^:]+):(\d+)/);
    const direction = (match ? match[1] : 'all') as EventDirection;
    const page = match ? parseInt(match[2], 10) : 0;
    const events = eventsService.filterEvents({ direction });
    renderEventsPage(ctx, events, page, `nav_dir_page:${direction}`);
  });

  // Выбор класса с пагинацией (nav_set_grade:<grade>:<page>)
  bot.action(/nav_set_grade:(\d+):?(\d+)?/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_set_grade:(\d+):?(\d+)?/);
    const grade = match ? parseInt(match[1], 10) : 0;
    const page = match && match[2] ? parseInt(match[2], 10) : 0;

    const events = eventsService.filterEvents({ grade });
    const gradeLabel = grade > 0 ? `${grade} класс` : 'Любой класс';

    renderEventsPage(
      ctx,
      events,
      page,
      `nav_grade_page:${grade}`,
      `🎓 **Фильтр: ${gradeLabel}** (${events.length} мероприятий):`
    );
  });

  bot.action(/nav_grade_page:(\d+):(\d+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/nav_grade_page:(\d+):(\d+)/);
    const grade = match ? parseInt(match[1], 10) : 0;
    const page = match ? parseInt(match[2], 10) : 0;
    const events = eventsService.filterEvents({ grade });
    renderEventsPage(ctx, events, page, `nav_grade_page:${grade}`);
  });

  // Вспомогательная функция вывода страницы с читаемым нумерованным списком в тексте
  async function renderEventsPage(
    ctx: Context,
    events: EventItem[],
    page: number,
    prefix: string,
    headerTitle?: string
  ) {
    const pageSize = 5;
    const totalPages = Math.ceil(events.length / pageSize) || 1;
    const currentPage = Math.min(Math.max(0, page), totalPages - 1);
    const startIdx = currentPage * pageSize;
    const pageItems = events.slice(startIdx, startIdx + pageSize);

    let text = headerTitle ? `${headerTitle}\n\n` : '';
    text += `_Страница ${currentPage + 1} из ${totalPages}_\n\n`;

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const number = startIdx + i + 1;
      text += `**${number}. ${item.title}**\n`;
      text += `• ${item.directionLabel} | ${item.grades.join(', ')} кл.\n`;
      text += `• Срок: _${item.deadline}_\n\n`;
    }

    text += `_Нажмите кнопку с номером нужного конкурса ниже, чтобы открыть подробную карточку 👇_`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [paginatedEventsKeyboard(events, currentPage, pageSize, prefix)],
    });
  }

  // Просмотр карточки конкретного мероприятия (event_view:<id>)
  bot.action(/event_view:(.+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/event_view:(.+)/);
    const eventId = match ? match[1] : '';

    const event = eventsService.getEventById(eventId);
    if (!event) {
      await ctx.reply('⚠️ Мероприятие не найдено или было перемещено.', {
        format: 'markdown',
        attachments: [navigatorMainMenuKeyboard()],
      });
      return;
    }

    const userId = ctx.user?.user_id || 0;
    const isBookmarked = eventsService.isBookmarked(userId, event.id);
    const cardText = eventsService.formatEventCard(event, isBookmarked);

    await ctx.reply(cardText, {
      format: 'markdown',
      attachments: [eventCardKeyboard(event, isBookmarked)],
    });
  });

  // Добавление / удаление из закладок (event_star:<id>)
  bot.action(/event_star:(.+)/, async (ctx: Context) => {
    const match = (ctx.callback?.payload || '').match(/event_star:(.+)/);
    const eventId = match ? match[1] : '';

    const event = eventsService.getEventById(eventId);
    if (!event) return;

    const userId = ctx.user?.user_id || 0;
    const added = eventsService.toggleBookmark(userId, event.id);

    const isBookmarked = eventsService.isBookmarked(userId, event.id);
    const updatedCard = eventsService.formatEventCard(event, isBookmarked);

    const alertText = added
      ? `⭐ «${event.shortTitle}» добавлено в раздел «Мои дедлайны»!`
      : `❌ «${event.shortTitle}» удалено из ваших дедлайнов.`;

    await ctx.reply(`${alertText}\n\n${updatedCard}`, {
      format: 'markdown',
      attachments: [eventCardKeyboard(event, isBookmarked)],
    });
  });

  // Экран «Мои дедлайны»
  bot.action('nav_bookmarks', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const bookmarks = eventsService.getUserBookmarks(userId);

    if (bookmarks.length === 0) {
      const emptyText =
        `⭐ **Раздел «Мои дедлайны»**\n\n` +
        `У тебя пока нет сохраненных мероприятий.\n\n` +
        `Чтобы добавить конкурс в этот список и отслеживать сроки сдачи, открой **🧭 Умный навигатор** и нажми кнопку **«⭐ В мои дедлайны»** в карточке любого конкурса!`;

      await ctx.reply(emptyText, {
        format: 'markdown',
        attachments: [navigatorMainMenuKeyboard()],
      });
      return;
    }

    const text =
      `⭐ **Твой персональный трекер дедлайнов:**\n\n` +
      `Ты отслеживаешь: **${bookmarks.length} мероприятий**.\n\n` +
      `_Выбери конкурс, чтобы проверить оставшееся время до закрытия регистрации:_`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [bookmarksKeyboard(bookmarks)],
    });
  });

  // Синхронизация базы из открытых источников через ИИ-парсер
  bot.action('nav_sync_web', async (ctx: Context) => {
    try {
      if (ctx.callback) {
        await ctx.answerOnCallback({ notification: '🔄 Сканирую публикации...' });
      }
    } catch {
      // Игнорируем, если клиент не поддерживает или таймаут
    }

    await ctx.reply('⏳ **Запуск ИИ-парсера (RSS + Нейросетевой парсер)...**\nСканирую открытые реестры и извлекаю точные дедлайны (до 10-12 секунд)...', {
      format: 'markdown',
    });

    try {
      const res = await eventsService.syncWithWeb();
      const total = eventsService.getAllEvents().length;
      const syncText =
        `✅ **Список олимпиад и хакатонов обновлен!**\n\n` +
        `🌐 Просканировано публикаций: **${res.totalFound}**\n` +
        `📥 Добавлено и обновлено конкурсов: **${res.addedOrUpdated}**\n` +
        `🏆 Всего актуальных мероприятий в навигаторе: **${total}**\n\n` +
        `Все этапы и дедлайны проверены и готовы к работе!`;

      await ctx.reply(syncText, {
        format: 'markdown',
        attachments: [navigatorMainMenuKeyboard()],
      });
    } catch (error: any) {
      await ctx.reply(
        `⚠️ Временная ошибка при обращении к внешнему источнику. Навигатор работает на проверенных записях.`,
        {
          format: 'markdown',
          attachments: [navigatorMainMenuKeyboard()],
        }
      );
    }
  });

  bot.command('sync', async (ctx: Context) => {
    await ctx.reply('⏳ Синхронизирую реестр с открытыми источниками...');
    try {
      const res = await eventsService.syncWithWeb();
      await ctx.reply(`✅ Готово! Добавлено/обновлено: ${res.addedOrUpdated}. Всего в навигаторе: ${eventsService.getAllEvents().length}`);
    } catch (e: any) {
      await ctx.reply(`Ошибка: ${e.message}`);
    }
  });

  // модуль помощи с проектом по правилам ФГОС
  bot.action('copilot_open', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'COPILOT_TOPIC');

    const text =
      `💡 **Модуль «ИИ-Ко-Пилот» (Методический наставник)**\n\n` +
      `С помощью интеллектуального ИИ-наставника я помогу структурировать твою идею по стандартам ФГОС.\n\n` +
      `📌 **Что умеет методист:**\n` +
      `1. **Сформулировать гипотезу** по формуле: «Если [метод], то [результат], потому что [обоснование]»\n` +
      `2. **Определить цель и задачи** исследования\n` +
      `3. **Выделить объект и предмет**\n\n` +
      `👉 Нажми нужную кнопку ниже или **просто напиши мне в чат тему/задумку своего проекта!**`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [copilotMenuKeyboard()],
    });
  });

  bot.action('copilot_hypo', async (ctx: Context) => {
    const text =
      `💡 **Как сформулировать научную гипотезу:**\n\n` +
      `Гипотеза — это предположение, требующее доказательства.\n\n` +
      `📐 **Формула ФГОС:**\n` +
      `_«Если [применить определенное решение или алгоритм], то [получим измеримый результат], так как [физическая/логическая причина]»._\n\n` +
      `💬 **Отправь мне свою тему проекта**, и я разложу её на гипотезу!`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [backToMenuKeyboard()],
    });
  });

  bot.action('copilot_goal', async (ctx: Context) => {
    const text =
      `🎯 **Формулирование цели и задач проекта:**\n\n` +
      `• **Цель** всегда одна! Начинается с инфинитива: _«Разработать...», «Исследовать...», «Создать...»_\n` +
      `• **Задачи** — 4 шага: 1) Анализ источников; 2) Проектирование; 3) Разработка прототипа; 4) Апробация.\n\n` +
      `💬 Напиши свою идею в ответном сообщении, и я разложу её по шагам!`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [backToMenuKeyboard()],
    });
  });

  bot.action('copilot_rules', async (ctx: Context) => {
    const text =
      `📚 **Разбор регламентов конкурсов:**\n\n` +
      `Типовые ошибки, из-за которых снимают баллы:\n` +
      `❌ Нет раздела «Практическая значимость»\n` +
      `❌ Цель дублирует тему проекта\n` +
      `❌ Задачи сформулированы не глаголами\n\n` +
      `Наш методист автоматически исключает эти ошибки при упаковке проекта!`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [backToMenuKeyboard()],
    });
  });

  // симулятор вопросов от жюри перед защитой
  bot.action('rehearsal_open', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'REHEARSAL_ACTIVE');

    const text =
      `🎙️ **Модуль «Репетиция защиты»**\n\n` +
      `Перед выходом к жюри на секции хакатона или конференции отрепетируй ответы на каверзные вопросы.\n\n` +
      `🎯 **Как это работает:**\n` +
      `1. Я задаю реальный вопрос эксперта\n` +
      `2. Ты отвечаешь текстом\n` +
      `3. ИИ-эксперт дает обратную связь и совет, как получить 100 баллов\n\n` +
      `Готов проверить себя? Нажимай кнопку ниже 👇`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [rehearsalMenuKeyboard()],
    });
  });

  bot.action('rehearsal_start', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'REHEARSAL_ACTIVE');
    const session = sessionManager.getSession(userId);
    const draft = session.projectDraft;
    const projectTopic = draft.academicTitle || draft.topic;

    const q1 = projectTopic
      ? `«Вы защищаете проект: «${projectTopic}». В чем заключается научная или прикладная новизна вашей разработки? Чем она принципиально превосходит существующие аналоги?»`
      : `«В чем заключается научная или прикладная новизна вашей разработки? Чем ваше решение принципиально отличается от десятков существующих аналогов в открытом доступе?»`;

    const q2 = `«Какова архитектура вашего решения? За счет каких технологий и компонентов обеспечивается надежность и отказоустойчивость?»`;
    const q3 = `«Как именно вы планируете внедрять и апробировать проект на реальных пользователях, и какими измеримыми метриками будете подтверждать эффективность?»`;

    session.rehearsal = {
      currentQuestionIndex: 0,
      questions: [q1, q2, q3],
      answers: [],
    };

    const text =
      `🎙️ **Симуляция защиты перед жюри (Вопрос 1 из 3):**\n\n` +
      `${q1}\n\n` +
      `✍️ **Напишите ваш ответ прямо в чат**, и эксперт оценит его убедительность!`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [rehearsalActiveKeyboard()],
    });
  });

  bot.action('rehearsal_stop', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.reset(userId);

    await ctx.reply(
      `⏹️ **Репетиция защиты завершена.**\n\nВы можете вернуться к тренировке в любой удобный момент!`,
      {
        format: 'markdown',
        attachments: [rehearsalMenuKeyboard()],
      }
    );
  });

  // работа с проектами и переключение между ними
  bot.action('project_open', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.setStep(userId, 'PROJECT_VIEW');
    const session = sessionManager.getSession(userId);
    const draft = session.projectDraft;
    const userProjects = sessionManager.getUserProjects(userId);

    const hasProject = Boolean(draft.topic || draft.academicTitle);
    const checkedCount = draft.checklist?.length || 0;
    const progressPercent = Math.round((checkedCount / 7) * 100);

    let text =
      `📋 **Модуль «Паспорт проекта & Синхронизация»**\n\n` +
      `Здесь хранится официальный паспорт твоего проекта по стандартам ФГОС.\n\n`;

    if (hasProject) {
      text +=
        `📌 **Активный проект (${userProjects.length > 1 ? `1 из ${userProjects.length}` : '1 проект'}):**\n` +
        `• **Тема:** ${draft.academicTitle || draft.topic}\n` +
        `• **Цель:** ${draft.goal || 'Формулируется'}\n` +
        `• **Готовность к подаче:** **${progressPercent}%** (${checkedCount} из 7 этапов)\n` +
        `• **Статус:** сохранено в вашем профиле ✅\n\n` +
        `Выбери действие ниже 👇`;
    } else {
      text +=
        `ℹ️ У тебя пока нет активного проекта.\n\n` +
        `👉 Нажми кнопку **«💡 Новая тема проекта»** или просто напиши задумку своего проекта прямо в чат!`;
    }

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [projectMenuKeyboard(userProjects.length)],
    });
  });

  // Список всех проектов пользователя
  bot.action('projects_list', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const projects = sessionManager.getUserProjects(userId);
    const session = sessionManager.getSession(userId);

    if (projects.length === 0) {
      await ctx.reply('У вас пока нет проектов. Нажмите «➕ Создать новый», чтобы начать!', {
        attachments: [projectMenuKeyboard(0)],
      });
      return;
    }

    const text =
      `📁 **Мои проекты (${projects.length}):**\n\n` +
      `Вы можете вести несколько проектов параллельно. Нажмите на нужный проект, чтобы сделать его активным:\n\n` +
      projects
        .map((p, idx) => {
          const isActive = p.id === session.activeProjectId;
          const title = p.academicTitle || p.topic || 'Новый проект';
          const checked = p.checklist?.length || 0;
          return `${isActive ? '🟢 **[Активен]**' : '⚪'} **${idx + 1}.** ${title} _(${checked}/7 этапов)_`;
        })
        .join('\n\n');

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [projectsListKeyboard(projects, session.activeProjectId)],
    });
  });

  // Переключение активного проекта
  bot.action(/^project_select:(.+)$/, async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const projId = ctx.match?.[1] || '';

    try {
      if (ctx.callback) {
        await ctx.answerOnCallback({ notification: 'Проект активирован!' });
      }
    } catch {}

    const draft = sessionManager.setActiveProject(userId, projId);
    if (!draft) {
      await ctx.reply('⚠️ Проект не найден.', { attachments: [backToMenuKeyboard()] });
      return;
    }

    const projects = sessionManager.getUserProjects(userId);
    const checked = draft.checklist?.length || 0;
    const percent = Math.round((checked / 7) * 100);

    await ctx.reply(
      `🟢 **Проект успешно активирован!**\n\n` +
      `• **Тема:** ${draft.academicTitle || draft.topic || 'Новый проект'}\n` +
      `• **Цель:** ${draft.goal || 'Формулируется'}\n` +
      `• **Готовность к подаче:** **${percent}%** (${checked} из 7)\n\n` +
      `Все действия (просмотр паспорта, чек-лист, экспорт) теперь работают с этим проектом.`,
      {
        format: 'markdown',
        attachments: [projectMenuKeyboard(projects.length)],
      }
    );
  });

  // Создание нового проекта
  bot.action('project_new', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    sessionManager.createNewProject(userId);
    sessionManager.setStep(userId, 'COPILOT_TOPIC');

    await ctx.reply(
      `➕ **Создание нового проекта**\n\n` +
      `Новый проект добавлен в ваш список и выбран активным!\n\n` +
      `💡 **Напишите в чат идею или тему для этого проекта**, и ИИ-наставник сразу сформирует для неё паспорт по стандартам ФГОС.`,
      {
        format: 'markdown',
        attachments: [copilotMenuKeyboard()],
      }
    );
  });

  // Просмотр полного паспорта проекта
  bot.action('project_view', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);
    const draft = session.projectDraft;
    const userProjects = sessionManager.getUserProjects(userId);

    if (!draft.topic && !draft.academicTitle) {
      await ctx.reply(
        `📋 **Паспорт проекта пуст**\n\n` +
        `У вас пока нет сохранённого проекта. Напишите задумку проекта в чат (например: _«Умная кормушка для птиц на Arduino с камерой»_), и ИИ-методист сформирует паспорт!`,
        { format: 'markdown', attachments: [copilotMenuKeyboard()] }
      );
      return;
    }

    const tasksFormatted = Array.isArray(draft.tasks) && draft.tasks.length > 0
      ? draft.tasks.map((t) => `  ${t}`).join('\n')
      : '  1. Анализ предметной области\n  2. Проектирование архитектуры\n  3. Разработка прототипа\n  4. Апробация и оформление';

    const passportText =
      `📋 **ОФИЦИАЛЬНЫЙ ПАСПОРТ ПРОЕКТА (ФГОС):**\n\n` +
      `📌 **Исходная идея:** ${draft.topic || draft.academicTitle}\n\n` +
      `🎓 **Академическое наименование:**\n${draft.academicTitle || draft.topic}\n\n` +
      `🎯 **Цель исследования:**\n${draft.goal || 'Не указана'}\n\n` +
      `💡 **Научная гипотеза (ФГОС):**\n«${draft.hypothesis || 'Не сформулирована'}»\n\n` +
      `📐 **Объект и предмет:**\n` +
      `• Объект: ${draft.object || 'Предметная область исследования'}\n` +
      `• Предмет: ${draft.subject || 'Методы и средства реализации'}\n\n` +
      `📌 **Задачи проекта (4 этапа):**\n${tasksFormatted}\n\n` +
      (draft.mentorTip ? `🌟 **Совет наставника к защите:**\n${draft.mentorTip}\n\n` : '') +
      `Паспорт сохранён в вашем профиле «ВЕКТОР». Вы можете выгрузить его для наставника в Сферум!`;

    await ctx.reply(passportText, {
      format: 'markdown',
      attachments: [projectMenuKeyboard(userProjects.length)],
    });
  });

  // Экспорт паспорта для наставника в Сферуме
  bot.action('project_export', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);
    const draft = session.projectDraft;
    const userProjects = sessionManager.getUserProjects(userId);

    const topic = draft.academicTitle || draft.topic || 'Разработка сервиса интеллектуальной поддержки школьной проектной деятельности «ВЕКТОР»';
    const goal = draft.goal || 'Создать цифрового ассистента в Сферуме для автоматизации методической подготовки учеников по стандартам ФГОС';
    const hypo = draft.hypothesis || 'Если использовать модульного диалогового агента с каскадом LLM, то время наставника на рутинные проверки сократится на 70%';
    const object = draft.object || 'Процесс методического сопровождения индивидуальных проектов школьников';
    const subject = draft.subject || 'Алгоритмы автоматизированного структурирования целей и гипотез по ФГОС';

    const tasksText = Array.isArray(draft.tasks) && draft.tasks.length > 0
      ? draft.tasks.map((t) => `  ${t}`).join('\n')
      : '  1. Анализ нормативной базы ФГОС и положений Всероссийских конкурсов\n  2. Проектирование архитектуры сервиса на платформе MAX\n  3. Разработка модулей навигации и репетиции защиты\n  4. Опытная эксплуатация и сбор обратной связи наставников';

    const sferumMessage =
      `↗️ **Готовое сообщение для вашего наставника в Сферуме:**\n` +
      `*(Скопируйте блок ниже и отправьте в диалог учителю в Сферум)*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Здравствуйте, [Имя наставника]!\n\n` +
      `Я подготовил черновик паспорта своего проекта по стандартам ФГОС для согласования темы:\n\n` +
      `• **Тема проекта:** ${topic}\n` +
      `• **Цель работы:** ${goal}\n` +
      `• **Научная гипотеза:** ${hypo}\n` +
      `• **Объект исследования:** ${object}\n` +
      `• **Предмет исследования:** ${subject}\n` +
      `• **Задачи проекта:**\n${tasksText}\n\n` +
      `Подскажите, пожалуйста, согласуете ли вы такую формулировку цели и гипотезы или стоит что-то скорректировать?\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.reply(sferumMessage, {
      format: 'markdown',
      attachments: [projectMenuKeyboard(userProjects.length)],
    });
  });

  // чек-лист, считаем процент и рисуем полоску прогресса
  const renderChecklistText = (checkedItems: number[]) => {
    const total = 7;
    const count = checkedItems.length;
    const percent = Math.round((count / total) * 100);
    const filled = Math.round((count / total) * 10);
    const empty = 10 - filled;
    const bar = '▓'.repeat(filled) + '░'.repeat(empty);

    const itemsDesc = [
      { num: 1, text: 'Тема согласована с руководителем в Сферуме' },
      { num: 2, text: 'Сформулирована четкая цель (1 предложение, с инфинитива)' },
      { num: 3, text: 'Гипотеза по формуле: «Если [метод], то [результат], так как [причина]»' },
      { num: 4, text: 'Выделены объект и предмет исследования' },
      { num: 5, text: 'Сформированы 4 задачи по жизненному циклу проекта' },
      { num: 6, text: 'Пройдена репетиция ответов на каверзные вопросы жюри' },
      { num: 7, text: 'Документы и презентация загружены до дедлайна' },
    ];

    let text =
      `✅ **Интерактивный чек-лист готовности к подаче заявки:**\n\n` +
      `📊 **Прогресс готовности:** \`${bar}\` **${percent}%** (${count} из ${total})\n\n` +
      `_Нажимайте на кнопки внизу, чтобы отмечать или снимать выполненные этапы:_\n\n`;

    for (const item of itemsDesc) {
      const isDone = checkedItems.includes(item.num);
      text += `${isDone ? '✅' : '🔲'} **${item.num}.** ${item.text}\n`;
    }

    if (count === total) {
      text += `\n🎉 **Поздравляем! Ваш проект готов на 100% к подаче заявки и победе на конкурсе!**`;
    }

    return text;
  };

  bot.action('project_checklist', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);
    const checklist = session.projectDraft.checklist || [];

    await ctx.reply(renderChecklistText(checklist), {
      format: 'markdown',
      attachments: [checklistKeyboard(checklist)],
    });
  });

  // Переключение пункта чек-листа
  bot.action(/^chk_toggle:(\d+)$/, async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const itemNum = parseInt(ctx.match?.[1] || '0', 10);

    try {
      if (ctx.callback) {
        await ctx.answerOnCallback({ notification: 'Статус обновлен!' });
      }
    } catch {}

    const { checklist } = sessionManager.toggleChecklistItem(userId, itemNum);

    await ctx.reply(renderChecklistText(checklist), {
      format: 'markdown',
      attachments: [checklistKeyboard(checklist)],
    });
  });

  // ==========================================
  // РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ (ИНСТРУКЦИЯ)
  // ==========================================
  bot.action('guide_open', async (ctx: Context) => {
    const guideText =
      `📖 **Руководство пользователя бота «ВЕКТОР»**\n\n` +
      `Здесь описано назначение каждого модуля и пошаговый алгоритм работы от идеи до победы на конкурсе:\n\n` +
      `🧭 **1. Умный навигатор**\n` +
      `• _«По направлениям»_ — IT, Робототехника/БАС, Естественные науки, Инженерия\n` +
      `• _«По классам»_ — подбор мероприятий с 7 по 11 класс\n` +
      `• _«С бонусами к ЕГЭ / БВИ»_ — конкурсы с дипломами 1–3 степени, дающие до 100 баллов или поступление без экзаменов\n` +
      `• _«🔄 Обновить из сети»_ — автоматический парсинг открытых реестров за 10 секунд\n\n` +
      `💡 **2. ИИ-Ко-Пилот (Методист ФГОС)**\n` +
      `• Напишите боту идею проекта любыми словами (даже в одно предложение)\n` +
      `• Нейросетевой модуль декомпозирует её: сформулирует академическое название, цель по SMART, научную гипотезу («Если..., то..., потому что...»), объект/предмет и 4 задачи\n\n` +
      `📋 **3. Паспорт проекта & Мультипроектность**\n` +
      `• _«Паспорт ФГОС»_ — просмотр сформированного паспорта\n` +
      `• _«↗️ Экспорт для Сферума»_ — готовый текст сообщения для наставника в один клик\n` +
      `• _«📁 Мои проекты»_ — ведение нескольких проектов параллельно и переключение между ними\n` +
      `• _«➕ Создать новый»_ — начало работы над новым проектом\n` +
      `• _«✅ Чек-лист готовности»_ — интерактивные кнопки для отслеживания всех 7 этапов готовности с прогресс-баром\n\n` +
      `🎙️ **4. Репетиция защиты**\n` +
      `• Тренажер каверзных вопросов жюри (научная новизна, аналоги, внедрение)\n` +
      `• Экспертный разбор ваших ответов с подсказками, как усилить аргументацию\n\n` +
      `⭐ **5. Мои дедлайны**\n` +
      `• Персональный трекер сохраненных конкурсов с обратным отсчетом оставшихся дней`;

    await ctx.reply(guideText, {
      format: 'markdown',
      attachments: [backToMenuKeyboard()],
    });
  });

  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      `📖 **Справка по командам бота «ВЕКТОР»:**\n\n` +
      `• /start — перезапустить бота и открыть главное меню\n` +
      `• /help — эта справка и описание модулей\n` +
      `• /sync — быстрая синхронизация базы с открытыми источниками\n\n` +
      `Чтобы изучить подробную инструкцию по всем кнопкам, нажмите кнопку ниже:`,
      {
        format: 'markdown',
        attachments: [
          Keyboard.inlineKeyboard([
            [Keyboard.button.callback('📖 Открыть руководство', 'guide_open')],
            [Keyboard.button.callback('🏠 В главное меню', 'menu_main')],
          ]),
        ],
      }
    );
  });

  // О проекте
  bot.action('about_open', async (ctx: Context) => {
    const text =
      `ℹ️ **О проекте «ВЕКТОР»**\n\n` +
      `«ВЕКТОР» — цифровой ассистент школьников и педагогов-наставников центров «IT-куб», «Кванториум» и общеобразовательных школ.\n\n` +
      `▲ **Ключевые преимущества:**\n` +
      `• Бесшовная интеграция со Сферумом в MAX без сторонних сайтов\n` +
      `• Интерактивный методист на базе специализированной языковой модели\n` +
      `• Экономия до 6 часов в неделю для учителя-наставника\n\n` +
      `👥 **Команда:** «ВЕКТОР»\n` +
      `⚙️ **Платформа:** MAX Messenger Bot API`;

    await ctx.reply(text, {
      format: 'markdown',
      attachments: [backToMenuKeyboard()],
    });
  });

  // Входящие сообщения (Интеллектуальная обработка LLM с защитой Guardrails)
  bot.on('message_created', async (ctx: Context) => {
    const text = ctx.message?.body?.text?.trim();
    if (!text) return;
    if (text.startsWith('/')) return;

    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);

    // отсекаем попытки сломать бота или писать не по теме
    const guardrail = guardrailsService.checkQuery(text);
    if (!guardrail.allowed) {
      await ctx.reply(guardrail.redirectMessage || 'Запрос отклонен политикой безопасности.', {
        format: 'markdown',
        attachments: [copilotMenuKeyboard()],
      });
      return;
    }

    // 1. Репетиция защиты (Многошаговый симулятор)
    if (session.step === 'REHEARSAL_ACTIVE') {
      await ctx.reply('🤔 Эксперт жюри оценивает ваш ответ...');

      const idx = session.rehearsal?.currentQuestionIndex || 0;
      const questions = session.rehearsal?.questions || [
        'В чем заключается новизна вашей разработки и отличие от существующих аналогов?',
        'Какова архитектура вашего решения и за счет чего обеспечивается надежность?',
        'Как планируете внедрять проект и оценивать эффект на реальных пользователях?',
      ];
      const currentQuestion = questions[idx] || questions[0];

      const feedback = await llmService.evaluateDefenseStep(currentQuestion, text, idx, questions.length);

      if (!session.rehearsal) {
        session.rehearsal = { currentQuestionIndex: 0, questions, answers: [] };
      }
      session.rehearsal.answers.push({ question: currentQuestion, answer: text, feedback });

      // Если есть следующий вопрос
      if (idx < questions.length - 1) {
        session.rehearsal.currentQuestionIndex = idx + 1;
        const nextQ = questions[idx + 1];

        const replyText =
          `${feedback}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎙️ **Вопрос от жюри №${idx + 2} из ${questions.length}:**\n\n` +
          `${nextQ}\n\n` +
          `✍️ **Напишите ваш ответ прямо в чат:**`;

        await ctx.reply(replyText, {
          format: 'markdown',
          attachments: [rehearsalActiveKeyboard()],
        });
        return;
      }

      // Если это был финальный 3-й вопрос
      sessionManager.reset(userId);

      const finishText =
        `${feedback}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎉 **Репетиция защиты успешно завершена!**\n\n` +
        `Вы ответили на все 3 ключевых вопроса экспертного жюри. Ваши ответы проанализированы — теперь вы готовы к очной защите перед экспертами!`;

      await ctx.reply(finishText, {
        format: 'markdown',
        attachments: [rehearsalFinishKeyboard()],
      });
      return;
    }

    // 2. Семантический поиск по конкурсам
    const lower = text.toLowerCase();
    const isSearchQuery =
      lower.includes('посоветуй') ||
      lower.includes('найди') ||
      lower.includes('хочу конкурс') ||
      lower.includes('ищу конкурс') ||
      lower.includes('какой конкурс') ||
      lower.includes('какой хакатон');

    if (isSearchQuery) {
      await ctx.reply('🔍 ИИ-навигатор подбирает лучшие мероприятия под ваш запрос...');
      const allEvents = eventsService.getAllEvents();
      const aiRecommendation = await llmService.matchEvents(text, allEvents);

      await ctx.reply(`🎯 **Персональная подборка мероприятий:**\n\n${aiRecommendation}`, {
        format: 'markdown',
        attachments: [navigatorMainMenuKeyboard()],
      });
      return;
    }

    // 3. Если пользователь явно запустил создание или редактирование проекта
    if (session.step === 'COPILOT_TOPIC' || session.step.startsWith('COPILOT_')) {
      await processProjectIdea(ctx, text, userId);
      return;
    }

    // 4. Если пользователь написал сообщение в свободном режиме (IDLE)
    session.pendingText = text;

    const idleText =
      `💬 **Вы написали:**\n«${text}»\n\n` +
      `Чтобы я мог помочь вам наилучшим образом, выберите нужное действие:`;

    const idleKeyboard = Keyboard.inlineKeyboard([
      [
        Keyboard.button.callback('💡 Сформировать паспорт проекта', 'action_create_from_pending'),
        Keyboard.button.callback('🔍 Найти конкурсы под эту тему', 'action_search_from_pending'),
      ],
      [
        Keyboard.button.callback('🎙️ Начать репетицию защиты', 'rehearsal_start'),
        Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
      ],
    ]);

    await ctx.reply(idleText, {
      format: 'markdown',
      attachments: [idleKeyboard],
    });
  });

  // Действие: создание проекта из текста, присланного в IDLE
  bot.action('action_create_from_pending', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);
    const ideaText = session.pendingText || 'Новый проект';

    try {
      if (ctx.callback) {
        await ctx.answerOnCallback({ notification: 'Формирую паспорт...' });
      }
    } catch {}

    await processProjectIdea(ctx, ideaText, userId);
  });

  // Действие: поиск конкурсов по тексту, присланному в IDLE
  bot.action('action_search_from_pending', async (ctx: Context) => {
    const userId = ctx.user?.user_id || 0;
    const session = sessionManager.getSession(userId);
    const queryText = session.pendingText || 'IT хакатоны для школьников';

    try {
      if (ctx.callback) {
        await ctx.answerOnCallback({ notification: 'Подбираю конкурсы...' });
      }
    } catch {}

    await ctx.reply('🔍 ИИ-навигатор подбирает лучшие мероприятия под ваш запрос...');
    const allEvents = eventsService.getAllEvents();
    const aiRecommendation = await llmService.matchEvents(queryText, allEvents);

    await ctx.reply(`🎯 **Персональная подборка мероприятий:**\n\n${aiRecommendation}`, {
      format: 'markdown',
      attachments: [navigatorMainMenuKeyboard()],
    });
  });
}

// Вспомогательная функция формирования паспорта проекта по ФГОС
async function processProjectIdea(ctx: Context, ideaText: string, userId: number) {
  await ctx.reply('💡 ИИ-наставник «ВЕКТОР» анализирует вашу идею и готовит структуру по ФГОС...');

  const analysis = await llmService.analyzeProjectIdea(ideaText);

  // Если запрос не является проектом (2-й уровень защиты)
  if (!analysis.isProject) {
    await ctx.reply(
      `💡 **Методический наставник «ВЕКТОР»**\n\n` +
      `⚠️ ${analysis.refusalReason || 'Сообщение не содержит темы учебного или инженерного проекта.'}\n\n` +
      `💡 **Примеры того, что можно прислать:**\n` +
      `• «Чат-бот для подготовки к ОГЭ по физике»\n` +
      `• «Умная система сортировки мусора на базе Computer Vision»\n` +
      `• «Автономный датчик уровня углекислого газа для школьных классов»`,
      {
        format: 'markdown',
        attachments: [copilotMenuKeyboard()],
      }
    );
    return;
  }

  // Сохраняем все структурированные поля
  sessionManager.updateProjectDraft(userId, {
    topic: ideaText,
    academicTitle: analysis.academicTitle,
    goal: analysis.goal,
    hypothesis: analysis.hypothesis,
    object: analysis.object,
    subject: analysis.subject,
    tasks: analysis.tasks,
    mentorTip: analysis.mentorTip,
  });

  sessionManager.setStep(userId, 'IDLE');

  const tasksList = (analysis.tasks || []).map((t) => `• ${t}`).join('\n');

  const fullReply =
    `📋 **Методический паспорт проекта (стандарт ФГОС):**\n\n` +
    `📌 **Исходная идея:** ${ideaText}\n\n` +
    `🎓 **Академическое наименование:**\n${analysis.academicTitle}\n\n` +
    `🎯 **Цель проекта:**\n${analysis.goal}\n\n` +
    `💡 **Научная гипотеза (ФГОС):**\n«${analysis.hypothesis}»\n\n` +
    `📐 **Объект и предмет:**\n` +
    `• Объект: ${analysis.object}\n` +
    `• Предмет: ${analysis.subject}\n\n` +
    `📌 **Задачи исследования (4 шага):**\n${tasksList}\n\n` +
    `🌟 **Совет наставника к защите:**\n${analysis.mentorTip}\n\n` +
    `Паспорт автоматически сохранён в вашем профиле «ВЕКТОР». Вы можете выгрузить черновик для наставника в Сферум или перейти к чек-листу готовности!`;

  await ctx.reply(fullReply, {
    format: 'markdown',
    attachments: [copilotMenuKeyboard()],
  });
}
