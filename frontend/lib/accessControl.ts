// frontend/lib/accessControl.ts

export const USER_TYPES = {
  GENERAL:  "GENERAL",
  ACCOUNTS: "ACCOUNTS",
  PURCHASE: "PURCHASE",
  STORES:   "STORES",
  HOD:      "HOD",
  ADMIN:    "ADMIN",
  APPROVER: "APPROVER",
} as const;

// ✅ Derive type AFTER USER_TYPES is declared
export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

// ✅ Guard defined AFTER UserType exists
const isUserType = (value: string): value is UserType =>
  (Object.values(USER_TYPES) as string[]).includes(value);

export const ACCESS_RULES = {
  MASTER_MENU:      [USER_TYPES.ADMIN, USER_TYPES.PURCHASE],
  USER_MASTER:      [USER_TYPES.ADMIN],
  ACCOUNTS_PAY:     [USER_TYPES.ADMIN, USER_TYPES.ACCOUNTS],
  RELEASE_PO:       [USER_TYPES.ADMIN, USER_TYPES.PURCHASE],
  STORES_GRN:       [USER_TYPES.ADMIN, USER_TYPES.STORES, USER_TYPES.PURCHASE, USER_TYPES.HOD, USER_TYPES.GENERAL, USER_TYPES.APPROVER],
  GENERAL_ALL:      [USER_TYPES.GENERAL],
  APPROVER_ALL:     [USER_TYPES.APPROVER],
  GP_CREATE:        [USER_TYPES.ADMIN, USER_TYPES.GENERAL, USER_TYPES.HOD, USER_TYPES.PURCHASE, USER_TYPES.STORES, USER_TYPES.ACCOUNTS, USER_TYPES.APPROVER],
  GP_HOD_APPROVE:   [USER_TYPES.ADMIN, USER_TYPES.HOD],
  GP_STORES_VERIFY: [USER_TYPES.ADMIN, USER_TYPES.STORES, USER_TYPES.PURCHASE],
  GP_ADMIN_APPROVE: [USER_TYPES.ADMIN, USER_TYPES.APPROVER],
} as const;

export const hasAccess = (
  userType: string | null,
  permission: keyof typeof ACCESS_RULES
): boolean => {
  if (!userType) return false;
  const normalizedUserType = userType.toUpperCase();
  if (!isUserType(normalizedUserType)) return false;
  // ✅ Cast needed because ACCESS_RULES is `as const` (readonly tuple types)
  return (ACCESS_RULES[permission] as readonly string[]).includes(normalizedUserType);
};