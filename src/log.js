import { randomBytes } from 'node:crypto';
import { config } from './config.js';

// Gestructureerde logging: bij LOG_JSON=true worden regels als JSON weggeschreven
// (handig voor log-aggregatie/OpenTelemetry-collectors zoals Loki, ELK, Datadog).
// Elke request krijgt een correlation-id (trace-id) die in de logs terugkomt,
// zodat je alle regels van één verzoek kunt volgen.

function emit(level, msg, fields = {}) {
  if (config.logJson) {
    process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }) + '\n');
  } else {
    const extra = Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
    (level === 'error' ? console.error : console.log)(`[${level}] ${msg}${extra}`);
  }
}

export const log = {
  info: (msg, f) => emit('info', msg, f),
  warn: (msg, f) => emit('warn', msg, f),
  error: (msg, f) => emit('error', msg, f),
};

// Express-middleware: geef elk verzoek een trace-id (uit een inkomende
// traceparent/X-Request-Id header of nieuw gegenereerd) en log de afronding.
export function requestLogger() {
  return (req, res, next) => {
    const traceId = (req.headers['x-request-id'] || (req.headers['traceparent'] || '').split('-')[1] || randomBytes(8).toString('hex')).toString().slice(0, 32);
    req.traceId = traceId;
    res.setHeader('X-Request-Id', traceId);
    const start = Date.now();
    res.on('finish', () => {
      // Alleen loggen als JSON-logging aanstaat (anders te veel ruis).
      if (config.logJson) {
        log.info('http', { traceId, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start, user: req.user || null });
      }
    });
    next();
  };
}
