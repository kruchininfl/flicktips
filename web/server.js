require('babel-core/register');
['.css', '.less', '.scss', '.ttf', '.woff', '.woff2', '.svg'].forEach((ext) => require.extensions[ext] = () => {});
require('babel-polyfill');

var OriginalArrayBuffer = global.ArrayBuffer;
var originKeys =global.Reflect ? Reflect.ownKeys(OriginalArrayBuffer):Object.keys(OriginalArrayBuffer);

function ArrayBuffer (length) {
  return new OriginalArrayBuffer(length || 0)
}

originKeys.forEach(function (key) {
  ArrayBuffer[key] = OriginalArrayBuffer[key]
});

global.ArrayBuffer = ArrayBuffer;

require('server.js');