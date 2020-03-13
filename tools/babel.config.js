module.exports = function (api) {
  api.cache(true);
  return {
    "ignore": [
      "node_modules"
    ],
    "presets": [
      "@babel/preset-env"
    ],
    "plugins": [
      ["@babel/plugin-proposal-optional-chaining"],
      ["@babel/plugin-proposal-decorators", { "legacy": true }],
      ["@babel/plugin-proposal-class-properties", { "loose" : true }]
    ]
  };
};