<?php

namespace Repositories;

use Silex\Application;

/**
 * Data of the Telegram bot (tg-bot service): linked Telegram accounts, groups and the queue of rating
 * changes the bot publishes. Tables: api/migrations/2026-10-21-telegram.sql.
 */
class TelegramRepository {
    const LINK_CODE_TTL = 900;

    protected $app;

    /**
     * @var $pdo \PDO
     */
    protected $pdo;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->pdo = $app['pdo'];
    }

    public function getAccount($uid)
    {
        $sth = $this->pdo->prepare('SELECT tg_user_id, tg_username FROM user WHERE id = :uid');
        $sth->execute(['uid' => (int) $uid]);

        return $sth->fetch();
    }

    /**
     * Groups whose posts include this user's ratings. Chat ids stay strings: they do not fit a JS number.
     */
    public function getGroups($uid)
    {
        $sth = $this->pdo->prepare('SELECT tg_chat.chat_id, tg_chat.title, tg_chat.active
        FROM tg_chat_member
        INNER JOIN tg_chat ON tg_chat.chat_id = tg_chat_member.chat_id
        WHERE tg_chat_member.user_id = :uid
        ORDER BY tg_chat_member.joined_at DESC');
        $sth->execute(['uid' => (int) $uid]);
        $groups = $sth->fetchAll();

        foreach ($groups as &$group) {
            $group['chat_id'] = (string) $group['chat_id'];
            $group['active'] = (bool) $group['active'];
        }

        return $groups;
    }

    public function createLinkCode($uid)
    {
        $code = bin2hex(random_bytes(8));
        $sth = $this->pdo->prepare('INSERT INTO tg_link_code (code, user_id, expires_at)
        VALUES (:code, :uid, DATE_ADD(NOW(), INTERVAL ' . self::LINK_CODE_TTL . ' SECOND))');
        $sth->execute(['code' => $code, 'uid' => (int) $uid]);

        return $code;
    }

    /**
     * A code the bot made for someone who came from a group: links their Telegram account to $uid and
     * joins them to that group. Returns the group (or true without one), false for an unknown or expired code.
     */
    public function confirmLinkCode($uid, $code)
    {
        $sth = $this->pdo->prepare('SELECT * FROM tg_link_code
        WHERE code = :code AND tg_user_id IS NOT NULL AND expires_at > NOW()');
        $sth->execute(['code' => (string) $code]);
        $link = $sth->fetch();

        if (!$link) {
            return false;
        }

        $this->pdo->beginTransaction();
        try {
            // a Telegram account belongs to one FlickTips user: the newest link wins
            $this->pdo->prepare('UPDATE user SET tg_user_id = NULL, tg_username = NULL WHERE tg_user_id = :tg AND id <> :uid')
                ->execute(['tg' => $link['tg_user_id'], 'uid' => (int) $uid]);
            $this->pdo->prepare('UPDATE user SET tg_user_id = :tg, tg_username = :name WHERE id = :uid')
                ->execute(['tg' => $link['tg_user_id'], 'name' => $link['tg_username'], 'uid' => (int) $uid]);
            $this->pdo->prepare('DELETE FROM tg_link_code WHERE code = :code')->execute(['code' => $link['code']]);
            $this->pdo->commit();
        } catch (\Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        if (!$link['chat_id']) {
            return true;
        }

        $sth = $this->pdo->prepare('SELECT chat_id, title FROM tg_chat WHERE chat_id = :chat AND active = 1');
        $sth->execute(['chat' => $link['chat_id']]);
        $group = $sth->fetch();

        if (!$group) {
            return true;
        }

        $this->joinGroup($uid, $group['chat_id']);
        $group['chat_id'] = (string) $group['chat_id'];

        return $group;
    }

    public function joinGroup($uid, $chatId)
    {
        $this->pdo->prepare('INSERT IGNORE INTO tg_chat_member (chat_id, user_id, checked_at) VALUES (:chat, :uid, NOW())')
            ->execute(['chat' => $chatId, 'uid' => (int) $uid]);
        $this->markWelcomeDirty([$chatId]);
    }

    public function leaveGroup($uid, $chatId)
    {
        $this->pdo->prepare('DELETE FROM tg_chat_member WHERE chat_id = :chat AND user_id = :uid')
            ->execute(['chat' => $chatId, 'uid' => (int) $uid]);
        $this->markWelcomeDirty([$chatId]);
    }

    /**
     * Forgets the Telegram account and leaves every group.
     */
    public function unlink($uid)
    {
        $chatIds = array_map(function ($group) { return $group['chat_id']; }, $this->getGroups($uid));

        $this->pdo->prepare('DELETE FROM tg_chat_member WHERE user_id = :uid')->execute(['uid' => (int) $uid]);
        $this->pdo->prepare('UPDATE user SET tg_user_id = NULL, tg_username = NULL WHERE id = :uid')
            ->execute(['uid' => (int) $uid]);
        $this->markWelcomeDirty($chatIds);
    }

    /**
     * Queues a rating change for the bot ($vote null = removed), only for users in an active group.
     */
    public function queueVote($uid, $movieId, $vote)
    {
        $sth = $this->pdo->prepare('SELECT 1 FROM tg_chat_member
        INNER JOIN tg_chat ON tg_chat.chat_id = tg_chat_member.chat_id AND tg_chat.active = 1
        WHERE tg_chat_member.user_id = :uid LIMIT 1');
        $sth->execute(['uid' => (int) $uid]);

        if (!$sth->fetchColumn()) {
            return;
        }

        $this->pdo->prepare('INSERT INTO vote_event (user_id, movie_id, vote) VALUES (:uid, :movie, :vote)')
            ->execute(['uid' => (int) $uid, 'movie' => (int) $movieId, 'vote' => $vote]);
    }

    protected function markWelcomeDirty($chatIds)
    {
        $sth = $this->pdo->prepare('UPDATE tg_chat SET welcome_dirty = 1 WHERE chat_id = :chat');
        foreach ($chatIds as $chatId) {
            $sth->execute(['chat' => $chatId]);
        }
    }
}
