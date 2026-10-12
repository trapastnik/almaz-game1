# Analytics backups

`backup-analytics.sh` creates a compressed PostgreSQL dump in
`/srv/backups/almaz-game1`, validates the gzip stream, writes a SHA-256 checksum,
and removes dumps older than 30 days. The backup directory and files are
accessible only to root.

Install the supplied systemd unit and timer on the VPS:

```bash
install -m 644 ops/almaz-game1-analytics-backup.service /etc/systemd/system/
install -m 644 ops/almaz-game1-analytics-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now almaz-game1-analytics-backup.timer
systemctl start almaz-game1-analytics-backup.service
```

Check the latest run with:

```bash
systemctl status almaz-game1-analytics-backup.service
systemctl list-timers almaz-game1-analytics-backup.timer
ls -l /srv/backups/almaz-game1
```

## Presentation demo data

The `demo_20261012` campaign adds two clearly labelled demo tables (Kazan and
Novosibirsk) and synthetic game results for the presentation on 12 October 2026.
Generate the SQL locally with the project's dependencies installed:

```bash
node ops/demo-analytics.mjs seed /tmp/almaz-demo-seed.sql
node ops/demo-analytics.mjs remove /tmp/almaz-demo-remove.sql
```

Take a database backup, then run the seed SQL through the existing database
container. The fixed table and event IDs make repeated seeding idempotent.

```bash
ssh -p 49222 root@188.225.35.200 \
  'docker compose -f /srv/projects/almaz-game1/compose.yaml exec -T analytics-db psql -v ON_ERROR_STOP=1 -U analytics -d analytics' \
  < /tmp/almaz-demo-seed.sql
```

After the presentation, run the same command with `/tmp/almaz-demo-remove.sql`.
Removal is restricted to the campaign's two exact table IDs and marked results;
it refuses to proceed if either table contains non-demo game results. The demo
devices have no usable client tokens.

A ready-to-run removal file is also stored on the VPS at
`/srv/backups/almaz-game1/demo-20261012-remove.sql`. To remove the demo campaign
when requested after the presentation, take a fresh backup and run on the VPS:

```bash
docker compose -f /srv/projects/almaz-game1/compose.yaml exec -T analytics-db \
  psql -v ON_ERROR_STOP=1 -U analytics -d analytics \
  < /srv/backups/almaz-game1/demo-20261012-remove.sql
```

## TLS renewal

After the first Let's Encrypt certificate has been issued, install the supplied
renewal service and timer. The check runs twice daily, validates nginx, and
restarts only the shared proxy after Certbot completes.

```bash
install -m 644 ops/almaz-game1-tls-renew.service /etc/systemd/system/
install -m 644 ops/almaz-game1-tls-renew.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now almaz-game1-tls-renew.timer
```

Restore into an empty database only after stopping analytics ingestion and taking
an additional copy of the current volume:

```bash
gzip -dc /srv/backups/almaz-game1/analytics-YYYYMMDDTHHMMSSZ.sql.gz \
  | docker compose -f /srv/projects/almaz-game1/compose.yaml exec -T analytics-db \
      psql -U analytics -d analytics
```
