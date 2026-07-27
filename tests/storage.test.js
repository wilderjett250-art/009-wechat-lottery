import assert from 'node:assert/strict';
import test from 'node:test';

import { diffPayloadRows } from '../storage.js';

test('MySQL persistence only upserts changed rows and deletes missing ids', () => {
  const previous = [
    ['unchanged', '{"value":1}'],
    ['changed', '{"value":1}'],
    ['removed', '{"value":1}']
  ];
  const current = [
    ['unchanged', '{"value":1}'],
    ['changed', '{"value":2}'],
    ['created', '{"value":3}']
  ];

  assert.deepEqual(diffPayloadRows(current, previous), {
    upserts: [
      ['changed', '{"value":2}'],
      ['created', '{"value":3}']
    ],
    deleteIds: ['removed']
  });
});
