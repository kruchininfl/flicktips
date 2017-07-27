var dirname = __dirname;
require('babel-core/register');
['.css', '.less', '.scss', '.ttf', '.woff', '.woff2', '.svg'].forEach((ext) => require.extensions[ext] = () => {});
require('babel-polyfill');
require('server.js');