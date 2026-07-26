import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.SHABAD_SOJHI_BETA_KEY = 'test-only-key';
const { createPunjabiSpeechServer } = await import('./server.mjs');

let origin = '';
let server;

before(async () => {
  server = createPunjabiSpeechServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve())),
  );
});

test('health describes the selected Punjabi model without retaining audio', async () => {
  const response = await fetch(`${origin}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    model: 'chirp_2',
    languageCode: 'pa-Guru-IN',
    location: 'europe-west4',
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('recognition rejects a client without the beta credential before processing audio', async () => {
  const response = await fetch(`${origin}/v1/recognise`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audioBase64: 'dGVzdA==',
      languageCode: 'pa-Guru-IN',
    }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorised beta client.' });
});
