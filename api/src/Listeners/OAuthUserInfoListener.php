<?php

namespace Listeners;

use Gigablah\Silex\OAuth\OAuthServiceRegistry;
use Gigablah\Silex\OAuth\OAuthEvents;
use Gigablah\Silex\OAuth\Event\FilterTokenEvent;
use Gigablah\Silex\OAuth\Security\Authentication\Token\OAuthToken;
use Silex\Application;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Listener to retrieve user information from the OAuth service provider.
 *
 * @author Chris Heng <bigblah@gmail.com>
 */
class OAuthUserInfoListener implements EventSubscriberInterface
{
    private $app;
    private $registry;
    private $config;

    /**
     * Constructor.
     *
     * @param Application $app
     */
    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->registry = $app['oauth'];
        $this->config = $app['oauth.services'];
    }

    /**
     * When the security token is created, populate it with user information from the service API.
     *
     * @param FilterTokenEvent $event
     */
    public function onFilterToken(FilterTokenEvent $event)
    {
        $token = $event->getToken();
        $service = $token->getService();
        $oauthService = $this->registry->getService($service);
        $config = $this->config[$service];

        $serviceName = OAuthServiceRegistry::getServiceName($oauthService);
        $accessToken = $oauthService->getStorage()->retrieveAccessToken($serviceName);
        $token->setAccessToken($accessToken);

        $callback = isset($config['user_callback']) && is_callable($config['user_callback']) ? $config['user_callback'] : array($this, 'defaultUserCallback');

        if (isset($config['user_endpoint'])) {
            $rawUserInfo = json_decode($oauthService->request(is_callable($config['user_endpoint']) ? $config['user_endpoint']($token) : $config['user_endpoint']), true);
        }
        call_user_func($callback, $token, $rawUserInfo, $oauthService);
    }

    /**
     * {@inheritDoc}
     */
    public static function getSubscribedEvents()
    {
        return array(
            OAuthEvents::TOKEN => 'onFilterToken'
        );
    }

    protected function defaultUserCallback(OAuthToken $token, $rawUserInfo, $service)
    {
        if (!is_array($rawUserInfo)) {
            return;
        }

        $serviceName = strtolower($token->getService());

        if ($serviceName === 'vkontakte') {
            $rawUserInfo = $rawUserInfo['response'][0];
        }

        $userInfo = array();
        $fieldMap = array(
            'id' => array('id', 'uid'),
            'token' => array(function () use ($token) {
                return $token->getCredentials();
            }),
            'username' => array(function ($info, $serviceName) {
                if ($serviceName == 'facebook') {
                    return isset($info['name']) ? $info['name'] : null;
                } else if ($serviceName == 'vkontakte') {
                    return $info['first_name'] . (isset($info['first_name']) && isset($info['last_name']) ? ' ' : '') . $info['last_name'];
                }
            }),
            'gender' => array(function ($info, $serviceName) {
                if ($serviceName == 'facebook') {
                    return isset($info['gender']) ? $info['gender'] : null;
                } else if ($serviceName == 'vkontakte') {
                    if ($info['sex'] === 1) {
                        return 'female';
                    } else if ($info['sex'] === 2) {
                        return 'male';
                    }
                    return null;
                }
            }),
            'avatar_source' => array(function ($info, $serviceName) {
                if ($serviceName == 'facebook') {
                    return isset($info['picture']['data']['url']) ? $info['picture']['data']['url'] : null;
                } else if ($serviceName == 'vkontakte') {
                    return isset($info['photo_400_orig']) ? $info['photo_400_orig'] : isset($info['photo_max_orig']) ? $info['photo_max_orig'] : null;
                }
            }),
            'friends' => array(function ($info, $serviceName, $accesToken) {
                if ($serviceName == 'facebook') {
                    return isset($info['friends']) && count($info['friends']['data']) ? array_map(function ($el) {
                        return $el['id'];
                    }, $info['friends']['data']) : null;
                } else if ($serviceName == 'vkontakte') {
                    $response = json_decode($this->app['guzzle']->request('GET', 'https://api.vk.com/method/friends.get?v=5.131&user_id=' . $info['id'] . '&access_token=' . $accesToken)->getBody());
                    return $response->response->items;
                }
            }),
        );

        foreach ($fieldMap as $key => $fields) {
            $userInfo[$key] = null;
            foreach ($fields as $field) {
                if (is_callable($field)) {
                    $userInfo[$key] = $field($rawUserInfo, $serviceName, $token->getCredentials());
                    break;
                }
                if (isset($rawUserInfo[$field])) {
                    $userInfo[$key] = $rawUserInfo[$field];
                    break;
                }
            }
        }

        $token->setAttribute('userInfo', $userInfo);
    }
}
