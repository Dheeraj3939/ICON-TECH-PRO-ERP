/**
 * Technical Evaluation & Site Visit Types for ICON TECH PRO ERP V9.2
 */

export const SITE_VISIT_PROJECT_CATEGORIES = [
  'Networking Solutions',
  'Video Conferencing Solutions',
  'Home Theater Solutions',
  'CCTV & Surveillance',
  'IT Infrastructure',
  'Audio-Visual Solutions',
  'Other Projects',
] as const;

export type SiteVisitProjectCategory = (typeof SITE_VISIT_PROJECT_CATEGORIES)[number];

export const TECHNICAL_EVALUATION_STATUSES = [
  'Draft',
  'Submitted',
  'Reviewed',
  'Revision Required',
  'Closed',
] as const;

export type TechnicalEvaluationStatus = (typeof TECHNICAL_EVALUATION_STATUSES)[number];

export interface TechnicalRecommendedItem {
  id: string;
  brand: string;
  model: string;
  specifications: string;
  quantity: number;
  unit: string;
  estimated_unit_price?: number;
  hsn_sac?: string;
  gst_rate?: number;
  notes?: string;
  is_selected_for_quote?: boolean;
}

export interface TechnicalAttachment {
  id: string;
  name: string;
  file_url: string;
  mime_type: string;
  size_bytes?: number;
  uploaded_at: string;
  uploaded_by: string;
  category: 'PHOTO' | 'MEASUREMENT_DRAWING' | 'SCHEMATIC' | 'SPEC_SHEET' | 'OTHER';
}

export interface TechnicalEvaluationRevision {
  revision_number: number;
  revised_at: string;
  revised_by_name: string;
  change_summary: string;
  previous_status: TechnicalEvaluationStatus;
}

export interface TechnicalEvaluation {
  id: string;
  evaluation_number: string; // e.g., TE-2026-0001
  version: number;
  status: TechnicalEvaluationStatus;
  
  // Section A: Reference Information
  customer_id: string;
  customer_name: string;
  company_name?: string;
  enquiry_id?: string;
  enquiry_number?: string;
  site_visit_id?: string;
  site_visit_number?: string;
  project_category: SiteVisitProjectCategory;
  other_project_description?: string;
  evaluation_date: string;
  evaluated_by_id: string;
  evaluated_by_name: string;
  assigned_technical_employee_id?: string;
  assigned_technical_employee_name?: string;

  // Section B: Customer Requirements
  stated_requirement: string;
  project_objectives?: string;
  number_of_rooms?: number;
  room_or_endpoint_locations?: string;
  expected_capacity_usage?: string;
  commercial_budget_constraints?: string;

  // Section C: Existing Infrastructure
  existing_equipment_details?: string;
  network_infrastructure?: string;
  electrical_power_availability?: string;
  cabling_conduits_status?: string;
  rack_mounting_arrangements?: string;
  compatibility_requirements?: string;

  // Section D: Technical Observations
  site_measurements?: string;
  physical_constraints?: string;
  technical_limitations?: string;
  existing_infrastructure_issues?: string;
  photographs_and_drawings?: TechnicalAttachment[];

  // Section E: Proposed Technical Solution
  recommended_items: TechnicalRecommendedItem[];
  system_architecture_summary?: string;
  connectivity_matrix?: string;
  required_accessories?: string;
  cabling_installation_scope?: string;
  configuration_commissioning_scope?: string;

  // Section F: Risks and Dependencies
  technical_risks?: string;
  installation_limitations?: string;
  civil_electrical_dependency?: string;
  third_party_dependencies?: string;
  customer_responsibilities?: string;
  unconfirmed_specifications?: string;

  // Section G: Recommendations & Remarks
  proposed_solution_summary: string;
  alternative_options?: string;
  technical_recommendations?: string;
  internal_engineer_remarks?: string; // Strictly internal - NOT exported to quotation

  // Section H: Review and Audit History
  submitted_at?: string;
  submitted_by_name?: string;
  reviewed_at?: string;
  reviewed_by_name?: string;
  review_notes?: string;
  revision_requested_at?: string;
  revision_requested_by_name?: string;
  revision_notes?: string;
  closed_at?: string;
  closed_by_name?: string;
  revisions?: TechnicalEvaluationRevision[];

  created_at: string;
  updated_at: string;
}

export type CreateTechnicalEvaluationPayload = Omit<
  TechnicalEvaluation,
  'id' | 'evaluation_number' | 'version' | 'status' | 'created_at' | 'updated_at' | 'revisions'
> & {
  status?: TechnicalEvaluationStatus;
};
