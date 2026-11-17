client_max_body_size 10m;

location /api/ {
  proxy_pass http://api/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}

location /socket.io/ {
  proxy_pass http://api;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_set_header Host $host;
  proxy_read_timeout 1h;
}

# Arquivos com hash no nome: cache longo.
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  try_files $uri =404;
}

# Service worker e manifest: sempre a versão nova.
location ~ ^/(sw\.js|manifest\.webmanifest)$ {
  add_header Cache-Control "no-cache";
  try_files $uri =404;
}

# SPA: rota desconhecida cai no index.html.
location / {
  add_header Cache-Control "no-cache";
  try_files $uri $uri/ /index.html;
}
