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
 * Yandex ID (oauth.yandex.ru, authorization code flow with a client secret).
 *
 * The app needs the "Доступ к логину, имени и фамилии, полу" and "Доступ к портрету пользователя"
 * permissions in the oauth.yandex.ru cabinet; login.yandex.ru/info returns only what they grant.
 *
 * @see https://yandex.ru/dev/id/doc/ru/codes/code-url
 */
class Yandex extends AbstractService
{
    public function __construct(
        CredentialsInterface $credentials,
        ClientInterface $httpClient,
        TokenStorageInterface $storage,
        $scopes = array(),
        UriInterface $baseApiUri = null
    ) {
        parent::__construct($credentials, $httpClient, $storage, $scopes, $baseApiUri, true);

        if (null === $baseApiUri) {
            $this->baseApiUri = new Uri('https://login.yandex.ru/');
        }
    }

    public function getAuthorizationEndpoint()
    {
        return new Uri('https://oauth.yandex.ru/authorize');
    }

    public function getAccessTokenEndpoint()
    {
        return new Uri('https://oauth.yandex.ru/token');
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
     */
    public function requestAccessToken($code, $state = null)
    {
        // the parent skips the state check when no state is passed
        if (null === $state) {
            throw new TokenResponseException('Yandex ID callback is missing state.');
        }
        try {
            $this->validateAuthorizationState($state);
        } catch (InvalidAuthorizationStateException $e) {
            // not an OAuth\Common exception, so the auth listener would let it through as a 500
            throw new TokenResponseException('Yandex ID state mismatch.');
        }
        $this->storage->clearAuthorizationState($this->service());

        $responseBody = $this->httpClient->retrieveResponse(
            $this->getAccessTokenEndpoint(),
            array(
                'grant_type' => 'authorization_code',
                'code' => $code,
                'client_id' => $this->credentials->getConsumerId(),
                'client_secret' => $this->credentials->getConsumerSecret(),
            ),
            $this->getExtraOAuthHeaders()
        );

        $token = $this->parseAccessTokenResponse($responseBody);
        $this->storage->storeAccessToken($this->service(), $token);

        return $token;
    }

    protected function getAuthorizationMethod()
    {
        return static::AUTHORIZATION_METHOD_HEADER_OAUTH;
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

    protected function generateAuthorizationState()
    {
        return bin2hex(random_bytes(24));
    }

    /**
     * The callback URL without the auth_origin_url query the registry appends, so it matches the
     * Redirect URI registered in the cabinet; the origin travels through the session instead.
     */
    private function redirectUri()
    {
        $url = $this->credentials->getCallbackUrl();
        $queryStart = strpos($url, '?');

        return false === $queryStart ? $url : substr($url, 0, $queryStart);
    }
}
