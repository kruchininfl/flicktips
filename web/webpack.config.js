global.Promise = require('bluebird');

var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var CleanWebpackPlugin = require('clean-webpack-plugin');

var publicPath = 'https://flicktips.local:8050/public/assets';
var cssName = process.env.NODE_ENV === 'cordova' ? 'styles-mobile.css' : 'styles.css';
var jsName = process.env.NODE_ENV === 'cordova' ? 'bundle-mobile.js' : 'bundle.js';

var plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      BROWSER : JSON.stringify(true),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    }
  }),
  new webpack.LoaderOptionsPlugin({
    debug  : process.env.NODE_ENV !== 'production',
    options: {
      eslint: {
        configFile: path.join(__dirname, '.eslintrc')
      }
    }
  }),
  // new webpack.EnvironmentPlugin(['NODE_ENV']),
  new ExtractTextPlugin(cssName)
];

if (process.env.NODE_ENV === 'production') {
  plugins.push(
    new CleanWebpackPlugin(['public/assets/'], {
      root   : __dirname,
      verbose: true,
      dry    : false
    })
  );
}

module.exports = {
  entry    : ['babel-polyfill', './src/client.js'],
  resolve  : {
    modules   : [path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules')],
    extensions: ['.js', '.jsx'],
  },
  plugins,
  output   : {
    path    : `${__dirname}/public/assets/`,
    filename: jsName,
    publicPath
  },
  module   : {
    loaders: [
      {
        test  : /\.(scss|sass|css)$/i,
        loader: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use     : 'css-loader?sourceMap!postcss-loader!sass-loader?sourceMap&sourceComment'
        })
      },
      {
        test  : /\.font\.(js|json)$/,
        loader: "style-loader!css-loader!webfonts-loader"
      },
      {test: /\.gif$/, loader: 'url-loader?limit=10000&mimetype=image/gif'},
      {test: /\.jpg$/, loader: 'url-loader?limit=10000&mimetype=image/jpg'},
      {test: /\.png$/, loader: 'url-loader?limit=10000&mimetype=image/png'},
      {test: /\.svg/, loader: 'url-loader?limit=26000&mimetype=image/svg+xml'},
      {test: /\.(woff|woff2|ttf|eot)/, loader: 'url-loader?limit=1'},
      {
        test   : /\.jsx?$/,
        loader : process.env.NODE_ENV !== 'production' ? 'babel-loader!eslint-loader' : 'babel-loader',
        exclude: [/node_modules/, /public/]
      },
      {test: /\.json$/, loader: 'json-loader'},
    ]
  },
  devtool  : process.env.NODE_ENV !== 'production' ? 'source-map' : false,
  devServer: {
    headers: {'Access-Control-Allow-Origin': '*'}
  }
};