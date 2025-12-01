const { URL } = require('url');

const DEFAULT_REDIS_URL =
  process.env.REDIS_URL ||
  process.env.REDIS_TLS_URL ||
  process.env.REDIS_CONNECTION_STRING ||
  'redis://127.0.0.1:6379';

const DEFAULT_QUEUE_PREFIX = process.env.QUEUE_PREFIX || 'dah';

const queueNames = {
  zlibrary: process.env.ZLIBRARY_QUEUE_NAME || 'zlibrary-jobs',
};

function buildRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || process.env.REDIS_CONNECTION_STRING;
  const target = redisUrl && redisUrl.trim().length ? redisUrl.trim() : DEFAULT_REDIS_URL;
  const parsed = new URL(target);

  const connection = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };

  if (parsed.username) {
    connection.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    connection.password = decodeURIComponent(parsed.password);
  }

  if (parsed.protocol === 'rediss:') {
    connection.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false' ? false : true,
    };
  }

  return connection;
}

function buildBullmqBaseOptions() {
  return {
    prefix: process.env.QUEUE_PREFIX || DEFAULT_QUEUE_PREFIX,
    connection: buildRedisConnectionOptions(),
  };
}

module.exports = {
  buildRedisConnectionOptions,
  buildBullmqBaseOptions,
  queueNames,
};


