import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { InvitationAddress } from "@/lib/invitation";

type StoredInvitation = {
  id: string;
  createdAt: string;
};

let database: DatabaseSync | null = null;
let encryptionKey: Buffer | null = null;

function dataDirectory() {
  const configuredPath = process.env.INVITATIONS_DB_PATH?.trim();
  const databasePath = configuredPath || path.join(process.cwd(), ".data", "invitations.sqlite");
  mkdirSync(path.dirname(databasePath), { recursive: true });
  return { databasePath, directory: path.dirname(databasePath) };
}

function getEncryptionKey() {
  if (encryptionKey) return encryptionKey;
  const configuredKey = process.env.INVITATION_DATA_KEY?.trim();

  if (configuredKey) {
    const decoded = Buffer.from(configuredKey, "base64");
    if (decoded.length !== 32) throw new Error("INVITATION_DATA_KEY must be a 32-byte base64 value.");
    encryptionKey = decoded;
    return encryptionKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("INVITATION_DATA_KEY is required in production.");
  }

  const { directory } = dataDirectory();
  const keyPath = path.join(directory, "development.key");
  try {
    encryptionKey = Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  } catch {
    encryptionKey = randomBytes(32);
    writeFileSync(keyPath, encryptionKey.toString("base64"), { encoding: "utf8", mode: 0o600 });
  }
  return encryptionKey;
}

function getDatabase() {
  if (database) return database;
  const { databasePath } = dataDirectory();
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS invitation_addresses (
      id TEXT PRIMARY KEY,
      encrypted_payload TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS invitation_addresses_ip_created
      ON invitation_addresses (ip_hash, created_at);
  `);
  return database;
}

function encryptAddress(address: InvitationAddress) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(address), "utf8"), cipher.final()]);
  return {
    encryptedPayload: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function hashClientAddress(value: string) {
  return createHash("sha256").update(getEncryptionKey()).update(value || "unknown").digest("hex");
}

export function countRecentSubmissions(ipHash: string, sinceIso: string) {
  const statement = getDatabase().prepare(
    "SELECT COUNT(*) AS total FROM invitation_addresses WHERE ip_hash = ? AND created_at >= ?",
  );
  const row = statement.get(ipHash, sinceIso) as { total: number };
  return Number(row.total);
}

export function saveInvitation(address: InvitationAddress, ipHash: string): StoredInvitation {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const encrypted = encryptAddress(address);
  const statement = getDatabase().prepare(`
    INSERT INTO invitation_addresses (id, encrypted_payload, iv, auth_tag, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  statement.run(id, encrypted.encryptedPayload, encrypted.iv, encrypted.authTag, ipHash, createdAt);
  return { id, createdAt };
}
