/** Contratos públicos: nunca transportar tokens, senhas ou segredos nestes tipos. */
export type PlatformId = "shopee" | "tiktok" | "tiktok-shop" | "mercado-livre";
export type CapabilityId = "products" | "affiliate-links" | "commissions" | "profile" | "videos" | "publishing";
export type AuthorizationStatus = "not_connected" | "pending" | "authorized" | "expired" | "revoked";
export type SyncStatus = "not_started" | "idle" | "running" | "failed" | "paused";
export type ConnectorErrorCode = "not_implemented" | "not_authorized" | "permission_denied" | "token_expired" | "rate_limited" | "provider_unavailable" | "invalid_response";

export interface ConnectorError {
  code: ConnectorErrorCode;
  /** Mensagem sanitizada, sem resposta bruta do provedor ou credenciais. */
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  correlationId?: string;
}
export type ConnectorResult<T> = { ok: true; data: T } | { ok: false; error: ConnectorError };

export interface ConnectionMetadata {
  connectionId: string;
  platform: PlatformId;
  /** Identificadores públicos; a autorização por proprietário será validada no servidor. */
  accountLabel: string;
  createdAt: string;
  updatedAt: string;
  authorizedAt?: string;
  expiresAt?: string;
}
export interface AuthorizationState {
  status: AuthorizationStatus;
  grantedPermissions: readonly string[];
  missingPermissions: readonly string[];
}
export interface SynchronizationState {
  status: SyncStatus;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  nextAttemptAt?: string;
  error?: ConnectorError;
}
export interface ConnectorCapability {
  id: CapabilityId;
  label: string;
  evidence: "documented" | "requires_validation";
  /** Disponibilidade na aplicação, distinta da existência na API externa. */
  available: boolean;
  limitation: string;
}
export interface OfficialDocumentation {
  label: string;
  url: string;
}
export interface ConnectorDefinition {
  id: PlatformId;
  name: string;
  description: string;
  accountRequirement: string;
  availabilityMessage: string;
  capabilities: readonly ConnectorCapability[];
  permissions: readonly string[];
  approvals: readonly string[];
  documentation: readonly OfficialDocumentation[];
  reviewedAt: string;
}
export interface ConnectionSnapshot {
  platform: PlatformId;
  authorization: AuthorizationState;
  synchronization: SynchronizationState;
  metadata: ConnectionMetadata | null;
}
/** Contrato de um futuro adaptador no servidor. Não existe implementação nesta etapa. */
export interface PlatformConnector {
  definition: ConnectorDefinition;
  getSnapshot(connectionId: string): Promise<ConnectorResult<ConnectionSnapshot>>;
  getCapabilities(connectionId: string): Promise<ConnectorResult<readonly ConnectorCapability[]>>;
  revoke(connectionId: string): Promise<ConnectorResult<void>>;
}
