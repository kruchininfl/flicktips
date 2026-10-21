// @FlickTipsBot: posts the movie ratings of FlickTips users to the Telegram groups they joined.
// Updates come by long polling, so the service needs no open ports. The API queues rating changes
// in vote_event (see api/migrations/2026-10-21-telegram.sql); the loop below publishes them.
import {closeDb} from './db';
import {createBot} from './bot';
import {createPublisher} from './publisher';
import {cleanup} from './store';

const TICK_MS = 10 * 1000;
const CLEANUP_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    // optional in .env.example: without a token the service idles instead of restarting in a loop
    console.warn('TELEGRAM_BOT_TOKEN is not set, the bot is disabled');
    setInterval(() => undefined, 1 << 30);
    return;
  }

  const {bot, refreshWelcome} = createBot(token, process.env.TELEGRAM_API_ROOT);
  const publisher = createPublisher(bot.api, refreshWelcome);
  let running = true;

  const stop = async () => {
    running = false;
    await bot.stop();
    await closeDb();
    process.exit(0);
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  await bot.api.setMyCommands([
    {command: 'join', description: 'Публиковать здесь мои оценки'},
    {command: 'leave', description: 'Больше не публиковать мои оценки'}
  ], {scope: {type: 'all_group_chats'}}).catch((e) => console.error('setMyCommands failed:', e));

  bot.start({
    allowed_updates: ['message', 'callback_query', 'my_chat_member'],
    onStart: (me) => console.log(`Bot @${me.username} started`)
  }).catch((e) => {
    console.error('Polling stopped:', e);
    process.exit(1);
  });

  let lastCleanup = 0;

  while (running) {
    try {
      if (Date.now() - lastCleanup > CLEANUP_MS) {
        await cleanup();
        lastCleanup = Date.now();
      }
      await publisher.tick();
    } catch (e) {
      console.error('Tick failed:', e);
    }
    await sleep(TICK_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
