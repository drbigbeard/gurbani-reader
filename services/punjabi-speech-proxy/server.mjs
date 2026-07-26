import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { v2 as speechV2 } from '@google-cloud/speech';

const port = Number(process.env.PORT || 8080);
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || '';
const location = process.env.SPEECH_LOCATION || 'europe-west4';
const betaKey = process.env.SHABAD_SOJHI_BETA_KEY || '';
const recognizer = process.env.SPEECH_RECOGNIZER
  || `projects/${projectId}/locations/${location}/recognizers/_`;
const client = new speechV2.SpeechClient();
const maximumBodyBytes = 5 * 1024 * 1024;
const phraseHints = [
  'ਗੁਰਬਾਣੀ',
  'ਵਾਹਿਗੁਰੂ',
  'ਸਤਿਗੁਰੁ',
  'ਸਤਿਗੁਰੂ',
  'ਆਨੰਦੁ',
  'ਆਸਾ ਕੀ ਵਾਰ',
  'ਨਾਮੁ',
  'ਹਰਿ',
  'ਗੁਰੂ',
  'ਸਬਦੁ',
];

export function createPunjabiSpeechServer() {
  return createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, {
      ok: true,
      model: 'chirp_2',
      languageCode: 'pa-Guru-IN',
      location,
    });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/recognise') {
    json(response, 404, { error: 'Not found.' });
    return;
  }
  if (!betaKey || request.headers['x-shabad-beta-key'] !== betaKey) {
    json(response, 401, { error: 'Unauthorised beta client.' });
    return;
  }

  try {
    const body = await readJson(request);
    if (body.languageCode !== 'pa-Guru-IN')
      throw new ClientError('Only Punjabi (Gurmukhi, India) is accepted.');
    const audio = Buffer.from(String(body.audioBase64 || ''), 'base64');
    if (!audio.length) throw new ClientError('Audio is required.');
    if (audio.length > maximumBodyBytes) throw new ClientError('Audio exceeds the beta limit.');

    const [result] = await client.recognize({
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes: ['pa-Guru-IN'],
        model: 'chirp_2',
        features: {
          enableAutomaticPunctuation: false,
          maxAlternativesCount: 5,
        },
        adaptation: {
          phraseSets: [{
            inlinePhraseSet: {
              phrases: phraseHints.map(value => ({ value, boost: 15 })),
            },
          }],
        },
      },
      content: audio,
    });

    const matches = unique(
      (result.results || []).flatMap(item =>
        (item.alternatives || []).map(alternative => alternative.transcript || ''),
      ),
    ).slice(0, 5);
    json(response, 200, {
      matches,
      engine: 'google-cloud-speech-v2',
      model: 'chirp_2',
      languageCode: 'pa-Guru-IN',
      retained: false,
    });
  } catch (error) {
    if (error instanceof ClientError) {
      json(response, 400, { error: error.message });
      return;
    }
    console.error(error);
    json(response, 502, { error: 'Punjabi recognition failed.' });
  }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createPunjabiSpeechServer().listen(port, () => {
    console.log(`Punjabi speech proxy listening on ${port}`);
  });
}

function setCors(request, response) {
  const origin = String(request.headers.origin || '');
  const allowed = new Set(['capacitor://localhost', 'http://localhost', 'https://localhost']);
  if (allowed.has(origin)) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('vary', 'origin');
  response.setHeader('access-control-allow-headers', 'content-type,x-shabad-beta-key');
  response.setHeader('access-control-allow-methods', 'POST,GET,OPTIONS');
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maximumBodyBytes * 1.4) {
        reject(new ClientError('Request exceeds the beta limit.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ClientError('Request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function unique(values) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

class ClientError extends Error {}
