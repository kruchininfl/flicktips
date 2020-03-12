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
  }],

  deploy : {
    production : {
      user : 'root',
      host : '95.214.10.128',
      ref  : 'origin/master',
      repo : 'git@bitbucket.org:infamoustill/flicktips.git',
      path : '/var/www/flick.tips',
      'post-deploy' : 'npm --prefix /var/www/flick.tips/web install && npm --prefix /var/www/flick.tips/web run build'
    }
  }
};
