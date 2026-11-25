/** Public project identifier only. Credentials remain in server environment variables. */
export const RECORDS_SUPABASE_PROJECT_REF = 'nycoldtrqbkevvgoajlq';

type Environment = Record<string, string | undefined>;

function recordsUrl(env: Environment, key: string): string | undefined {
  const value = env[key]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
    const host = decodeURIComponent(url.hostname).toLowerCase().replace(/\.$/, '');
    let project: string | undefined;
    if (host.endsWith('.pooler.supabase.com')) {
      project = decodeURIComponent(url.username).split('.').pop();
    } else if (host.endsWith('.supabase.co')) {
      if (!host.startsWith('db.')) throw new Error();
      project = host.split('.')[1];
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
    // Only the migrated Supabase project and explicit loopback verification databases are allowed.
    if (!local && project !== RECORDS_SUPABASE_PROJECT_REF) throw new Error();
    return value;
  } catch {
    // Never include the URL or the original parser error: both can contain credentials.
    throw new Error(`${key} must be a PostgreSQL URL for the migrated records project.`);
  }
}

/** Records never fall back to the unrelated application DATABASE_URL. */
export function getRecordsDatabaseUrl(env: Environment = process.env): string | undefined {
  if (env.RECORDS_DATA_BACKEND === 'local') return undefined;
  return recordsUrl(env, 'RECORDS_DATABASE_URL');
}

export function getRecordsWriterDatabaseUrl(env: Environment = process.env): string | undefined {
  return recordsUrl(env, 'RECORDS_WRITER_DATABASE_URL');
}

// The .mjs management CLI also runs through TSX's CommonJS interoperability layer.
export default { getRecordsDatabaseUrl, getRecordsWriterDatabaseUrl };
