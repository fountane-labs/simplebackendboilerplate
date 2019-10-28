var config = {
  jwtKey: "GitAPIKey",
  startPort : 1000,
  endPort: 9999,

  base_path: "",
  base_url: "http://localhost:4192",

  webserver_default: {
      domain: "sukor.in",
      ip: ""
  },
  app: {
    port: (process.env.PORT || '4998')
  },

  nginx_sites_enabled: "/etc/nginx/sites-enabled/",

  apiKeys: {
    sendGrid: "",
  },
  client:{
    host: "",
    port: process.env.PORT || '4987'
  },
  api:{
    host: "",
  },
}

module.exports = config
