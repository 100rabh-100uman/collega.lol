import { Prisma } from "@prisma/client";
import { prisma } from "@/core/db/prisma";

export interface RecordAuditLogParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Sanitizes metadata to guarantee that no secret credentials, auth tokens,
   * passwords, or private hashes are ever logged.
   */
  private static sanitizeMetadata(
    metadata?: Record<string, unknown> | null
  ): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;

    const sensitiveKeyPatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /codeHash/i,
      /tokenHash/i,
      /authorization/i,
      /cookie/i,
      /sessionToken/i,
    ];

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
        sanitized[key] = "[REDACTED]";
      } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as Prisma.InputJsonValue;
  }

  /**
   * Persists an audit log record.
   * If a Prisma TransactionClient (`tx`) is provided, writes within that transaction
   * to ensure atomic consistency with the underlying state change.
   * Safely handles ephemeral staff tokens or in-memory dev identities by recording them
   * in metadata if no matching User row exists.
   */
  static async record(
    params: RecordAuditLogParams,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    let validActorId: string | null = null;
    const effectiveMetadata: Record<string, unknown> = params.metadata
      ? { ...params.metadata }
      : {};

    if (params.actorId) {
      try {
        const userExists = await client.user.findUnique({
          where: { id: params.actorId },
          select: { id: true },
        });
        if (userExists) {
          validActorId = userExists.id;
        } else {
          validActorId = null;
          effectiveMetadata._actorRef = params.actorId;
        }
      } catch {
        validActorId = null;
        effectiveMetadata._actorRef = params.actorId;
      }
    }

    const sanitizedMetadata = this.sanitizeMetadata(effectiveMetadata);

    return client.auditLog.create({
      data: {
        actorId: validActorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: sanitizedMetadata,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  }
}
