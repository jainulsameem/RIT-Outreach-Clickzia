

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface GeolocationState {
  loading: boolean;
  error: GeolocationPositionError | { code: number; message: string; PERMISSION_DENIED: number; POSITION_UNAVAILABLE: number; TIMEOUT: number; } | null;
  coords: Coords | null;
}

export interface Settings {
  fromName: string;
  fromEmail: string;
  outreachTopic: string;
  emailSignature: string;
}

export type SearchSource = 'google' | 'facebook' | 'linkedin' | 'custom';

export interface Business {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  profileStatus?: 'claimed' | 'unclaimed' | 'unknown';
  source?: SearchSource;
  customSourceDetails?: string; // For manual leads (e.g., "Referral", "Networking Event")
  contactName?: string;
  contactRole?: string;
  linkedinUrl?: string;
}

// Fix: Update GroundingChunk to support both 'maps' and 'web' source types.
export interface GroundingChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: {
        uri?: string;
        title?: string;
        snippet?: string;
      }[];
    }[];
  };
  web?: {
    uri?: string;
    title?: string;
  };
}

export type LeadStatus = 'New' | 'Contacted' | 'Interested' | 'Follow-up' | 'Not Interested' | 'Converted';

export const leadStatuses: LeadStatus[] = ['New', 'Contacted', 'Interested', 'Follow-up', 'Not Interested', 'Converted'];

export interface Activity {
  id: string;
  type: 'note' | 'email' | 'status_change' | 'created' | 'assignment';
  content: string;
  timestamp: string; // ISO string
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  password?: string;
}

export interface CrmContact extends Business {
  status: LeadStatus;
  activities: Activity[];
  assignedTo?: string; // userId
}

// New types for advanced filtering
export type DateFilterType = 'any' | 'today' | 'week' | 'month' | 'custom';

export interface CrmFilters {
  status: LeadStatus | 'All';
  assignee: string; // 'all', 'me', 'unassigned', or a userId
  date: {
    type: DateFilterType;
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
  };
  sortOrder: 'newest' | 'oldest';
}

export type ProfileStatus = 'all' | 'claimed' | 'unclaimed';

// New: Shared SearchParams type
export interface SearchParams {
  industry: string;
  keywords: string;
  location: string;
  source: SearchSource;
  profileStatus: ProfileStatus;
  numberOfResults: number;
}

// --- TIME TRACKING TYPES ---

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string; // 'break' if it's a break
  taskName: string;
  startTime: string; // ISO
  endTime: string | null; // ISO, null if active
  type: 'work' | 'break';
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; // Deprecated in favor of WeeklyTimesheet status, but kept for individual tracking if needed
}

export interface WeeklyTimesheet {
    id: string; // Composite: userId-startDate(YYYY-MM-DD)
    userId: string;
    weekStartDate: string; // Monday's date
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    submittedAt?: string;
    approvedAt?: string;
    totalHours: number;
}

export type LeaveType = 'Emergency' | 'Casual' | 'Festival' | 'Sick' | 'Unpaid';

export interface TimeOffRequest {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SalaryConfig {
    userId: string;
    baseSalary: number; // Monthly
    currency: string;
}

export interface TimeAdminSettings {
  minDailyHours: number;
  minWeeklyHours: number;
  leaveBalances: Record<LeaveType, number>; // Total allowed days per year
}
