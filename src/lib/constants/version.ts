/**
 * ICON TECH PRO ERP — Single Source of Truth for Application Version & Release Metadata
 *
 * Current Authoritative Release: V9.2 Enterprise Release
 */

export const ERP_SYSTEM_VERSION = {
  version: '9.2',
  versionLabel: 'v9.2',
  semver: '9.2.0',
  releaseName: 'V9.2 Enterprise Release',
  shortTitle: 'ICON TECH PRO ERP v9.2',
  brandWithVersion: 'ICON TECH PRO ERP v9.2',
  fullTitle: 'ICON TECH PRO ERP V9.2 Enterprise Release',
  company: 'ICON TECH PRO',
  entityId: 'ORG-ICON-01',
  environment: 'ENTERPRISE PRODUCTION',
  releaseDate: '2026-09-28',
  status: 'PRODUCTION_VERIFIED',
  engines: {
    turnkeyEngine: 'Turnkey Execution Engine',
    turnkeyEngineVersion: 'v9.2',
    resellerPricingEngine: 'V9.2 Reseller & Margin Engine',
    aiOrchestrator: 'V9.2 Multi-Agent Orchestrator (15 Agents)',
  },
} as const;

export type ERPSystemVersion = typeof ERP_SYSTEM_VERSION;
