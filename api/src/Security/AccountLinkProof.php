<?php

namespace Security;

use Symfony\Component\HttpFoundation\Session\SessionInterface;

/**
 * Signed proof that the browser just passed VK/Yandex sign-in for an identity, used to link that
 * sign-in method to the current account. The proof is only valid in the PHP session that started the
 * flow (its nonce lives there), so a proof leaked from a URL or planted through a crafted /auth link
 * cannot be used from another browser.
 */
class AccountLinkProof
{
    const TTL = 900;
    const SESSION_KEY = 'account_link.nonce';

    public static function create(array $identity, SessionInterface $session)
    {
        $nonce = bin2hex(random_bytes(16));
        $session->set(self::SESSION_KEY, $nonce);

        $payload = self::encode(json_encode(array(
            'identity' => $identity,
            'nonce' => $nonce,
            'exp' => time() + self::TTL
        )));

        return $payload . '.' . self::encode(hash_hmac('sha256', $payload, self::key(), true));
    }

    /**
     * @return array|null the identity passed to create()
     */
    public static function verify($proof, SessionInterface $session = null)
    {
        $parts = explode('.', (string) $proof);
        if (count($parts) !== 2 || null === $session) {
            return null;
        }

        list($payload, $signature) = $parts;
        if (!hash_equals(self::encode(hash_hmac('sha256', $payload, self::key(), true)), $signature)) {
            return null;
        }

        $data = json_decode(self::decode($payload), true);
        $nonce = $session->get(self::SESSION_KEY);
        if (!is_array($data) || $data['exp'] < time() || !$nonce || !hash_equals($nonce, (string) $data['nonce'])) {
            return null;
        }

        return $data['identity'];
    }

    public static function consume(SessionInterface $session)
    {
        $session->remove(self::SESSION_KEY);
    }

    // no separate secret in .env for this: the OAuth app secrets are server-only and stable enough
    private static function key()
    {
        return hash('sha256', 'flicktips-account-link|' . VKONTAKTE_API_SECRET . '|' . YANDEX_CLIENT_SECRET, true);
    }

    private static function encode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function decode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
