<?php

namespace Controllers;

use Silex\Application;
use Symfony\Component\HttpFoundation\Request;

/**
 * The «Telegram» block of the profile: linking a Telegram account and the groups where @FlickTipsBot
 * posts the user's ratings. The bot itself lives in tg-bot/.
 */
class TelegramController
{
    public function get(Request $request, Application $app)
    {
        $user = $this->getUser($request, $app);

        if (!$user) {
            return $this->unauthorized($app);
        }

        $account = $app['telegram.repository']->getAccount($user['id']);

        return $app->json([
            'success' => true,
            'linked' => !empty($account['tg_user_id']),
            'username' => $account['tg_username'],
            'botUsername' => TELEGRAM_BOT_USERNAME,
            'groups' => $app['telegram.repository']->getGroups($user['id'])
        ]);
    }

    /**
     * A fresh one-time code and the t.me links that pass it to the bot: one opens a chat with it (links the
     * account), the other adds it to a group (links the account and joins that group).
     */
    public function link(Request $request, Application $app)
    {
        $user = $this->getUser($request, $app);

        if (!$user) {
            return $this->unauthorized($app);
        }

        $code = $app['telegram.repository']->createLinkCode($user['id']);
        $bot = 'https://t.me/' . TELEGRAM_BOT_USERNAME;

        return $app->json([
            'success' => true,
            'code' => $code,
            'startUrl' => $bot . '?start=' . $code,
            'groupUrl' => $bot . '?startgroup=' . $code
        ]);
    }

    /**
     * /telegram?code=... page: someone pressed «Участвовать» in a group before linking, the bot sent them here.
     */
    public function confirm(Request $request, Application $app)
    {
        $user = $this->getUser($request, $app);

        if (!$user) {
            return $this->unauthorized($app);
        }

        $result = $app['telegram.repository']->confirmLinkCode($user['id'], $request->get('code'));

        if (!$result) {
            return $app->json([
                'success' => false,
                'err' => 'Code not found or expired'
            ], 404);
        }

        return $app->json([
            'success' => true,
            'group' => is_array($result) ? $result : null
        ]);
    }

    public function leaveGroup(Request $request, Application $app)
    {
        $user = $this->getUser($request, $app);

        if (!$user) {
            return $this->unauthorized($app);
        }

        $app['telegram.repository']->leaveGroup($user['id'], $request->get('chatId'));

        return $app->json(['success' => true]);
    }

    public function unlink(Request $request, Application $app)
    {
        $user = $this->getUser($request, $app);

        if (!$user) {
            return $this->unauthorized($app);
        }

        $app['telegram.repository']->unlink($user['id']);

        return $app->json(['success' => true]);
    }

    protected function getUser(Request $request, Application $app)
    {
        return $app['user.repository']->getByCredentials(
            $request->headers->get('uid'),
            $request->headers->get('access-token')
        );
    }

    protected function unauthorized(Application $app)
    {
        return $app->json([
            'success' => false,
            'msg' => 'authorization required'
        ], 401);
    }
}
