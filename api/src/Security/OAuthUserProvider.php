<?php

namespace Security;

use Gigablah\Silex\OAuth\Security\User\Provider\OAuthUserProviderInterface;
use Gigablah\Silex\OAuth\Security\Authentication\Token\OAuthTokenInterface;
use Silex\Application;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UsernameNotFoundException;
use Symfony\Component\Security\Core\User\UserProviderInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Models\UserModel;

/**
 * OAuth in-memory stub user provider.
 *
 * @author Chris Heng <bigblah@gmail.com>
 */
class OAuthUserProvider implements UserProviderInterface, OAuthUserProviderInterface
{
    /**
     * @var $pdo \PDO;
     */
    protected $pdo;

    /**
     * @var $app Application;
     */
    protected $app;

    private $users;
    private $credentials;

    public function __construct(Application $app)
    {
        $this->app = $app;
        $this->pdo = $app['pdo'];
    }

    public function createUser(OAuthTokenInterface $token)
    {
        $service = strtolower($token->getService());
        $userInfo = $token->getAttribute('userInfo');

        // insert user
        $sth = $this->pdo->prepare('
        INSERT INTO user (`username`, `token`, `avatar`, `avatar_source`, `gender`, `registration_date`, `' . $service . '_id`, `' . $service . '_token`) 
        VALUES (:username, :token, :avatar, :avatar_source, :gender, NOW(), :service_id, :service_token) 
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');


        $sth->execute([
                'username' => $userInfo['username'],
                'token' => md5(openssl_random_pseudo_bytes(32)),
                'avatar' => $userInfo['avatar'] ?? "",
                'avatar_source' => $userInfo['avatar_source'],
                'gender' => $userInfo['gender'],
                'service_id' => $userInfo['id'],
                // provider tokens are never read back, and VK ID ones overflow the varchar(255) column
                'service_token' => null
            ]
        );
        $user = $this->pdo->query('SELECT * FROM user WHERE id = LAST_INSERT_ID()')->fetch();

        return $user;
    }

    /**
     * {@inheritdoc}
     */
    public function loadUserByOAuthCredentials(OAuthTokenInterface $token)
    {
        $userInfo = $token->getAttribute('userInfo');
        $user = $this->pdo->query('SELECT * FROM user WHERE ' . strtolower($token->getService()) . '_id = ' . $userInfo['id'])->fetch();
        if (!$user || 1) {
            $user = $this->createUser($token);
        }

        $token->setAttributes(array('user_id' => $user['id'], 'user_token' => $user['token']));

        return new UserModel($user);
    }

    /**
     * {@inheritDoc}
     */
    public function refreshUser(UserInterface $user)
    {
        if (!$user instanceof UserModel) {
            throw new UnsupportedUserException(sprintf('Instances of "%s" are not supported.', get_class($user)));
        }

        return $user;
    }

    /**
     * {@inheritDoc}
     */
    public function supportsClass($class)
    {
        return $class === 'Gigablah\\Silex\\OAuth\\Security\\User\\StubUser';
    }

    /**
     * Loads the user for the given username.
     *
     * This method must throw UsernameNotFoundException if the user is not
     * found.
     *
     * @param string $username The username
     *
     * @return UserInterface
     *
     * @throws UsernameNotFoundException if the user is not found
     */
    public function loadUserByUsername($username)
    {
        // TODO: Implement loadUserByUsername() method.
    }
}
