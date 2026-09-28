'use server';

import { DEMO_FEATURES } from '@/lib/registry/demo-features';
import type { DemoFeatureRegistryItem } from '@/types/hr';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DEMO_FEATURE_STORE__: DemoFeatureRegistryItem[] | undefined;
}

function getFeatureStore(): DemoFeatureRegistryItem[] {
  if (!globalThis.__ICON_DEMO_FEATURE_STORE__) {
    globalThis.__ICON_DEMO_FEATURE_STORE__ = [...DEMO_FEATURES];
  }
  return globalThis.__ICON_DEMO_FEATURE_STORE__;
}

/**
 * Retrieve all registered demo features with optional module or status filter.
 */
export async function getDemoFeatures(filters?: {
  module?: string;
  status?: string;
}): Promise<DemoFeatureRegistryItem[]> {
  let list = getFeatureStore();
  if (filters?.module && filters.module !== 'ALL') {
    list = list.filter((f) => f.module === filters.module);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((f) => f.status === filters.status);
  }
  return list;
}

/**
 * Register a new feature dynamically into the Demo Updates registry.
 */
export async function registerDemoFeature(
  feature: Omit<DemoFeatureRegistryItem, 'last_updated'>
): Promise<DemoFeatureRegistryItem> {
  const store = getFeatureStore();
  const existingIdx = store.findIndex((f) => f.id === feature.id);

  const updated: DemoFeatureRegistryItem = {
    ...feature,
    last_updated: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    store[existingIdx] = updated;
  } else {
    store.unshift(updated);
  }

  return updated;
}
