module.exports = {
  apps: [
    {
      name: 'wa-outbound-saas',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
