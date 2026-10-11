<?php

namespace Services;

use Gigablah\Silex\OAuth\OAuthServiceRegistry;
use OAuth\ServiceFactory;
use OAuth\Common\Consumer\Credentials;
use OAuth\Common\Http\Uri\Uri;
use OAuth\Common\Service\ServiceInterface;
use OAuth\Common\Service\AbstractService;
use OAuth\Common\Storage\TokenStorageInterface;

/**
 * Registry for instantiating and memoizing OAuth service providers.
 *
 * @author Chris Heng <bigblah@gmail.com>
 */
class MyOAuthServiceRegistry extends OAuthServiceRegistry
{
    /**
     * @param string $service
     *
     * @return bool
     */
    public function hasService($service)
    {
        return isset($this->serviceMap[strtolower($service)]);
    }

    /**
     * Retrieve a service by name.
     *
     * @param string $service
     * @param string $authOriginUrl
     *
     * @return ServiceInterface
     */
    public function getService($service, $authOriginUrl = '')
    {
        $service = $this->mapServiceName($service);

        if (isset($this->services[$service])) {
            return $this->services[$service];
        }

        return $this->services[$service] = $this->createService($service, $authOriginUrl);
    }

    /**
     * Instantiate a service by name.
     *
     * @param string $service
     * @param string $authOriginUrl
     *
     * @return ServiceInterface
     */
    public function createService($service, $authOriginUrl = '')
    {
        if (!isset($this->config[$service])) {
            throw new \InvalidArgumentException(sprintf('OAuth configuration not defined for the "%s" service.', $service));
        }

        $referenceType = true;
        $urlGeneratorInterface = 'Symfony\Component\Routing\Generator\UrlGeneratorInterface';
        if (defined(sprintf('%s::ABSOLUTE_URL', $urlGeneratorInterface))) {
            $referenceType = $urlGeneratorInterface::ABSOLUTE_URL;
        }
        $credentials = new Credentials(
            $this->config[$service]['key'],
            $this->config[$service]['secret'],
            $this->urlGenerator->generate($this->options['callback_route'], array(
                'service' => strtolower($service),
                'auth_origin_url' => $authOriginUrl
            ), $referenceType)
        );

        $scope = isset($this->config[$service]['scope']) ? $this->config[$service]['scope'] : array();
        $uri = isset($this->config[$service]['uri']) ? new Uri($this->config[$service]['uri']) : null;

        if (isset($this->config[$service]['class'])) {
            $this->oauthServiceFactory->registerService($service, $this->config[$service]['class']);
            unset($this->config[$service]['class']);
        }

        return $this->oauthServiceFactory->createService(
            $service,
            $credentials,
            $this->oauthStorage,
            $scope,
            $uri
        );
    }
}
