export const PERMISSIONS = {
  CUSTOMERS_MANAGE: 'customers:manage',
  ORDERS_CHECKIN: 'orders:checkin',
  ORDERS_DIAGNOSIS: 'orders:diagnosis',
  ORDERS_VIEW_ALL: 'orders:view_all',
  BUDGETS_MANAGE: 'budgets:manage',
  FINANCIAL_CASHFLOW: 'financial:cashflow',
  FINANCIAL_DRE: 'financial:dre',
  USERS_MANAGE: 'users:manage',
  FINANCIAL_MANAGE: 'financial:manage',
} as const;

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: Object.values(PERMISSIONS),
  RECEPTIONIST: [
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.ORDERS_CHECKIN,
    PERMISSIONS.ORDERS_VIEW_ALL,
    PERMISSIONS.BUDGETS_MANAGE,
    PERMISSIONS.FINANCIAL_CASHFLOW,
  ],
  MECHANIC: [
    PERMISSIONS.ORDERS_DIAGNOSIS,
  ],
};