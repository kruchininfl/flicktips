import {Bot, Context, GrammyError, InlineKeyboard} from 'grammy';
import {SITE_URL} from './env';
import {botUrl, escapeHtml, userName, welcomeText} from './texts';
import * as store from './store';

type GroupChat = {id: number; title: string};

function isGroup(ctx: Context) {
  return ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
}

function groupOf(ctx: Context): GroupChat {
  const chat = ctx.chat as {id: number; title?: string};
  return {id: chat.id, title: chat.title || ''};
}

function welcomeKeyboard() {
  return new InlineKeyboard().text('Участвовать', 'join').text('Выйти', 'leave');
}

function siteLinkKeyboard(code: string) {
  return new InlineKeyboard().url('Войти на FlickTips', `${SITE_URL}/telegram?code=${code}`);
}

// apiRoot: a self-hosted Bot API server (TELEGRAM_API_ROOT), api.telegram.org by default
export function createBot(token: string, apiRoot?: string) {
  // A request hanging on the relay would stall all updates (they are handled one by one), so give
  // up well before grammY's default of 500 s. Long polling waits 30 s, which stays inside the limit.
  const bot = new Bot(token, {client: {timeoutSeconds: 45, ...(apiRoot ? {apiRoot} : {})}});

  // The welcome message lists who takes part; it is edited in place, or sent again if it is gone.
  async function refreshWelcome(chatId: string) {
    const chat = await store.getChat(chatId);

    if (!chat || !chat.active) {
      return;
    }

    const text = welcomeText(await store.getMemberNames(chatId));

    if (chat.welcome_message_id) {
      try {
        await bot.api.editMessageText(chatId, chat.welcome_message_id, text, {reply_markup: welcomeKeyboard()});
        await store.setWelcome(chatId, chat.welcome_message_id);
        return;
      } catch (e) {
        if (e instanceof GrammyError && e.description.includes('message is not modified')) {
          await store.setWelcome(chatId, chat.welcome_message_id);
          return;
        }
        if (!(e instanceof GrammyError && e.description.includes('message to edit not found'))) {
          throw e;
        }
      }
    }

    const message = await bot.api.sendMessage(chatId, text, {reply_markup: welcomeKeyboard()});
    await store.setWelcome(chatId, message.message_id);
  }

  async function sendWelcome(chatId: string) {
    await store.setWelcome(chatId, null);
    await refreshWelcome(chatId);
  }

  // Joins the sender to the group. Returns false when their Telegram is not linked to FlickTips yet.
  async function joinFromGroup(ctx: Context) {
    const chat = groupOf(ctx);
    const user = await store.findUserByTelegram(ctx.from!.id);

    if (!user) {
      return false;
    }

    await store.saveChat(String(chat.id), chat.title);
    if (await store.joinChat(String(chat.id), user.id)) {
      await refreshWelcome(String(chat.id));
    }

    return true;
  }

  async function leaveFromGroup(ctx: Context) {
    const chatId = String(ctx.chat!.id);
    const user = await store.findUserByTelegram(ctx.from!.id);

    if (user && await store.leaveChat(chatId, user.id)) {
      await refreshWelcome(chatId);
      return true;
    }

    return false;
  }

  // The bot was added to a group, removed from it or lost the right to write there.
  bot.on('my_chat_member', async (ctx) => {
    if (!isGroup(ctx)) {
      return;
    }

    const chat = groupOf(ctx);
    const member = ctx.myChatMember.new_chat_member;
    const wasIn = ['member', 'administrator', 'creator', 'restricted'].includes(ctx.myChatMember.old_chat_member.status);
    const isIn = ['member', 'administrator', 'creator'].includes(member.status) ||
      (member.status === 'restricted' && member.is_member && member.can_send_messages);

    if (isIn) {
      // also covers a join the bot missed while offline: the update then looks like a status change
      const known = await store.getChat(String(chat.id));

      await store.saveChat(String(chat.id), chat.title);
      if (!wasIn || !known || !known.active || !known.welcome_message_id) {
        await sendWelcome(String(chat.id));
      }
    } else {
      await store.deactivateChat(String(chat.id));
    }
  });

  // Private chat: /start <site code> links the account, /start join_<chat id> comes from «Участвовать»
  // in a group by someone who is not linked yet.
  bot.chatType('private').command('start', async (ctx) => {
    const payload = ctx.match.trim();

    if (store.isSiteCode(payload)) {
      const user = await store.useSiteCode(payload, ctx.from);

      if (!user) {
        await ctx.reply('Ссылка устарела. Нажмите кнопку в профиле на flicktips.ru ещё раз.');
        return;
      }

      await ctx.reply(
        `Готово, ваш Telegram привязан к FlickTips (${userName(user)}).\n\n` +
        'Теперь добавьте меня в группу, и я буду публиковать там ваши оценки.',
        {parse_mode: 'HTML', reply_markup: new InlineKeyboard().url('Добавить в группу', botUrl('add', true))}
      );
      return;
    }

    const joinChatId = /^join_(-?\d+)$/.exec(payload)?.[1] || null;
    const user = await store.findUserByTelegram(ctx.from.id);

    if (user && joinChatId) {
      const chat = await store.getChat(joinChatId);

      if (chat && chat.active) {
        if (await store.joinChat(joinChatId, user.id)) {
          await refreshWelcome(joinChatId);
        }
        await ctx.reply(`Готово, ваши оценки будут появляться в группе «${escapeHtml(chat.title)}».`,
          {parse_mode: 'HTML'});
        return;
      }
    }

    if (user) {
      await ctx.reply(
        `Ваш Telegram привязан к FlickTips (${userName(user)}). Добавьте меня в группу, ` +
        'и я буду публиковать там ваши оценки фильмов.',
        {parse_mode: 'HTML', reply_markup: new InlineKeyboard().url('Добавить в группу', botUrl('add', true))}
      );
      return;
    }

    const code = await store.createTelegramCode(ctx.from, joinChatId);
    await ctx.reply(
      'Я публикую оценки фильмов с FlickTips в группы Telegram. ' +
      'Войдите на сайте, чтобы привязать к нему этот Telegram' +
      (joinChatId ? ', и я сразу добавлю вас в группу.' : '.') +
      '\n\nСсылка действует 15 минут.',
      {reply_markup: siteLinkKeyboard(code)}
    );
  });

  // Group: /start <site code> arrives right after the bot is added from the profile (startgroup link).
  bot.chatType(['group', 'supergroup']).command('start', async (ctx) => {
    const chat = groupOf(ctx);
    const payload = ctx.match.trim();

    await store.saveChat(String(chat.id), chat.title);

    if (store.isSiteCode(payload)) {
      await store.useSiteCode(payload, ctx.from);
    }

    if (!await joinFromGroup(ctx)) {
      await refreshWelcome(String(chat.id));
    }
  });

  bot.chatType(['group', 'supergroup']).command('join', async (ctx) => {
    if (await joinFromGroup(ctx)) {
      return;
    }

    await ctx.reply('Сначала привяжите FlickTips к Telegram, это займёт минуту.', {
      reply_markup: new InlineKeyboard().url('Привязать', botUrl('join_' + ctx.chat.id))
    });
  });

  bot.chatType(['group', 'supergroup']).command('leave', async (ctx) => {
    await leaveFromGroup(ctx);
  });

  bot.callbackQuery('join', async (ctx) => {
    if (!isGroup(ctx)) {
      await ctx.answerCallbackQuery();
      return;
    }

    if (await joinFromGroup(ctx)) {
      await ctx.answerCallbackQuery({text: 'Готово, ваши оценки будут появляться здесь.'});
      return;
    }

    // a t.me link with a start parameter opens the private chat with the bot
    await ctx.answerCallbackQuery({url: botUrl('join_' + ctx.chat!.id)});
  });

  bot.callbackQuery('leave', async (ctx) => {
    const left = isGroup(ctx) && await leaveFromGroup(ctx);
    await ctx.answerCallbackQuery({text: left ? 'Ваши оценки больше не будут появляться здесь.' : 'Вы и так не участвуете.'});
  });

  bot.on('message:left_chat_member', async (ctx) => {
    const user = await store.findUserByTelegram(ctx.message.left_chat_member.id);

    if (user && await store.leaveChat(String(ctx.chat.id), user.id)) {
      await refreshWelcome(String(ctx.chat.id));
    }
  });

  bot.on('message:new_chat_title', async (ctx) => {
    await store.saveChat(String(ctx.chat.id), ctx.message.new_chat_title);
  });

  bot.on('message:migrate_to_chat_id', async (ctx) => {
    await store.migrateChat(String(ctx.chat.id), String(ctx.message.migrate_to_chat_id));
  });

  bot.catch((err) => {
    console.error('Update failed:', err.error);
  });

  return {bot, refreshWelcome};
}
