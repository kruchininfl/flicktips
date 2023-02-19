module.exports = {
  apps : [{
    name      : 'flicktips-web-server',
    cwd       : '/var/www/flicktips.ru/source/web',
    script    : 'npm',
    args      : 'run server',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }, {
    name      : 'flicktips-kp-parser',
    cwd       : '/var/www/flicktips.ru/source/kp-parser',
    script    : 'npm',
    args      : 'run start',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }, {
    name      : 'flicktips-ft-parser',
    cwd       : '/var/www/flicktips.ru/source/ft-parser',
    script    : 'npm',
    args      : 'run start',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'root',
      host : '92.255.107.174',
      ref  : 'origin/master',
      repo : 'git@bitbucket.org:infamoustill/flicktips.git',
      path : '/var/www/flicktips.ru',
      'post-deploy' : 'npm --prefix /var/www/flicktips.ru/source/web install ' +
        '&& npm --prefix /var/www/flicktips.ru/source/web run build ' +
        '&& npm --prefix /var/www/flicktips.ru/source/kp-parser install ' +
        '&& yarn --prefix /var/www/flicktips.ru/source/ft-parser install'
    }
  }
};
