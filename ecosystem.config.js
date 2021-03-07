module.exports = {
  apps : [{
    name      : 'flicktips-web-server',
    cwd       : '/var/www/flick.tips/web',
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
    cwd       : '/var/www/flick.tips/kp-parser',
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
    cwd       : '/var/www/flick.tips/ft-parser',
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
      host : '95.214.10.128',
      ref  : 'origin/master',
      repo : 'git@bitbucket.org:infamoustill/flicktips.git',
      path : '/var/www/flick.tips',
      'post-deploy' : 'npm --prefix /var/www/flick.tips/web install ' +
        '&& npm --prefix /var/www/flick.tips/web run build ' +
        '&& npm --prefix /var/www/flick.tips/kp-parser install ' +
        '&& yarn --prefix /var/www/flick.tips/ft-parser'
    }
  }
};
