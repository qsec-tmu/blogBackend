module.exports = {
  apps: [
    {
      name: "blogAPI",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "production",
        CORS_ORIGIN: "*", 
      },
      env_development: {
        NODE_ENV: "development",
        CORS_ORIGIN: "*", 
    }
  ]
};

