// это для сертификатов, чтоб не ругалось на проверку соединения
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { createBot } from './bot.js';
import { config } from './config.js';
import { initDatabase } from './db/index.js';

async function main() {
  console.log('====================================================');
  console.log(`🤖 Запуск бота «ВЕКТОР» (${config.botName})...`);
  console.log(`🔗 Ссылка: ${config.botUrl}`);
  console.log(`⚙️ Среда: ${config.nodeEnv}`);
  console.log('====================================================');

  // создаем базу при запуске если ее еще нет
  initDatabase();

  const bot = createBot();

  // чтоб при выходе бот нормально отключался
  const shutdown = () => {
    console.log('\n🛑 Остановка бота...');
    try {
      bot.stopPolling();
    } catch {
      // Игнорируем если уже остановлен
    }
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    console.log('📡 Подключение к серверам MAX (Long Polling)...');
    bot.start().catch((err) => {
      console.error('❌ Ошибка long polling цикла:', err);
    });
    console.log('✅ Бот «ВЕКТОР» успешно запущен и слушает входящие сообщения!');
  } catch (error) {
    console.error('❌ Критическая ошибка при инициализации бота:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal in main():', err);
  process.exit(1);
});
