// frontend/src/contexts/SubscriptionContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, useAuth } from './AuthContext';

export interface SubscriptionEntitlements {
  isLocked: boolean;
  allowFiscalEmission: boolean;
  maxMonthlyInvoices: number;
  invoicesUsedThisMonth: number;
  invoicesRemaining: number;
  maxUsers: number;
  usersCount: number;
}

export interface WorkshopSubscription {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELED';
  billingCycle: 'MONTHLY' | 'YEARLY';
  trialEndsAt: string;
  trialDaysLeft: number;
  currentPeriodEnd?: string | null;
  planId?: string | null;
  plan?: {
    id: string;
    slug: string;
    name: string;
    allowFiscalEmission: boolean;
    maxMonthlyInvoices: number;
    maxUsers: number;
  } | null;
  entitlements: SubscriptionEntitlements;
}

interface SubscriptionContextType {
  subscription: WorkshopSubscription | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  isLocked: boolean;
  allowFiscalEmission: boolean;
  isFiscalQuotaExceeded: boolean;
  invoiceUsagePct: number;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  loading: false,
  refreshSubscription: async () => {},
  isLocked: false,
  allowFiscalEmission: false,
  isFiscalQuotaExceeded: false,
  invoiceUsagePct: 0,
});

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<WorkshopSubscription | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSubscription = useCallback(async () => {
    if (!user || (user.role as string) === 'SUPER_ADMIN') {
      setSubscription(null);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/billing/my-subscription');
      setSubscription(data);
    } catch {
      // Silencioso para não travar o login se houver instabilidade momentânea
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const ent = subscription?.entitlements;
  const isLocked = Boolean(ent?.isLocked);
  const allowFiscalEmission = Boolean(ent?.allowFiscalEmission);
  const maxInvoices = ent?.maxMonthlyInvoices || 0;
  const usedInvoices = ent?.invoicesUsedThisMonth || 0;
  const isFiscalQuotaExceeded = allowFiscalEmission && maxInvoices > 0 && usedInvoices >= maxInvoices;
  const invoiceUsagePct =
    maxInvoices > 0 ? Math.min(100, Math.round((usedInvoices / maxInvoices) * 100)) : 0;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        refreshSubscription,
        isLocked,
        allowFiscalEmission,
        isFiscalQuotaExceeded,
        invoiceUsagePct,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);