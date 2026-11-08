import { Keyboard } from '@maxhub/max-bot-api';
import { EventItem } from '../types/events.js';
import { ProjectDraft } from '../types/index.js';

export const mainMenuKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('🧭 Умный навигатор', 'nav_open'),
      Keyboard.button.callback('💡 ИИ-Ко-Пилот', 'copilot_open'),
    ],
    [
      Keyboard.button.callback('🎙️ Репетиция защиты', 'rehearsal_open'),
      Keyboard.button.callback('📋 Паспорт проекта', 'project_open'),
    ],
    [
      Keyboard.button.callback('⭐ Мои дедлайны', 'nav_bookmarks'),
      Keyboard.button.callback('📖 Инструкция', 'guide_open'),
    ],
    [
      Keyboard.button.callback('ℹ️ О проекте «ВЕКТОР»', 'about_open'),
    ],
  ]);
};

export const backToMenuKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const navigatorMainMenuKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('💻 По направлениям', 'nav_filter_dir'),
      Keyboard.button.callback('🎓 По классам', 'nav_filter_grade'),
    ],
    [
      Keyboard.button.callback('🎯 С бонусами к ЕГЭ / БВИ', 'nav_filter_ege'),
      Keyboard.button.callback('📋 Все мероприятия', 'nav_page:0'),
    ],
    [
      Keyboard.button.callback('⭐ Мои дедлайны', 'nav_bookmarks'),
      Keyboard.button.callback('🔄 Обновить из сети', 'nav_sync_web'),
    ],
    [
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const gradeFilterKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('7–8 класс', 'nav_set_grade:7:0'),
      Keyboard.button.callback('9 класс', 'nav_set_grade:9:0'),
    ],
    [
      Keyboard.button.callback('10 класс', 'nav_set_grade:10:0'),
      Keyboard.button.callback('11 класс', 'nav_set_grade:11:0'),
    ],
    [
      Keyboard.button.callback('🌐 Любой класс', 'nav_page:0'),
      Keyboard.button.callback('⬅️ Назад', 'nav_open'),
    ],
  ]);
};

export const directionFilterKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('💻 IT & Код', 'nav_set_dir:it:0'),
      Keyboard.button.callback('🤖 Робототехника & БАС', 'nav_set_dir:robotics:0'),
    ],
    [
      Keyboard.button.callback('🔬 Естественные науки', 'nav_set_dir:science:0'),
      Keyboard.button.callback('📐 Инженерия & Физика', 'nav_set_dir:engineering:0'),
    ],
    [
      Keyboard.button.callback('🏆 Любое направление', 'nav_page:0'),
      Keyboard.button.callback('⬅️ Назад', 'nav_open'),
    ],
  ]);
};

// Постраничная клавиатура списка мероприятий
export const paginatedEventsKeyboard = (
  events: EventItem[],
  page = 0,
  pageSize = 5,
  prefix = 'nav_page'
) => {
  const totalPages = Math.ceil(events.length / pageSize) || 1;
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);
  const startIdx = currentPage * pageSize;
  const pageEvents = events.slice(startIdx, startIdx + pageSize);

  const buttons: any[] = [];

  for (let i = 0; i < pageEvents.length; i++) {
    const e = pageEvents[i];
    const itemNumber = startIdx + i + 1;
    const cleanShort = e.shortTitle.length > 25 ? e.shortTitle.substring(0, 23) + '..' : e.shortTitle;
    buttons.push([
      Keyboard.button.callback(`${itemNumber}. ${cleanShort}`, `event_view:${e.id}`),
    ]);
  }

  const paginationRow: any[] = [];
  if (currentPage > 0) {
    paginationRow.push(Keyboard.button.callback('⬅️ Назад', `${prefix}:${currentPage - 1}`));
  }

  paginationRow.push(Keyboard.button.callback(`📄 ${currentPage + 1}/${totalPages}`, 'noop'));

  if (currentPage < totalPages - 1) {
    paginationRow.push(Keyboard.button.callback('Вперед ➡️', `${prefix}:${currentPage + 1}`));
  }

  buttons.push(paginationRow);

  buttons.push([
    Keyboard.button.callback('🔍 Изменить фильтр', 'nav_open'),
    Keyboard.button.callback('🏠 Главное меню', 'menu_main'),
  ]);

  return Keyboard.inlineKeyboard(buttons);
};

// Карточка конкретного мероприятия с кнопкой «Назад к списку»
export const eventCardKeyboard = (event: EventItem, isBookmarked: boolean) => {
  const starText = isBookmarked ? '❌ Убрать из дедлайнов' : '⭐ В мои дедлайны';

  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback(starText, `event_star:${event.id}`),
      Keyboard.button.link('🔗 Официальный сайт', event.url),
    ],
    [
      Keyboard.button.callback('⬅️ К списку мероприятий', 'nav_page:0'),
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

// Закладки пользователя
export const bookmarksKeyboard = (bookmarks: EventItem[]) => {
  const buttons: any[] = [];

  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i];
    const cleanShort = b.shortTitle.length > 25 ? b.shortTitle.substring(0, 23) + '..' : b.shortTitle;
    buttons.push([
      Keyboard.button.callback(`⭐ ${cleanShort}`, `event_view:${b.id}`),
    ]);
  }

  buttons.push([
    Keyboard.button.callback('🧭 В навигатор', 'nav_open'),
    Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
  ]);

  return Keyboard.inlineKeyboard(buttons);
};

export const copilotMenuKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('📋 Мой паспорт проекта', 'project_open'),
      Keyboard.button.callback('↗️ Экспорт для Сферума', 'project_export'),
    ],
    [
      Keyboard.button.callback('🎙️ Отрепетировать защиту', 'rehearsal_start'),
      Keyboard.button.callback('✅ Чек-лист к подаче', 'project_checklist'),
    ],
    [
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const rehearsalMenuKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('🎙️ Начать симуляцию (3 вопроса)', 'rehearsal_start'),
    ],
    [
      Keyboard.button.callback('📋 Мой паспорт проекта', 'project_open'),
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const rehearsalActiveKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('⏹️ Завершить репетицию', 'rehearsal_stop'),
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const rehearsalFinishKeyboard = () => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('🎙️ Пройти репетицию заново', 'rehearsal_start'),
      Keyboard.button.callback('📋 Мой паспорт проекта', 'project_open'),
    ],
    [
      Keyboard.button.callback('✅ Чек-лист готовности', 'project_checklist'),
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

export const projectMenuKeyboard = (projectCount = 1) => {
  return Keyboard.inlineKeyboard([
    [
      Keyboard.button.callback('📋 Паспорт ФГОС', 'project_view'),
      Keyboard.button.callback('↗️ Экспорт для Сферума', 'project_export'),
    ],
    [
      Keyboard.button.callback('✅ Чек-лист готовности', 'project_checklist'),
      Keyboard.button.callback('🎙️ Репетиция защиты', 'rehearsal_start'),
    ],
    [
      Keyboard.button.callback(`📁 Мои проекты (${projectCount})`, 'projects_list'),
      Keyboard.button.callback('➕ Создать новый', 'project_new'),
    ],
    [
      Keyboard.button.callback('💡 Изменить тему', 'copilot_open'),
      Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
    ],
  ]);
};

// список проектов, активный помечаем зеленым кружком 🟢
export const projectsListKeyboard = (projects: ProjectDraft[], activeId?: string) => {
  const rows: any[] = [];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const isActive = p.id === activeId;
    const title = p.academicTitle || p.topic || 'Без названия';
    const shortTitle = title.length > 22 ? title.substring(0, 20) + '..' : title;
    const label = `${isActive ? '🟢' : '⚪'} ${i + 1}. ${shortTitle}`;

    rows.push([Keyboard.button.callback(label, `project_select:${p.id}`)]);
  }

  rows.push([
    Keyboard.button.callback('➕ Создать новый проект', 'project_new'),
  ]);

  rows.push([
    Keyboard.button.callback('⬅️ К активному проекту', 'project_open'),
    Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
  ]);

  return Keyboard.inlineKeyboard(rows);
};

// чек-лист, при нажатии на кнопку ставится галочка
export const checklistKeyboard = (checkedItems: number[] = []) => {
  const items = [
    { num: 1, label: '1. Тема согласована' },
    { num: 2, label: '2. Цель по SMART' },
    { num: 3, label: '3. Гипотеза готова' },
    { num: 4, label: '4. Объект и предмет' },
    { num: 5, label: '5. 4 задачи ФГОС' },
    { num: 6, label: '6. Вопросы жюри' },
    { num: 7, label: '7. Заявка в срок' },
  ];

  const rows: any[] = [];

  // делаем по 2 кнопки в ряд чтоб на телефоне влезало красиво
  for (let i = 0; i < items.length; i += 2) {
    const row: any[] = [];
    const item1 = items[i];
    const isChecked1 = checkedItems.includes(item1.num);
    row.push(Keyboard.button.callback(`${isChecked1 ? '✅' : '🔲'} ${item1.label}`, `chk_toggle:${item1.num}`));

    if (i + 1 < items.length) {
      const item2 = items[i + 1];
      const isChecked2 = checkedItems.includes(item2.num);
      row.push(Keyboard.button.callback(`${isChecked2 ? '✅' : '🔲'} ${item2.label}`, `chk_toggle:${item2.num}`));
    }
    rows.push(row);
  }

  rows.push([
    Keyboard.button.callback('⬅️ К паспорту проекта', 'project_open'),
    Keyboard.button.callback('🏠 В главное меню', 'menu_main'),
  ]);

  return Keyboard.inlineKeyboard(rows);
};

