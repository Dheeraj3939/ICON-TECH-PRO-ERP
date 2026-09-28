/**
 * ICON TECH PRO ERP V9.2 — Demo & Training Mode Governance
 *
 * Invariants:
 * - Default in production is strictly FALSE (Production Mode).
 * - When FALSE, no demo banners, canonical chains, or demo touchpoints are displayed.
 * - Only authorized administrators (Managing Director, Admin / BDM) may enable Demo Mode via Settings.
 */

export const DEMO_MODE_COOKIE_NAME = 'icon_demo_mode_active';

export interface DemoModeState {
  isActive: boolean;
  activatedBy?: string;
  activatedAt?: string;
  environment: string;
}

/**
 * Check if Demo Mode is currently active in the given cookie string or environment.
 * Strictly defaults to false in standard production.
 */
export function isDemoModeEnabled(cookieHeader?: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes(DEMO_MODE_COOKIE_NAME + '=true');
}
