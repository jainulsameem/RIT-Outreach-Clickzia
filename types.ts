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

export interface Business {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  profileStatus?: 'claimed' | 'unclaimed' | 'unknown';
  source?: 'google' | 'facebook';
}

// Fix: Update GroundingChunk to support both 'maps' and 'web' source types.
export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets: {
        uri: string;
        title: string;
        snippet: string;
      }[];
    }[];
  };
  web?: {
    uri: string;
    title: string;
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