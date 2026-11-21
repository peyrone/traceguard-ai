import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { apiURL } from './client.ts';

test('joins hosted and local URLs with each API endpoint', () => {
  for (const endpoint of ['scenarios', 'analyze', 'explain'] as const) {
    assert.equal(apiURL(' https://api.example.com/// ', endpoint), `https://api.example.com/api/v1/${endpoint}`);
  }
  assert.equal(apiURL('https://example.com/gateway/', 'analyze'), 'https://example.com/gateway/api/v1/analyze');
  assert.equal(apiURL('https://example.com/api/v1/', 'explain'), 'https://example.com/api/v1/explain');
  assert.equal(apiURL('', 'scenarios'), 'http://localhost:8080/api/v1/scenarios');
});
