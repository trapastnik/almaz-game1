# VPS deployment

The workflow template is stored in `deploy/github-actions-deploy.yml`. Once the
VPS and GitHub secrets are ready, place it at `.github/workflows/deploy.yml` to
activate automatic deployment. It tests `main`, copies the release to
`/opt/touch-game`, and runs Docker Compose. Caddy exposes the app and obtains a
TLS certificate automatically when `SITE_ADDRESS` is a domain.

## One-time VPS setup

The VPS needs Docker Engine with the Compose plugin, ports 80 and 443 open, and
a non-root deploy user that can run Docker.

```bash
sudo mkdir -p /opt/touch-game
sudo chown "$USER":"$USER" /opt/touch-game
printf 'SITE_ADDRESS=game.example.ru\n' > /opt/touch-game/.env
```

Point the domain's A record to the VPS before the first deployment. Without a
domain, use `SITE_ADDRESS=:80` and open the server by IP over HTTP.

## GitHub Actions secrets

Create the `production` environment and add these repository secrets:

- `VPS_HOST`: server IP or hostname;
- `VPS_USER`: SSH deploy user;
- `VPS_SSH_KEY`: private SSH key for that user;
- `VPS_KNOWN_HOSTS`: output of `ssh-keyscan -p PORT -H SERVER_HOST` verified
  against the VPS host key.

Add the repository variable `DEPLOY_ENABLED=true` after all secrets are ready.
For a non-standard SSH port, also add `VPS_PORT`; otherwise port 22 is used.

Every push to `main` then runs the automated deployment. It can also be started
manually from the Actions tab.
