export type UATRoleId =
  | 'MD'
  | 'ADMIN_BDM'
  | 'SALES_VINEET'
  | 'SALES_RESHMA'
  | 'ACCOUNTS_HEMALATH'
  | 'OFFICE_MANISHA';

export type UATStatus = 'NOT_TESTED' | 'PASS' | 'FAIL' | 'NA';
export type UATPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type UATApproval = 'APPROVED' | 'APPROVED_WITH_CHANGES' | 'NOT_APPROVED' | 'PENDING';

export interface UATTestDefinition {
  id: string;
  roleId: UATRoleId;
  roleName: string;
  userName: string;
  userEmail: string;
  department: string;
  module: string;
  page: string;
  routeUrl: string;
  workflow: string;
  category: string;
  action: string;
  expectedResult: string;
  defaultPriority: UATPriority;
  defaultActualResult?: string;
  defaultStatus?: UATStatus;
}

export interface UATItemState {
  status: UATStatus;
  actualResult: string;
  priority: UATPriority;
  issue: string;
  suggestion: string;
  screenshotRef?: string;
  reviewerName: string;
  testedAt?: string;
}

export interface UATRoleReview {
  whatWorkedWell: string;
  whatIsDifficult: string;
  whatIsMissing: string;
  whatShouldBeChanged: string;
  securityConcern: string;
  calculationConcern: string;
  performanceConcern: string;
  dailyUseRecommendation: string;
  finalApprovalStatus: UATApproval;
  signedByName: string;
  signedAt: string;
}

export interface UATRoleSummary {
  roleId: UATRoleId;
  roleName: string;
  userName: string;
  userEmail: string;
  department: string;
  badgeColor: string;
  primaryFocus: string;
  permittedModules: string[];
  restrictedBoundaries: string[];
  loginLink: string;
}

export interface UATAuditStorage {
  version: string;
  updatedAt: string;
  items: Record<string, UATItemState>;
  reviews: Record<string, UATRoleReview>;
}
