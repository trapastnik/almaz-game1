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
