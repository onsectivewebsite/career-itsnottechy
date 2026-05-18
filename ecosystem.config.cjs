module.exports = {
  apps: [
    {
      name: 'itsnottechy-careers',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/opt/itsnottechy-careers',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      autorestart: true,
      time: true,
    },
  ],
};
