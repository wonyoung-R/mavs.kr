import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as query } from "../../src/app/api/records/query/route";
import { GET as scope } from "../../src/app/api/records/scope/route";

test("query API rejects empty and excessive input without a backend call", async () => {
  for (const value of ["   ", "a".repeat(501)]) {
    const response = await query(
      new NextRequest(
        `https://example.com/api/records/query?q=${encodeURIComponent(value)}`,
      ),
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("scope API requires one season and bounds pagination", async () => {
  for (const suffix of [
    "?kind=season",
    "?kind=player&id=dirk&page=101",
    "?kind=game",
    "?kind=season&season=2024&competition=invalid",
    "?kind=season&season=2024&page=-1",
  ]) {
    const response = await scope(
      new NextRequest(`https://example.com/api/records/scope${suffix}`),
    );
    assert.equal(response.status, 400, suffix);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

import { GET as coverage } from "../../src/app/api/records/coverage/route";
import {
  catalogFromDataset,
  emptyRecordDataset,
  recordReadRepository,
  RecordReleaseError,
  requireRecordRelease,
} from "../../src/lib/records/repository";

const release = "r_0123456789abcdef01234567";
const otherRelease = "r_abcdef0123456789abcdef01";
const endpoints = [
  { name: "query", get: query, path: "/api/records/query?q=Dirk%20points" },
  { name: "scope", get: scope, path: "/api/records/scope?kind=player&id=dirk" },
  { name: "coverage", get: coverage, path: "/api/records/coverage?" },
];
const snapshot = (releaseId: string | null) => ({
  ...catalogFromDataset({ dataset: emptyRecordDataset(), status: "empty" }),
  releaseId,
  dalPlayerIds: ["dirk"],
});
const queryResult = (releaseId: string | null) => ({
  status: "empty" as const,
  rows: [],
  summaries: [],
  total: 0,
  coverage: [],
  incomplete: true,
  releaseId,
});

test("all read APIs reject malformed, empty, and duplicate release IDs before the backend", async (t) => {
  const catalogMock = t.mock.method(
    recordReadRepository,
    "readRecordCatalog",
    async () => snapshot(release),
  );
  const scopeMock = t.mock.method(
    recordReadRepository,
    "readRecordScope",
    async () => snapshot(release),
  );
  const queryMock = t.mock.method(
    recordReadRepository,
    "queryRecords",
    async () => queryResult(release),
  );
  for (const endpoint of endpoints) {
    for (const suffix of [
      "releaseId=",
      "releaseId=local",
      "releaseId=r_ABCDEF0123456789abcdef01",
      "releaseId=r_0123",
      `releaseId=${release}&releaseId=${release}`,
    ]) {
      const response = await endpoint.get(
        new NextRequest(`https://example.com${endpoint.path}&${suffix}`),
      );
      assert.equal(response.status, 400, `${endpoint.name}: ${suffix}`);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  }
  assert.equal(catalogMock.mock.callCount(), 0);
  assert.equal(scopeMock.mock.callCount(), 0);
  assert.equal(queryMock.mock.callCount(), 0);
});

test("pinned read APIs forward the exact release and return immutable cache responses", async (t) => {
  const catalogMock = t.mock.method(
    recordReadRepository,
    "readRecordCatalog",
    async () => snapshot(release),
  );
  const scopeMock = t.mock.method(
    recordReadRepository,
    "readRecordScope",
    async () => snapshot(release),
  );
  const queryMock = t.mock.method(
    recordReadRepository,
    "queryRecords",
    async () => queryResult(release),
  );
  for (const endpoint of endpoints) {
    const response = await endpoint.get(
      new NextRequest(
        `https://example.com${endpoint.path}&releaseId=${release}`,
      ),
    );
    assert.equal(response.status, 200, endpoint.name);
    assert.equal((await response.json()).releaseId, release);
    assert.match(
      response.headers.get("cache-control") || "",
      /s-maxage=31536000, immutable/,
    );
  }
  assert.equal(catalogMock.mock.calls[0].arguments[0], release);
  assert.equal(scopeMock.mock.calls[0].arguments[0].releaseId, release);
  assert.equal(queryMock.mock.calls[0].arguments[0], "Dirk points");
  assert.equal(queryMock.mock.calls[0].arguments[1], release);
});

test("unpinned APIs use a short cache even when the response has a published release ID", async (t) => {
  const catalogMock = t.mock.method(
    recordReadRepository,
    "readRecordCatalog",
    async () => snapshot(release),
  );
  const scopeMock = t.mock.method(
    recordReadRepository,
    "readRecordScope",
    async () => snapshot(release),
  );
  const queryMock = t.mock.method(
    recordReadRepository,
    "queryRecords",
    async () => queryResult(release),
  );
  for (const endpoint of endpoints) {
    const response = await endpoint.get(
      new NextRequest(`https://example.com${endpoint.path}`),
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") || "", /s-maxage=60,/);
    assert.doesNotMatch(
      response.headers.get("cache-control") || "",
      /immutable/,
    );
  }
  assert.equal(catalogMock.mock.calls[0].arguments[0], undefined);
  assert.equal(scopeMock.mock.calls[0].arguments[0].releaseId, undefined);
  assert.equal(queryMock.mock.calls[0].arguments[1], undefined);
});

test("missing or mismatched releases return 404 rather than serving current data", async (t) => {
  t.mock.method(recordReadRepository, "readRecordCatalog", async () =>
    snapshot(null),
  );
  t.mock.method(recordReadRepository, "readRecordScope", async () =>
    snapshot(otherRelease),
  );
  t.mock.method(recordReadRepository, "queryRecords", async () => {
    throw new RecordReleaseError(
      404,
      "The requested record release was not found.",
    );
  });
  for (const endpoint of endpoints) {
    const response = await endpoint.get(
      new NextRequest(
        `https://example.com${endpoint.path}&releaseId=${release}`,
      ),
    );
    assert.equal(response.status, 404, endpoint.name);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).status, "not_found");
  }
  assert.throws(
    () => requireRecordRelease(release, null),
    (error: unknown) =>
      error instanceof RecordReleaseError && error.status === 404,
  );
});

test("unknown records and unsupported queries are never CDN cached", async (t) => {
  t.mock.method(recordReadRepository, "readRecordScope", async () => ({
    ...snapshot(release),
    dalPlayerIds: [],
  }));
  t.mock.method(recordReadRepository, "queryRecords", async () => ({
    ...queryResult(release),
    status: "unsupported" as const,
  }));
  for (const endpoint of endpoints.slice(0, 2)) {
    const response = await endpoint.get(
      new NextRequest(
        `https://example.com${endpoint.path}&releaseId=${release}`,
      ),
    );
    assert.equal(
      response.headers.get("cache-control"),
      "no-store",
      endpoint.name,
    );
  }
});
