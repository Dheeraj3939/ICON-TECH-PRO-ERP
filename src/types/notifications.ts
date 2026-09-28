export type NotificationCategory =
  | 'AMC_EXPIRY'
  | 'QUOTATION_APPROVAL'
  | 'PAYMENT_RECEIVED'
  | 'FOLLOW_UP'
  | 'DOCUMENT_EXPIRY'
  | 'INTEGRATION_ALERT'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface EnterpriseNotification {
  id: string;
  user_role?: string;
  user_id?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  is_read: boolean;
  priority: NotificationPriority;
  created_at: string;
}
