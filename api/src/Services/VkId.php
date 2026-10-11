<?php

namespace Services;

use OAuth\Common\Consumer\CredentialsInterface;
use OAuth\Common\Http\Client\ClientInterface;
use OAuth\Common\Http\Exception\TokenResponseException;
use OAuth\Common\Http\Uri\Uri;
use OAuth\Common\Http\Uri\UriInterface;
use OAuth\Common\Storage\TokenStorageInterface;
use OAuth\OAuth2\Service\AbstractService;
use OAuth\OAuth2\Service\Exception\InvalidAuthorizationStateException;
use OAuth\OAuth2\Token\StdOAuth2Token;

/**
 * VK ID (OAuth 2.1 + PKCE) for apps created in the VK ID cabinet; they cannot use oauth.vk.com.
 *
 * The code_verifier is derived from the state with the app secret, so nothing beyond the state
 * has to be kept in the session. VK ID tokens only carry vkid.* scopes, so VK API calls made via
 * request() use the service key of the vk.com app instead of the user token.
 *
 * @see https://id.vk.ru/about/business/go/docs/ru/vkid/latest/vk-id/connection/start-integration/auth-without-sdk/auth-without-sdk-web
 */
class VkId extends AbstractService
{
    const SCOPE_PERSONAL_INFO = 'vkid.personal_info';
    const SCOPE_EMAIL = 'email';
    const SCOPE_PHONE = 'phone';

    public function __construct(
        CredentialsInterface $credentials,
        ClientInterface $httpClient,
        TokenStorageInterface $storage,
        $scopes = array(),
        UriInterface $baseApiUri = null
    ) {
        parent::__construct($credentials, $httpClient, $storage, $scopes, $baseApiUri, true);

        if (null === $baseApiUri) {
            $this->baseApiUri = new Uri('https://api.vk.com/method/');
        }
    }

    public function getAuthorizationEndpoint()
    {
        return new Uri('https://id.vk.ru/authorize');
    }

    public function getAccessTokenEndpoint()
    {
        return new Uri('https://id.vk.ru/oauth2/auth');
    }

    public function getAuthorizationUri(array $additionalParameters = array())
    {
        $state = $this->generateAuthorizationState();
        $this->storeAuthorizationState($state);

        $parameters = array_merge($additionalParameters, array(
            'response_type' => 'code',
            'client_id' => $this->credentials->getConsumerId(),
            'redirect_uri' => $this->redirectUri(),
            'state' => $state,
            'code_challenge' => self::base64Url(hash('sha256', $this->codeVerifier($state), true)),
            'code_challenge_method' => 'S256',
        ));
        if ($this->scopes) {
            $parameters['scope'] = implode(' ', $this->scopes);
        }

        $url = clone $this->getAuthorizationEndpoint();
        foreach ($parameters as $key => $value) {
            $url->addToQuery($key, $value);
        }

        return $url;
    }

    /**
     * @param string $code
     * @param string $state
     * @param string $deviceId returned by VK ID on the callback together with the code
     */
    public function requestAccessToken($code, $state = null, $deviceId = null)
    {
        if (null === $state || null === $deviceId) {
            throw new TokenResponseException('VK ID callback is missing state or device_id.');
        }
        try {
            $this->validateAuthorizationState($state);
        } catch (InvalidAuthorizationStateException $e) {
            // not an OAuth\Common exception, so the auth listener would let it through as a 500
            throw new TokenResponseException('VK ID state mismatch.');
        }
        $this->storage->clearAuthorizationState($this->service());

        $responseBody = $this->httpClient->retrieveResponse(
            $this->getAccessTokenEndpoint(),
            array(
                'grant_type' => 'authorization_code',
                'code' => $code,
                'code_verifier' => $this->codeVerifier($state),
                'client_id' => $this->credentials->getConsumerId(),
                'device_id' => $deviceId,
                'redirect_uri' => $this->redirectUri(),
                'state' => $state,
            ),
            $this->getExtraOAuthHeaders()
        );

        $token = $this->parseAccessTokenResponse($responseBody);
        $this->storage->storeAccessToken($this->service(), $token);

        return $token;
    }

    public function request($path, $method = 'GET', $body = null, array $extraHeaders = array())
    {
        $uri = $this->determineRequestUriFromPath($path, $this->baseApiUri);

        // VK ID's own endpoints (e.g. oauth2/user_info) take the user token as a form field
        if ('id.vk.ru' === $uri->getHost()) {
            $token = $this->storage->retrieveAccessToken($this->service());

            return $this->httpClient->retrieveResponse($uri, array(
                'access_token' => $token->getAccessToken(),
                'client_id' => $this->credentials->getConsumerId(),
            ), $extraHeaders, 'POST');
        }

        $uri->addToQuery('access_token', VKONTAKTE_APP_SERVICE_KEY);

        return $this->httpClient->retrieveResponse($uri, $body, $extraHeaders, $method);
    }

    public function isValidScope($scope)
    {
        return in_array($scope, array(self::SCOPE_PERSONAL_INFO, self::SCOPE_EMAIL, self::SCOPE_PHONE), true);
    }

    protected function parseAccessTokenResponse($responseBody)
    {
        $data = json_decode($responseBody, true);

        if (!is_array($data)) {
            throw new TokenResponseException('Unable to parse response.');
        }
        if (isset($data['error']) || !isset($data['access_token'])) {
            $error = isset($data['error']) ? $data['error'] : 'no access_token';
            $description = isset($data['error_description']) ? ': ' . $data['error_description'] : '';
            throw new TokenResponseException('Error in retrieving token: "' . $error . $description . '"');
        }

        $token = new StdOAuth2Token();
        $token->setAccessToken($data['access_token']);
        if (!empty($data['expires_in'])) {
            $token->setLifeTime($data['expires_in']);
        }
        if (isset($data['refresh_token'])) {
            $token->setRefreshToken($data['refresh_token']);
        }

        unset($data['access_token'], $data['refresh_token'], $data['expires_in']);
        $token->setExtraParams($data);

        return $token;
    }

    /**
     * 48 chars of [0-9a-f]; VK ID wants at least 32 chars of [a-zA-Z0-9_-].
     */
    protected function generateAuthorizationState()
    {
        return bin2hex(random_bytes(24));
    }

    /**
     * The callback URL without the auth_origin_url query the registry appends: VK ID only accepts
     * the exact trusted redirect URL, so the origin travels through the session instead.
     */
    private function redirectUri()
    {
        $url = $this->credentials->getCallbackUrl();
        $queryStart = strpos($url, '?');

        return false === $queryStart ? $url : substr($url, 0, $queryStart);
    }

    private function codeVerifier($state)
    {
        return self::base64Url(hash_hmac('sha256', $state, $this->credentials->getConsumerSecret(), true));
    }

    private static function base64Url($bytes)
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
