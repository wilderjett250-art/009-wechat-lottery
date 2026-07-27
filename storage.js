import { promises as fs } from 'node:fs';
import path from 'node:path';

const entityTables = {
  activities: 'lottery_activity',
  prizes: 'lottery_prize',
  participants: 'lottery_participant',
  winners: 'lottery_winner',
  shares: 'lottery_share',
  follows: 'lottery_follow',
  members: 'lottery_member',
  sessions: 'lottery_session',
  subscriptions: 'lottery_subscription',
  notificationLogs: 'lottery_notification_log',
  participationApplications: 'lottery_participation_application',
  assists: 'lottery_assist',
  officialFollowers: 'lottery_official_follower',
  officialAccountAuthorizations: 'lottery_official_account_authorization',
  wecomContacts: 'lottery_wecom_contact',
  wecomGroups: 'lottery_wecom_group',
  coupons: 'lottery_coupon',
  orders: 'lottery_order',
  checkIns: 'lottery_check_in',
  activityViews: 'lottery_activity_view',
  comments: 'lottery_comment',
  creatorSubscriptions: 'lottery_creator_subscription',
  activityTasks: 'lottery_activity_task',
  activityEvents: 'lottery_activity_event',
  messages: 'lottery_message',
  riskEvents: 'lottery_risk_event',
  partnerships: 'lottery_partnership',
  creatorTeamMembers: 'lottery_creator_team_member',
  creatorBlacklists: 'lottery_creator_blacklist'
};

const metadataKeys = ['memberStats', 'wallet', 'wechatOpenPlatform'];

function payloadValue(value) {
  if (Buffer.isBuffer(value)) value = value.toString('utf8');
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

function rowId(collection, item, index) {
  return String(item?.id || `${collection}_${index + 1}`);
}

function cloneDb(db) {
  return JSON.parse(JSON.stringify(db));
}

function collectionPayloadRows(collection, db) {
  const rows = Array.isArray(db?.[collection]) ? db[collection] : [];
  return rows.map((item, index) => [
    rowId(collection, item, index),
    JSON.stringify(item)
  ]);
}

function metadataPayloadRows(db) {
  return [
    ...metadataKeys.map(key => [key, JSON.stringify(db?.[key] ?? {})]),
    ['_initialized', JSON.stringify({ version: 1 })]
  ];
}

export function diffPayloadRows(currentRows, previousRows = []) {
  const previous = new Map(previousRows);
  const current = new Map(currentRows);
  return {
    upserts: currentRows.filter(([id, payload]) => previous.get(id) !== payload),
    deleteIds: previousRows
      .map(([id]) => id)
      .filter(id => !current.has(id))
  };
}

export function createDataStore({ dataDir, dbPath, seedPath, databaseUrl, normalizeDb }) {
  let mysqlPool = null;
  let mysqlReady = false;
  let mysqlSnapshot = null;

  async function readJsonInitialData() {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      return JSON.parse(await fs.readFile(dbPath, 'utf8'));
    } catch (error) {
      if (error.code && error.code !== 'ENOENT') throw error;
      return JSON.parse(await fs.readFile(seedPath, 'utf8'));
    }
  }

  async function ensureJson() {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(dbPath);
    } catch {
      const seed = await fs.readFile(seedPath, 'utf8');
      await fs.writeFile(dbPath, seed, 'utf8');
    }
  }

  async function writeJson(db) {
    await fs.mkdir(dataDir, { recursive: true });
    const tempPath = path.join(dataDir, `db.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tempPath, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(tempPath, dbPath);
  }

  async function getMySqlPool() {
    if (!mysqlPool) {
      const mysql = await import('mysql2/promise');
      mysqlPool = mysql.default.createPool({
        uri: databaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true
      });
    }
    return mysqlPool;
  }

  async function ensureMySql() {
    if (mysqlReady) return;
    const pool = await getMySqlPool();
    await pool.query('SELECT 1');
    for (const table of Object.values(entityTables)) {
      await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
        id VARCHAR(96) NOT NULL PRIMARY KEY,
        payload JSON NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS lottery_metadata (
      state_key VARCHAR(96) NOT NULL PRIMARY KEY,
      payload JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    const [rows] = await pool.query("SELECT state_key FROM lottery_metadata WHERE state_key = '_initialized'");
    if (!rows.length) {
      const initial = await readJsonInitialData();
      normalizeDb(initial);
      await writeMySql(initial, pool);
    }
    mysqlReady = true;
  }

  async function readMySql(pool) {
    const db = {};
    for (const [collection, table] of Object.entries(entityTables)) {
      const [rows] = await pool.query(`SELECT payload FROM ${table} ORDER BY updated_at DESC, id ASC`);
      db[collection] = rows.map(row => payloadValue(row.payload));
    }
    const [metadata] = await pool.query('SELECT state_key, payload FROM lottery_metadata');
    const values = new Map(metadata.map(row => [row.state_key, payloadValue(row.payload)]));
    for (const key of metadataKeys) db[key] = values.get(key);
    return db;
  }

  async function writeMySql(db, pool = null, previousDb = mysqlSnapshot) {
    const activePool = pool || await getMySqlPool();
    const connection = await activePool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [collection, table] of Object.entries(entityTables)) {
        const changes = diffPayloadRows(
          collectionPayloadRows(collection, db),
          collectionPayloadRows(collection, previousDb)
        );
        if (changes.upserts.length) {
          await connection.query(
            `INSERT INTO ${table} (id, payload) VALUES ? ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
            [changes.upserts]
          );
        }
        if (changes.deleteIds.length) {
          await connection.query(`DELETE FROM ${table} WHERE id IN (?)`, [changes.deleteIds]);
        }
      }
      const metadataChanges = diffPayloadRows(
        metadataPayloadRows(db),
        previousDb ? metadataPayloadRows(previousDb) : []
      );
      if (metadataChanges.upserts.length) {
        await connection.query(
          'INSERT INTO lottery_metadata (state_key, payload) VALUES ? ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
          [metadataChanges.upserts]
        );
      }
      if (metadataChanges.deleteIds.length) {
        await connection.query(
          'DELETE FROM lottery_metadata WHERE state_key IN (?)',
          [metadataChanges.deleteIds]
        );
      }
      await connection.commit();
      mysqlSnapshot = cloneDb(db);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function ensure() {
    if (databaseUrl) {
      await ensureMySql();
      return;
    }
    await ensureJson();
  }

  async function read() {
    await ensure();
    if (databaseUrl) {
      const db = await readMySql(await getMySqlPool());
      mysqlSnapshot = cloneDb(db);
      if (normalizeDb(db)) await writeMySql(db);
      return db;
    }
    const db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
    if (normalizeDb(db)) await writeJson(db);
    return db;
  }

  async function write(db) {
    normalizeDb(db);
    await ensure();
    if (databaseUrl) {
      await writeMySql(db);
      return;
    }
    await writeJson(db);
  }

  return {
    backend: databaseUrl ? 'mysql' : 'json',
    ensure,
    read,
    write
  };
}
