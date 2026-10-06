import { randomInt, randomUUID, randomBytes } from "node:crypto";
import pg from "pg";
import { cleanText, hashSecret } from "./lib.mjs";

const { Pool } = pg;

export function createDatabase({ connectionString, tokenPepper }) {
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });

  async function initialize() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id uuid PRIMARY KEY,
        token_hash char(64) UNIQUE NOT NULL,
        region varchar(120) NOT NULL,
        city varchar(120) NOT NULL,
        venue varchar(160) NOT NULL,
        table_label varchar(120) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz,
        disabled_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS activation_codes (
        id uuid PRIMARY KEY,
        code_hash char(64) UNIQUE NOT NULL,
        region varchar(120) NOT NULL,
        city varchar(120) NOT NULL,
        venue varchar(160) NOT NULL,
        table_label varchar(120) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        used_by_device_id uuid REFERENCES devices(id)
      );

      CREATE TABLE IF NOT EXISTS game_events (
        event_id varchar(80) PRIMARY KEY,
        device_id uuid NOT NULL REFERENCES devices(id),
        game_id varchar(80) NOT NULL,
        game_version varchar(40) NOT NULL,
        level smallint NOT NULL,
        score integer NOT NULL,
        correct_count smallint NOT NULL,
        total_count smallint NOT NULL,
        accuracy smallint NOT NULL,
        duration_ms integer NOT NULL,
        finished_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        answers jsonb NOT NULL
      );

      CREATE INDEX IF NOT EXISTS game_events_finished_at_idx ON game_events(finished_at DESC);
      CREATE INDEX IF NOT EXISTS game_events_device_id_idx ON game_events(device_id);
      CREATE INDEX IF NOT EXISTS devices_location_idx ON devices(region, city, venue);
    `);
  }

  async function healthcheck() {
    await pool.query("SELECT 1");
  }

  async function createActivationCode(metadata) {
    const region = cleanText(metadata.region, 120);
    const city = cleanText(metadata.city, 120);
    const venue = cleanText(metadata.venue, 160);
    const tableLabel = cleanText(metadata.tableLabel, 120);
    if (!region || !city || !venue || !tableLabel) throw new Error("Заполните регион, город, площадку и название стола");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomInt(10_000_000, 100_000_000).toString();
      try {
        await pool.query(
          `INSERT INTO activation_codes (id, code_hash, region, city, venue, table_label, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, now() + interval '7 days')`,
          [randomUUID(), hashSecret(code, tokenPepper), region, city, venue, tableLabel],
        );
        return { code, region, city, venue, tableLabel, expiresInDays: 7 };
      } catch (error) {
        if (error?.code !== "23505") throw error;
      }
    }
    throw new Error("Не удалось создать уникальный код");
  }

  async function activateDevice(code) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const activation = await client.query(
        `SELECT * FROM activation_codes
         WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [hashSecret(code, tokenPepper)],
      );
      if (!activation.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }

      const source = activation.rows[0];
      const deviceId = randomUUID();
      const token = randomBytes(32).toString("base64url");
      await client.query(
        `INSERT INTO devices (id, token_hash, region, city, venue, table_label)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [deviceId, hashSecret(token, tokenPepper), source.region, source.city, source.venue, source.table_label],
      );
      await client.query(
        `UPDATE activation_codes SET used_at = now(), used_by_device_id = $1 WHERE id = $2`,
        [deviceId, source.id],
      );
      await client.query("COMMIT");
      return {
        deviceId,
        token,
        region: source.region,
        city: source.city,
        venue: source.venue,
        tableLabel: source.table_label,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function findDeviceByToken(token) {
    const result = await pool.query(
      `SELECT id, region, city, venue, table_label
       FROM devices WHERE token_hash = $1 AND disabled_at IS NULL`,
      [hashSecret(token, tokenPepper)],
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return { id: row.id, region: row.region, city: row.city, venue: row.venue, tableLabel: row.table_label };
  }

  async function saveEvents(deviceId, events) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const event of events) {
        await client.query(
          `INSERT INTO game_events (
             event_id, device_id, game_id, game_version, level, score, correct_count,
             total_count, accuracy, duration_ms, finished_at, answers
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.eventId,
            deviceId,
            event.gameId,
            event.gameVersion,
            event.level,
            event.score,
            event.correctCount,
            event.totalCount,
            event.accuracy,
            event.durationMs,
            event.finishedAt,
            JSON.stringify(event.answers),
          ],
        );
      }
      await client.query("UPDATE devices SET last_seen_at = now() WHERE id = $1", [deviceId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  function buildFilters(query) {
    const values = [query.from, query.to];
    const clauses = ["e.finished_at >= $1", "e.finished_at <= $2"];
    for (const [key, column] of [["region", "d.region"], ["city", "d.city"], ["venue", "d.venue"], ["device", "d.id::text"]]) {
      if (query[key]) {
        values.push(query[key]);
        clauses.push(`${column} = $${values.length}`);
      }
    }
    if (query.level) {
      values.push(Number(query.level));
      clauses.push(`e.level = $${values.length}`);
    }
    return { sql: clauses.join(" AND "), values };
  }

  async function getSummary(query) {
    const filters = buildFilters(query);
    const [overview, byRegion, byDay, byLevel, hardest, devices, locations] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS sessions,
                COALESCE(SUM(e.total_count), 0)::int AS answers,
                COALESCE(ROUND(100.0 * SUM(e.correct_count) / NULLIF(SUM(e.total_count), 0)), 0)::int AS accuracy,
                COALESCE(ROUND(AVG(e.score)), 0)::int AS average_score,
                COALESCE(ROUND(AVG(e.duration_ms)), 0)::int AS average_duration_ms
         FROM game_events e JOIN devices d ON d.id = e.device_id WHERE ${filters.sql}`,
        filters.values,
      ),
      pool.query(
        `SELECT d.region, COUNT(*)::int AS sessions,
                COALESCE(ROUND(100.0 * SUM(e.correct_count) / NULLIF(SUM(e.total_count), 0)), 0)::int AS accuracy,
                COALESCE(ROUND(AVG(e.score)), 0)::int AS average_score
         FROM game_events e JOIN devices d ON d.id = e.device_id
         WHERE ${filters.sql} GROUP BY d.region ORDER BY sessions DESC, d.region`,
        filters.values,
      ),
      pool.query(
        `SELECT to_char(date_trunc('day', e.finished_at AT TIME ZONE 'Europe/Moscow'), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS sessions
         FROM game_events e JOIN devices d ON d.id = e.device_id
         WHERE ${filters.sql} GROUP BY 1 ORDER BY 1`,
        filters.values,
      ),
      pool.query(
        `SELECT e.level, COUNT(*)::int AS sessions,
                COALESCE(ROUND(100.0 * SUM(e.correct_count) / NULLIF(SUM(e.total_count), 0)), 0)::int AS accuracy,
                COALESCE(ROUND(AVG(e.score)), 0)::int AS average_score,
                COALESCE(ROUND(AVG(e.duration_ms)), 0)::int AS average_duration_ms
         FROM game_events e JOIN devices d ON d.id = e.device_id
         WHERE ${filters.sql} GROUP BY e.level ORDER BY e.level`,
        filters.values,
      ),
      pool.query(
        `SELECT answer->>'foodId' AS food_id, MAX(answer->>'foodName') AS food_name,
                COUNT(*)::int AS answers,
                COUNT(*) FILTER (WHERE answer->>'correct' = 'false')::int AS mistakes
         FROM game_events e JOIN devices d ON d.id = e.device_id
         CROSS JOIN LATERAL jsonb_array_elements(e.answers) answer
         WHERE ${filters.sql}
         GROUP BY answer->>'foodId'
         HAVING COUNT(*) FILTER (WHERE answer->>'correct' = 'false') > 0
         ORDER BY mistakes DESC, answers DESC LIMIT 10`,
        filters.values,
      ),
      pool.query(
        `SELECT d.id, d.region, d.city, d.venue, d.table_label,
                d.activated_at, d.last_seen_at, d.disabled_at,
                COUNT(e.event_id)::int AS sessions
         FROM devices d LEFT JOIN game_events e ON e.device_id = d.id
         GROUP BY d.id ORDER BY d.region, d.city, d.venue, d.table_label`,
      ),
      pool.query(
        `SELECT DISTINCT region, city, venue FROM devices WHERE disabled_at IS NULL ORDER BY region, city, venue`,
      ),
    ]);

    const activeDevices = devices.rows.filter((device) => device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 86_400_000).length;
    return {
      overview: { ...overview.rows[0], devices: devices.rowCount, active_devices: activeDevices },
      byRegion: byRegion.rows,
      byDay: byDay.rows,
      byLevel: byLevel.rows,
      hardest: hardest.rows,
      devices: devices.rows,
      locations: locations.rows,
      range: { from: query.from, to: query.to },
    };
  }

  async function getCsvRows(query) {
    const filters = buildFilters(query);
    const result = await pool.query(
      `SELECT e.finished_at, d.region, d.city, d.venue, d.table_label, e.game_id,
              e.game_version, e.level, e.score, e.correct_count, e.total_count,
              e.accuracy, e.duration_ms
       FROM game_events e JOIN devices d ON d.id = e.device_id
       WHERE ${filters.sql} ORDER BY e.finished_at DESC`,
      filters.values,
    );
    return result.rows;
  }

  async function deleteExpiredEvents(retentionDays) {
    const days = Math.max(30, Math.min(3650, Number(retentionDays) || 730));
    const result = await pool.query("DELETE FROM game_events WHERE received_at < now() - ($1::text || ' days')::interval", [days]);
    await pool.query("DELETE FROM activation_codes WHERE expires_at < now() - interval '30 days'");
    return result.rowCount;
  }

  return {
    initialize,
    healthcheck,
    createActivationCode,
    activateDevice,
    findDeviceByToken,
    saveEvents,
    getSummary,
    getCsvRows,
    deleteExpiredEvents,
    close: () => pool.end(),
  };
}
