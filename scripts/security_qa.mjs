import { DatabaseSync } from "node:sqlite";

const baseUrl = process.env.QA_URL || "http://localhost:3100";
const databasePath = process.env.QA_DB_PATH || ".data/qa-invitations.sqlite";
const endpoint = new URL("/api/invitations", baseUrl);

const request = (body, origin) => fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body,
});

const invalid = await request("{}", baseUrl);
const crossOrigin = await request("{}", "https://invalid.example");
const oversized = await request(
  JSON.stringify({ fullName: "x".repeat(17_000) }),
  baseUrl,
);

const database = new DatabaseSync(databasePath, { readOnly: true });
const storage = database.prepare(`
  SELECT
    COUNT(*) AS records,
    MIN(LENGTH(encrypted_payload)) AS shortest_ciphertext,
    SUM(
      CASE
        WHEN encrypted_payload LIKE '%Avenida%'
          OR encrypted_payload LIKE '%Convidado%'
        THEN 1 ELSE 0
      END
    ) AS plaintext_matches,
    SUM(CASE WHEN iv = '' OR auth_tag = '' THEN 1 ELSE 0 END) AS missing_crypto_metadata
  FROM invitation_addresses
`).get();
database.close();

const result = {
  responses: {
    invalid: invalid.status,
    crossOrigin: crossOrigin.status,
    oversized: oversized.status,
  },
  storage,
};

if (invalid.status !== 422 || crossOrigin.status !== 403 || oversized.status !== 413) {
  throw new Error(`Unexpected API security result: ${JSON.stringify(result.responses)}`);
}
if (!storage.records || storage.plaintext_matches || storage.missing_crypto_metadata) {
  throw new Error(`Unexpected storage result: ${JSON.stringify(storage)}`);
}

console.log(JSON.stringify(result, null, 2));
