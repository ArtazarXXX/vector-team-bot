// читаем настройки из файла
import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  botToken: string;
  botName: string;
  botUrl: string;
  nodeEnv: string;
  llm: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    fallbackModels: string[];
  };
}

// если токен забыли написать в файле - сразу ругаемся и выходим
const botToken = process.env.BOT_TOKEN;
if (!botToken || botToken.trim() === '' || botToken.includes('your_max_bot_token_here')) {
  console.error('❌ ОШИБКА: BOT_TOKEN не задан в .env файле!');
  process.exit(1);
}

// запасные нейросетки если первая долго думает или закончились попытки
const fallbackModelsRaw = process.env.LLM_FALLBACK_MODELS || 'qwen/qwen-2.5-72b-instruct,openai/gpt-4o-mini';

export const config: Config = {
  botToken: botToken.trim(),
  botName: process.env.BOT_NAME || 'ideya_fiks_128_bot',
  botUrl: process.env.BOT_URL || 'https://max.ru/ideya_fiks_128_bot',
  nodeEnv: process.env.NODE_ENV || 'development',
  llm: {
    baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.LLM_API_KEY?.trim() || undefined,
    model: process.env.LLM_MODEL || 'qwen/qwen-2.5-72b-instruct',
    fallbackModels: fallbackModelsRaw.split(',').map((m) => m.trim()).filter(Boolean),
  },
};
