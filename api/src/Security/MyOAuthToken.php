<?php

namespace Security;

use Gigablah\Silex\OAuth\Security\Authentication\Token\OAuthToken;
use Gigablah\Silex\OAuth\Security\Authentication\Token\OAuthTokenInterface;
use Symfony\Component\Security\Core\Authentication\Token\AbstractToken;
use OAuth\Common\Token\TokenInterface as AccessTokenInterface;

/**
 * Token for OAuth Authentication responses.
 *
 * @author Chris Heng <bigblah@gmail.com>
 */
class MyOAuthToken extends OAuthToken
{
    protected $sid;
    protected $authToken;
    protected $locale;
    protected $gender;
    protected $birthday;
    protected $avatar;
    protected $friends;

    public function getSid()
    {
        return $this->sid;
    }

    public function setSid($sid)
    {
        $this->sid = $sid;
    }

    public function getAuthToken()
    {
        return $this->authToken;
    }

    public function setAuthToken($authToken)
    {
        $this->authToken = $authToken;
    }

    public function getLocale()
    {
        return $this->locale;
    }

    public function setLocale($locale)
    {
        $this->locale = $locale;
    }

    public function getGender()
    {
        return $this->gender;
    }

    public function setGender($gender)
    {
        $this->gender = $gender;
    }

    public function getBirthday()
    {
        return $this->birthday;
    }

    public function setBirthday($birthday)
    {
        $this->birthday = $birthday;
    }

    public function getAvatar()
    {
        return $this->avatar;
    }

    public function setAvatar($avatar)
    {
        $this->avatar = $avatar;
    }

    public function getFriends()
    {
        return $this->friends;
    }

    public function setFriends($friends)
    {
        $this->friends = $friends;
    }
}
