import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jurisdictions, supportedJurisdictions } from './jurisdiction';

const contradictoryApprovalMarkers = /\b(?:open|pending|release blocker(?:s)?|requires final human review)\b/i;

function repositoryPath(recordPath: string) {
  const candidates = [
    resolve(process.cwd(), recordPath),
    resolve(process.cwd(), '../..', recordPath),
  ];
  const match = candidates.find((path) => existsSync(path));
  assert.ok(match, `source matrix path exists: ${recordPath}`);
  return match;
}

test('every approved jurisdiction points to an existing source matrix', () => {
  for (const jurisdiction of supportedJurisdictions) {
    repositoryPath(jurisdiction.sourceMatrixReview.recordPath);
  }
});

test('approved source matrices contain no unresolved approval language', () => {
  for (const jurisdiction of supportedJurisdictions) {
    const path = repositoryPath(jurisdiction.sourceMatrixReview.recordPath);
    const matrix = readFileSync(path, 'utf8');
    assert.doesNotMatch(matrix, contradictoryApprovalMarkers, `${jurisdiction.code} source matrix`);
  }
});

test('California approval records the accountable signoff', () => {
  assert.equal(jurisdictions['US-CA'].sourceMatrixReview.status, 'approved');
  const path = repositoryPath(jurisdictions['US-CA'].sourceMatrixReview.recordPath);
  const matrix = readFileSync(path, 'utf8');
  assert.match(matrix, /Jorge Lozoya/i);
  assert.match(matrix, /Program Manager/i);
  assert.match(matrix, /approved `us-ca-2026\.09\.1` for release/i);
});