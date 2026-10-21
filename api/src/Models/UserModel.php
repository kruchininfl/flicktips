<?php

namespace Models;

use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Stub user class for testing.
 *
 * @author Chris Heng <bigblah@gmail.com>
 */
class UserModel implements UserInterface
{
    private $id;
    private $username;
    private $token;
    private $avatar;
    private $avatarSource;
    private $birthday;
    private $enabled;
    private $vkontakteId;
    private $vkontakteToken;
    private $facebookId;
    private $facebookToken;
    private $linkIdentity;

    public function __construct($attributes)
    {
        $this->id = isset($attributes['id']) ? $attributes['id'] : null;
        $this->username = isset($attributes['username']) ? $attributes['username'] : null;
        $this->token = isset($attributes['token']) ? $attributes['token'] : null;
        $this->avatar = isset($attributes['avatar']) ? $attributes['avatar'] : null;
        $this->avatarSource = isset($attributes['avatar_source']) ? $attributes['avatar_source'] : null;
        $this->birthday = isset($attributes['birthday']) ? $attributes['birthday'] : null;
        $this->enabled = isset($attributes['enabled']) ? $attributes['enabled'] : null;
        $this->vkontakteId = isset($attributes['vkontakte_id']) ? $attributes['vkontakte_id'] : null;
        $this->vkontakteToken = isset($attributes['vkontakte_token']) ? $attributes['vkontakte_token'] : null;
        $this->facebookId = isset($attributes['facebook_id']) ? $attributes['facebook_id'] : null;
        $this->facebookToken = isset($attributes['facebook_token']) ? $attributes['facebook_token'] : null;
        $this->linkIdentity = isset($attributes['link_identity']) ? $attributes['link_identity'] : null;
    }

    public function getId()
    {
        return $this->id;
    }

    public function getUsername()
    {
        return $this->username;
    }

    public function getToken()
    {
        return $this->token;
    }

    public function getAvatar()
    {
        return $this->avatar;
    }

    public function getBirthday()
    {
        return $this->birthday;
    }

    public function isEnabled()
    {
        return !!$this->enabled;
    }

    public function getVkontakteId()
    {
        return $this->vkontakteId;
    }

    public function getVkontakteToken()
    {
        return $this->vkontakteToken;
    }

    public function getFacebookId()
    {
        return $this->facebookId;
    }

    public function getFacebookToken()
    {
        return $this->facebookToken;
    }

    /**
     * Set instead of a real user when the OAuth flow was started to link a sign-in method:
     * [service, id, username, avatar, gender] of the provider account.
     */
    public function getLinkIdentity()
    {
        return $this->linkIdentity;
    }

    /**
     * Returns the roles granted to the user.
     *
     * <code>
     * public function getRoles()
     * {
     *     return array('ROLE_USER');
     * }
     * </code>
     *
     * Alternatively, the roles might be stored on a ``roles`` property,
     * and populated in any number of different ways when the user object
     * is created.
     *
     * @return (Role|string)[] The user roles
     */
    public function getRoles()
    {
        return array('ROLE_USER');
    }

    /**
     * Returns the password used to authenticate the user.
     *
     * This should be the encoded password. On authentication, a plain-text
     * password will be salted, encoded, and then compared to this value.
     *
     * @return string The password
     */
    public function getPassword()
    {
    }

    /**
     * Returns the salt that was originally used to encode the password.
     *
     * This can return null if the password was not encoded using a salt.
     *
     * @return string|null The salt
     */
    public function getSalt()
    {
    }

    /**
     * Removes sensitive data from the user.
     *
     * This is important if, at any given point, sensitive information like
     * the plain-text password is stored on this object.
     */
    public function eraseCredentials()
    {
    }
}
