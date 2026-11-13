export interface ConnectionStatusRow {
  status: "connected" | "error" | "disconnected";
  last_sync_at: string | null;
  last_error_code: string | null;
  sync_scope: string;
}

export function publicConnectionStatus(connection: ConnectionStatusRow | null, credentialsStored: boolean) {
  if (!connection) {
    return {
      connected: false,
      credentialsStored: false,
      status: "not_configured" as const,
      lastSyncAt: null,
      lastErrorCode: null,
      syncScope: null,
    };
  }
  return {
    connected: connection.status === "connected",
    credentialsStored,
    status: connection.status,
    lastSyncAt: connection.last_sync_at,
    lastErrorCode: connection.last_error_code,
    syncScope: connection.sync_scope,
  };
}
