module.exports = {
    entry: './src/js/main.js',
    output: {
      filename: 'bundle.js',
      path: __dirname + '/dist/static/js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        }
      ]
    }
  };