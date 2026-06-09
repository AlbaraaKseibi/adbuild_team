# Tiny static-file service for the Privacy Policy (and any future legal pages).
# Runs Caddy, which serves /srv on the PORT Railway injects.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html
