import { config } from './config.js';

// Gecureerde OpenAPI 3.0-specificatie van de belangrijkste API-endpoints. Bruikbaar
// met Swagger UI, Postman, code-generatoren enz. (De volledige endpoint-lijst staat
// in de README; dit dekt de kern voor programmatisch gebruik met een API-sleutel.)

const j = { type: 'object' };
export function openapiSpec(baseUrl = '') {
  return {
    openapi: '3.0.3',
    info: { title: 'SFTP Fileserver API', version: config.version, description: 'REST-API voor de fileserver. Authenticeer met een API-sleutel (Bearer fsk_…) of sessie-cookie.' },
    servers: baseUrl ? [{ url: baseUrl }] : [],
    components: {
      securitySchemes: {
        apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'fsk_… (maak in de web-UI onder API-sleutels)' },
        cookie: { type: 'apiKey', in: 'cookie', name: 'sid' },
      },
    },
    security: [{ apiKey: [] }, { cookie: [] }],
    paths: {
      '/api/whoami': { get: { summary: 'Huidige gebruiker + quota', responses: r200(j) } },
      '/api/list': {
        get: {
          summary: 'Map tonen', parameters: [
            q('path', 'Pad binnen de home (standaard /)'),
            q('q', 'Zoekterm (optioneel)'), q('sort', 'name|size|mtime'), q('order', 'asc|desc'),
          ], responses: r200(j),
        },
      },
      '/api/download': { get: { summary: 'Bestand downloaden', parameters: [q('path', 'Bestandspad', true)], responses: { 200: { description: 'Bestandsinhoud' }, 404: { description: 'Niet gevonden' } } } },
      '/api/upload': { post: { summary: 'Bestand(en) uploaden (multipart form-data, veld "files")', parameters: [q('path', 'Doelmap')], requestBody: { content: { 'multipart/form-data': { schema: j } } }, responses: r200(j) } },
      '/api/save': { post: { summary: 'Tekstbestand opslaan/overschrijven', parameters: [q('path', 'Bestandspad', true)], requestBody: { content: { 'text/plain': { schema: { type: 'string' } } } }, responses: r200(j) } },
      '/api/mkdir': { post: { summary: 'Map aanmaken', requestBody: body({ path: 'string', name: 'string' }), responses: r200(j) } },
      '/api/rename': { post: { summary: 'Hernoemen/verplaatsen', requestBody: body({ from: 'string', to: 'string' }), responses: r200(j) } },
      '/api/delete': { post: { summary: 'Naar prullenbak', requestBody: body({ path: 'string' }), responses: r200(j) } },
      '/api/share': { post: { summary: 'Publieke deel-link maken', requestBody: body({ path: 'string', expiresInHours: 'number', password: 'string', maxDownloads: 'number' }), responses: r200(j) } },
      '/api/versions': { get: { summary: 'Versiegeschiedenis', parameters: [q('path', 'Bestandspad', true)], responses: r200(j) } },
      '/api/hooks/{token}': { post: { summary: 'Inkomende webhook / API-trigger (publiek, per-token actie)', parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string' } }], responses: r200(j) } },
    },
  };
}

function q(name, description, required = false) { return { name, in: 'query', required, description, schema: { type: 'string' } }; }
function r200(schema) { return { 200: { description: 'OK', content: { 'application/json': { schema } } } }; }
function body(props) {
  const properties = {};
  for (const [k, t] of Object.entries(props)) properties[k] = { type: t };
  return { required: true, content: { 'application/json': { schema: { type: 'object', properties } } } };
}
