import type { VoteName } from './common.js';

export interface TelegramGroup {
  chat_id: string;
  title: string;
  active: boolean;
}

// GET /api/me/telegram
export interface TelegramResponse {
  success: true;
  linked: boolean;
  username: string | null;
  botUsername: string;
  groups: TelegramGroup[];
  // «Что публиковать»: the votes the bot posts
  publish: VoteName[];
}

// PATCH /api/me/telegram
export interface TelegramPublishResponse {
  success: true;
  publish: VoteName[];
}

// POST /api/me/telegram/link
export interface TelegramLinkResponse {
  success: true;
  code: string;
  startUrl: string;
  groupUrl: string;
}

// POST /api/me/telegram/confirm: the group joined through the code, if any
export interface TelegramConfirmResponse {
  success: true;
  group: { chat_id: string; title: string } | null;
}
