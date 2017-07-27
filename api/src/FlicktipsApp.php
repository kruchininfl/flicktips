<?php

use Silex\Application;

/**
 * @property-read UrlGeneratorInterface $urlGenerator
 * @property-read Twig_Environment $twig
 * @property-read VkApi $api
 */
class FlicktipsApp extends Application
{
    public function __get($property)
    {
        return $this[Inflector::getDefault()->snake($property)];
    }
    public function __isset($property)
    {
        return isset($this[Inflector::getDefault()->snake($property)]);
    }
}