// Secrets come from the environment (docker compose env_file: .env; see .env.example).
export function env(name, fallback) {
  const value = process.env[name];
  if (value) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing environment variable ${name}`);
}
