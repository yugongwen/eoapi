const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  css: {
    loaderOptions: {
      less: {
        lessOptions: {
          modifyVars: {
            'primary-color': '#00785a',
            'error-color': '#ff3c32',
          },
          javascriptEnabled: true,
        },
      },
    },
  },
});
