module.exports = {
  apps: [
    {
      name: "bms",
      cwd: "/var/www/bms",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/bms-error.log",
      out_file:   "/var/log/bms-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
