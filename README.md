# hwp-inline-runtime-chunk-plugin

[![Build and Test](https://github.com/sjinks/hwp-inline-runtime-chunk-plugin/actions/workflows/build.yml/badge.svg)](https://github.com/sjinks/hwp-inline-runtime-chunk-plugin/actions/workflows/build.yml)

This plugin automatically inlines Webpack's runtime chunks. It requires [html-webpack-plugin](https://github.com/jantimon/html-webpack-plugin)

This plugin was inspired by [html-webpack-inline-runtime-plugin](https://github.com/chippers/html-webpack-inline-runtime-plugin) and does pretty much the same but differently.

There are a few differences, though:
  * hwp-inline-runtime-chunk-plugin does *not* calculate integrity hashes (and therefore does not inject the CSP meta tag): the plugin must do one thing and do it well.
  * hwp-inline-runtime-chunk-plugin has an option (off by default) to strip the source map from the inlined runtime chunk.
  * hwp-inline-runtime-chunk-plugin tries to handle all corner cases and has an extensive test suite.

## Installation

```bash
npm install --save-dev hwp-inline-runtime-chunk-plugin
```

## Usage

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { HwpInlineRuntimeChunkPlugin } = require('hwp-inline-runtime-chunk-plugin');

module.exports = {
  optimization: {
    runtimeChunk: 'single'
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new HwpInlineRuntimeChunkPlugin({ removeSourceMap: true })
  ]
};
```

The plugin currently has only one configuration option:
  * `removeSourceMap` (Boolean, the default is `false`): whether to remove the link to the source map from the inlined source

 
