# VPS deployment

The workflow template is stored in `deploy/github-actions-deploy.yml`. Once the
VPS and GitHub secrets are ready, place it at `.github/workflows/deploy.yml` to
activate automatic deployment. It tests `main`, copies the release to
`/srv/projects/almaz-game1`, and runs Docker Compose. The app joins the existing
external Docker network `proxy`; the shared nginx is the only public entry.

## One-time VPS setup

The VPS needs Docker Engine with the Compose plugin, the external Docker network
`proxy`, and an SSH deploy user that can run Docker.

```bash
sudo mkdir -p /srv/projects/almaz-game1
sudo chown "$USER":"$USER" /srv/projects/almaz-game1
```

Point the domain's A record to the VPS, issue its certificate, and add the
server block from `deploy/nginx-site.conf.example` to
`/srv/infrastructure/proxy.conf`. Validate nginx before restarting only the
shared proxy.

Until a domain is ready, `deploy/nginx-ip.conf.example` documents the temporary
HTTP route for `188.225.35.200`. It still reaches the app only through the
shared `proxy` network and does not publish port 3000.

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
manually from the Actions tab. The workflow never publishes an application
port and does not change UFW.
