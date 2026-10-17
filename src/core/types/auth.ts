import type { UserRole, ShopRole } from "@prisma/client";

export interface AuthUser {
  id: string; // Supabase Auth UUID
  email: string;
  role: UserRole;
  campusId: string | null;
  isActive: boolean;
}

export interface ShopMembershipContext {
  shopId: string;
  role: ShopRole;
  isActive: boolean;
}

export interface SessionContext {
  user: AuthUser;
  shopMemberships: ShopMembershipContext[];
}
