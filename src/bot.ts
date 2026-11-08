import { Bot } from '@maxhub/max-bot-api';
import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // ловим любые ошибки, чтоб бот не падал если кто-то нажмет не то
  bot.catch((err, ctx) => {
    console.error(`💥 Ошибка при обработке события ${ctx?.updateType}:`, err);
  });

  // подключаем все кнопки и команды
  registerHandlers(bot);

  return bot;
}
