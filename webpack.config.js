global.Promise = require('bluebird');

var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var CleanWebpackPlugin = require('clean-webpack-plugin');
var UglifyJSPlugin = require('uglifyjs-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

var publicPath = process.env.NODE_ENV === 'development' ? 'https://flicktips.local:8050/public/assets' : '/assets/';
var outputPath = process.env.NODE_ENV === 'cordova' ? `${__dirname}/cordova/www/public/assets/` : `${__dirname}/public/assets/`;
var cssName = 'styles.css';
var jsName = 'bundle.js';
var HashPlugin = require('hash-webpack-plugin');

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

  plugins.push(new UglifyJSPlugin());

  plugins.push(new HashPlugin({path: './src', fileName: 'hash.txt'}));
}

if (process.env.NODE_ENV === 'cordova') {
  plugins.push(
    new CleanWebpackPlugin(['cordova/www/public/assets/'], {
      root   : __dirname,
      verbose: true,
      dry    : false
    })
  );

  plugins.push(new HtmlWebpackPlugin({
    template: './views/app.ejs',
    assetUrl: '',
    initialState: null,
    componentHTML: '',
    filename: '../index.html',
    inject: false
  }));

  plugins.push(new CopyWebpackPlugin([{from: path.resolve(__dirname, 'piblic/icons'), to: path.resolve(__dirname, 'cordova/www/public/icons')}]));
}

module.exports = {
  entry    : ['babel-polyfill', './src/client.js'],
  resolve  : {
    modules   : [path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules')],
    extensions: ['.js', '.jsx'],
  },
  plugins,
  output   : {
    path    : outputPath,
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
        loader: 'style-loader!css-loader!webfonts-loader'
      },
      {test: /\.gif$/, loader: 'url-loader?limit=20000&mimetype=image/gif'},
      {test: /\.jpg$/, loader: 'url-loader?limit=20000&mimetype=image/jpg'},
      {test: /\.png$/, loader: 'url-loader?limit=20000&mimetype=image/png'},
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