export type UserRole = 'Admin' | 'Supervisor' | 'User';

export type PenaltyStatus = 'None' | 'Warning' | 'Restricted_Temp' | 'Restricted_1_Week';

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  penalty_status: PenaltyStatus;
  restriction_end_date: string | null;
}

export type LabLocation = 'ICT Lab 1' | 'ICT Lab 2';

export type ItemStatus = 'Available' | 'Borrowed' | 'Damaged' | 'Maintenance';

export type ItemCondition = 'Good' | 'Damaged';

export type BorrowingType = 'Habis Pakai' | 'Used' | 'Loan';

export interface InventoryItem {
  item_id: string;
  item_name: string;
  brand: string;
  qty: number;
  min_qty_alert: number;
  location: LabLocation;
  location_detail: string;
  item_detail: string;
  variant: string;
  status: ItemStatus;
  condition: ItemCondition;
  date_added: string;
  borrowing_type: BorrowingType;
}

export type TransactionType = 'Direct_Borrow' | 'Reservation';

export type TransactionStatus =
  | 'Pending_Approval'
  | 'Approved'
  | 'Rejected'
  | 'In_Queue'
  | 'Ready_for_Pickup'
  | 'Picked_Up'
  | 'Returned'
  | 'Overdue'
  | 'Issue_Reported';

export interface BorrowingTransaction {
  ticket_id: string; // PGE-XXXX
  user_id: string;
  transaction_type: TransactionType;
  purpose: string;
  borrow_date: string;
  duration: string;
  expected_return_date: string | null;
  status: TransactionStatus;
  approved_by: string | null;
  rejection_reason: string | null;
  // Return proof metadata
  return_proof_url?: string | null;
  return_notes?: string | null;
  return_requested_at?: string | null;
  is_return_pending?: boolean;
  return_rejection_note?: string | null;
  returned_at?: string | null;
  received_by?: string | null;
  returned_condition?: ReturnedCondition | null;
  resolution_status?: ResolutionStatus | null;
  penalty?: string | null;
  // Joins
  user_name?: string;
  user_email?: string;
  items?: TransactionItemDetail[];
}

export interface TransactionItemDetail {
  id: string;
  ticket_id: string;
  item_id: string;
  qty_borrowed: number;
  borrowing_type: BorrowingType;
  item_name?: string;
  brand?: string;
  location?: LabLocation;
}

export type ReturnedCondition = 'Good' | 'Damaged_Light' | 'Damaged_Medium' | 'Damaged_Heavy' | 'Lost';

export type ResolutionStatus = 'Resolved' | 'Not_Resolved';

export interface ReturnPenaltyRecord {
  return_id: string;
  ticket_id: string;
  return_date: string;
  returned_condition: ReturnedCondition;
  is_late: number; // 0 or 1
  late_days: number;
  penalty_type: string;
  resolution_status: ResolutionStatus;
  received_by: string;
}

export type HistoryActionType = 'Stock_In' | 'Stock_Out' | 'Returned' | 'Transferred' | 'Edited' | 'Damaged';

export interface TransactionHistoryRecord {
  log_id: string;
  item_id: string;
  action_type: HistoryActionType;
  qty_changed: number;
  timestamp: string;
  performed_by: string;
  item_name?: string;
  performer_name?: string;
}

export interface AuthGateResult {
  success: boolean;
  code?: 'INVALID_DOMAIN' | 'NOT_WHITELISTED' | 'RESTRICTED' | 'SUCCESS';
  message: string;
  user?: User;
}
