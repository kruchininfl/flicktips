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
        return $this->httpUtils->createRedirectResponse($request, $request->get('auth_origin_url') ? $request->get('auth_origin_url') . '?' . http_build_query($params) : $this->determineTargetUrl($request));
    }
}
