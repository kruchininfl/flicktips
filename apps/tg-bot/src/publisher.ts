import type { Api } from 'grammy';
import { GrammyError, InlineKeyboard } from 'grammy';
import { exec, select, selectOne } from './db.js';
import type { Movie, User } from './texts.js';
import { changedText, movieUrl, posterUrl, postText } from './texts.js';
import * as store from './store.js';

// A rating is published once it has not changed for this long, so quick re-clicks make one post.
const SETTLE_SECONDS = 60;
const BATCH = 100;
const MAX_ATTEMPTS = 5;
// Telegram allows about 20 messages a minute in a group and 30 a second per bot
const CHAT_LIMIT_PER_MINUTE = 18;
const CALL_SPACING_MS = 50;

// Not published now, try again next tick (rate limit); does not count as a failed attempt.
class Deferred extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createPublisher(api: Api, refreshWelcome: (chatId: string) => Promise<void>) {
  const sentAt = new Map<string, number[]>();
  let pausedUntil = 0;

  function canSend(chatId: string) {
    const now = Date.now();
    const recent = (sentAt.get(chatId) || []).filter((t) => now - t < 60000);
    sentAt.set(chatId, recent);
    return now >= pausedUntil && recent.length < CHAT_LIMIT_PER_MINUTE;
  }

  // every Telegram call that posts or edits goes through here
  async function call<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
    if (!canSend(chatId)) {
      throw new Deferred();
    }
    sentAt.get(chatId)!.push(Date.now());
    await sleep(CALL_SPACING_MS);

    try {
      return await fn();
    } catch (e) {
      if (e instanceof GrammyError && e.error_code === 429) {
        pausedUntil = Date.now() + (e.parameters.retry_after || 5) * 1000;
        throw new Deferred();
      }
      throw e;
    }
  }

  function isChatGone(e: unknown) {
    return (
      e instanceof GrammyError &&
      (e.error_code === 403 || /chat not found|bot was kicked|not enough rights/i.test(e.description))
    );
  }

  // «Участвовать» is handled by the same 'join' callback as on the welcome message
  function postKeyboard(movie: Movie) {
    return new InlineKeyboard().url('Открыть на FlickTips', movieUrl(movie)).text('Участвовать', 'join');
  }

  async function sendPost(chatId: string, user: User, movie: Movie, vote: number) {
    const text = postText(user, movie, vote);
    const keyboard = postKeyboard(movie);
    const cached = await selectOne<{ file_id: string }>('SELECT file_id FROM tg_poster WHERE movie_id = ?', [movie.id]);
    const photo = cached?.file_id || posterUrl(movie);

    if (photo) {
      try {
        const message = await call(chatId, () =>
          api.sendPhoto(chatId, photo, { caption: text, parse_mode: 'HTML', reply_markup: keyboard }),
        );

        const largest = message.photo?.at(-1);

        if (!cached && largest) {
          await exec('INSERT IGNORE INTO tg_poster (movie_id, file_id) VALUES (?, ?)', [movie.id, largest.file_id]);
        }

        return message.message_id;
      } catch (e) {
        // Telegram could not fetch the poster: post without it
        if (!(e instanceof GrammyError && e.error_code === 400)) {
          throw e;
        }
        if (cached) {
          await exec('DELETE FROM tg_poster WHERE movie_id = ?', [movie.id]);
        }
      }
    }

    const message = await call(chatId, () =>
      api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }),
    );

    return message.message_id;
  }

  // false when the post is gone (deleted by someone) and has to be sent again
  async function editPost(chatId: string, messageId: number, user: User, movie: Movie, vote: number) {
    const text = postText(user, movie, vote);
    const keyboard = postKeyboard(movie);
    const attempts = [
      () => api.editMessageCaption(chatId, messageId, { caption: text, parse_mode: 'HTML', reply_markup: keyboard }),
      // posts without a poster are plain text
      () =>
        api.editMessageText(chatId, messageId, text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        }),
    ];

    for (const attempt of attempts) {
      try {
        await call(chatId, attempt);
        return true;
      } catch (e) {
        if (!(e instanceof GrammyError)) {
          throw e;
        }
        if (e.description.includes('message is not modified')) {
          return true;
        }
        if (/message to edit not found|message can't be edited/i.test(e.description)) {
          return false;
        }
        if (!/no caption|no text/i.test(e.description)) {
          throw e;
        }
      }
    }

    return false;
  }

  async function publishToChat(chatId: string, user: User, movie: Movie, vote: number) {
    const post = await selectOne<{ message_id: number; vote: number }>(
      'SELECT message_id, vote FROM tg_post WHERE user_id = ? AND movie_id = ? AND chat_id = ?',
      [user.id, movie.id, chatId],
    );

    if (!post) {
      const messageId = await sendPost(chatId, user, movie, vote);
      await exec('INSERT INTO tg_post (user_id, movie_id, chat_id, message_id, vote) VALUES (?, ?, ?, ?, ?)', [
        user.id,
        movie.id,
        chatId,
        messageId,
        vote,
      ]);
      return;
    }

    if (Number(post.vote) === vote) {
      return;
    }

    if (await editPost(chatId, post.message_id, user, movie, vote)) {
      // the edit alone is easy to miss in a busy group, so the bot also answers the post
      await call(chatId, () =>
        api.sendMessage(chatId, changedText(user, vote), {
          reply_parameters: { message_id: post.message_id, allow_sending_without_reply: true },
        }),
      );
      await exec('UPDATE tg_post SET vote = ? WHERE user_id = ? AND movie_id = ? AND chat_id = ?', [
        vote,
        user.id,
        movie.id,
        chatId,
      ]);
      return;
    }

    const messageId = await sendPost(chatId, user, movie, vote);
    await exec('UPDATE tg_post SET message_id = ?, vote = ? WHERE user_id = ? AND movie_id = ? AND chat_id = ?', [
      messageId,
      vote,
      user.id,
      movie.id,
      chatId,
    ]);
  }

  // Once a day per member: did they leave the group while the bot was not looking?
  async function stillMember(chatId: string, user: User) {
    if (!user.tg_user_id) {
      return false;
    }

    try {
      const member = await api.getChatMember(chatId, Number(user.tg_user_id));
      const isIn =
        ['member', 'administrator', 'creator'].includes(member.status) ||
        (member.status === 'restricted' && member.is_member);

      if (!isIn) {
        await store.leaveChat(chatId, user.id);
        return false;
      }
    } catch (e) {
      if (isChatGone(e)) {
        throw e;
      }
      // not sure, keep publishing and check again next time
      return true;
    }

    await exec('UPDATE tg_chat_member SET checked_at = NOW() WHERE chat_id = ? AND user_id = ?', [chatId, user.id]);
    return true;
  }

  async function markProcessed(userId: number, movieId: number, lastId: string) {
    await exec(
      'UPDATE vote_event SET processed_at = NOW() WHERE user_id = ? AND movie_id = ? AND id <= ? AND processed_at IS NULL',
      [userId, movieId, lastId],
    );
  }

  async function processPair(pair: {
    user_id: number;
    movie_id: number;
    last_id: string;
    last_at: string;
    stale: number;
  }) {
    // events that waited more than a day (the bot was down) are not news any more
    if (Number(pair.stale)) {
      return 'done';
    }

    // the current rating is the source of truth, events only say "something changed"
    const current = await selectOne<{ vote: number }>(
      'SELECT vote FROM movie_vote WHERE user_id = ? AND movie_id = ?',
      [pair.user_id, pair.movie_id],
    );
    const user = await store.findUser(pair.user_id);
    const movie = await selectOne<Movie>(
      `SELECT id, title, original_title, release_date, first_air_date,
      tmdb_poster_path, kp_id FROM movie WHERE id = ?`,
      [pair.movie_id],
    );

    // a removed rating leaves its posts as they are
    if (!current || !user || !movie) {
      return 'done';
    }

    // only ratings made after joining the group
    const chats = await select<{ chat_id: string; needs_check: number }>(
      `SELECT tg_chat_member.chat_id,
      (tg_chat_member.checked_at IS NULL OR tg_chat_member.checked_at < NOW() - INTERVAL 1 DAY) AS needs_check
      FROM tg_chat_member
      INNER JOIN tg_chat ON tg_chat.chat_id = tg_chat_member.chat_id AND tg_chat.active = 1
      WHERE tg_chat_member.user_id = ? AND tg_chat_member.joined_at <= ?`,
      [pair.user_id, pair.last_at],
    );

    let result: 'done' | 'deferred' | 'failed' = 'done';

    for (const chat of chats) {
      try {
        if (Number(chat.needs_check) && !(await stillMember(chat.chat_id, user))) {
          continue;
        }
        await publishToChat(chat.chat_id, user, movie, Number(current.vote));
      } catch (e) {
        if (e instanceof Deferred) {
          result = result === 'failed' ? 'failed' : 'deferred';
        } else if (isChatGone(e)) {
          console.warn(`Chat ${chat.chat_id} is gone, disabling it:`, (e as GrammyError).description);
          await store.deactivateChat(chat.chat_id);
        } else {
          console.error(`Publishing user ${user.id} movie ${movie.id} to ${chat.chat_id} failed:`, e);
          result = 'failed';
        }
      }
    }

    return result;
  }

  async function tick() {
    for (const chatId of await store.getDirtyWelcomes()) {
      await refreshWelcomeSafe(chatId);
    }

    const pairs = await select<{
      user_id: number;
      movie_id: number;
      last_id: string;
      last_at: string;
      attempts: number;
      stale: number;
    }>(`SELECT user_id, movie_id, MAX(id) AS last_id, MAX(created_at) AS last_at,
      MAX(attempts) AS attempts, MAX(created_at) < NOW() - INTERVAL 1 DAY AS stale
      FROM vote_event WHERE processed_at IS NULL
      GROUP BY user_id, movie_id
      HAVING MAX(created_at) < NOW() - INTERVAL ${SETTLE_SECONDS} SECOND
      ORDER BY last_id LIMIT ${BATCH}`);

    for (const pair of pairs) {
      const result = await processPair(pair);

      if (result === 'done' || (result === 'failed' && Number(pair.attempts) + 1 >= MAX_ATTEMPTS)) {
        await markProcessed(pair.user_id, pair.movie_id, pair.last_id);
      } else if (result === 'failed') {
        await exec(
          'UPDATE vote_event SET attempts = attempts + 1 WHERE user_id = ? AND movie_id = ? AND processed_at IS NULL',
          [pair.user_id, pair.movie_id],
        );
      }
    }
  }

  async function refreshWelcomeSafe(chatId: string) {
    try {
      await refreshWelcome(chatId);
    } catch (e) {
      if (isChatGone(e)) {
        await store.deactivateChat(chatId);
      } else {
        console.error(`Welcome in ${chatId} failed:`, e);
        // do not retry it every tick
        await store.setWelcome(chatId, (await store.getChat(chatId))?.welcome_message_id || null);
      }
    }
  }

  return { tick };
}
