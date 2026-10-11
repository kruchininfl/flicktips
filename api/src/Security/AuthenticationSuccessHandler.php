<?php

namespace Security;

use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Http\Authentication\DefaultAuthenticationSuccessHandler;

/**
 * Class with the default authentication success handling logic.
 *
 * @author Fabien Potencier <fabien@symfony.com>
 * @author Johannes M. Schmitt <schmittjoh@gmail.com>
 * @author Alexander <iam.asm89@gmail.com>
 */
class AuthenticationSuccessHandler extends DefaultAuthenticationSuccessHandler
{
    /**
     * {@inheritdoc}
     */
    public function onAuthenticationSuccess(Request $request, TokenInterface $token)
    {
        $params = array(
            'auth_token' => $token->getUser()->getToken(),
            'uid' => $token->getUser()->getId()
        );
        $authOriginUrl = $request->get('auth_origin_url');
        if ($authOriginUrl && $this->isOwnUrl($authOriginUrl, $request)) {
            return $this->httpUtils->createRedirectResponse($request, $authOriginUrl . '?' . http_build_query($params));
        }

        return $this->httpUtils->createRedirectResponse($request, $this->determineTargetUrl($request));
    }

    /**
     * auth_origin_url receives the auth token, so only send it back to this site.
     */
    private function isOwnUrl($url, Request $request)
    {
        $host = parse_url($url, PHP_URL_HOST);
        $scheme = parse_url($url, PHP_URL_SCHEME);

        return in_array($scheme, array('http', 'https'), true)
            && in_array($host, array($request->getHost(), 'flicktips.ru', 'www.flicktips.ru'), true);
    }
}
