export interface Group {
  id: number;
  name: string;
  invite_code: string;
  member_count?: number;
}

export interface GroupMember {
  id: number;
  username: string;
  name: string;
}

export interface GroupTripSummary {
  id: number;
  name: string;
  peak_name: string;
  status: string;
  date_start: string;
  owner_username: string;
  is_owner: boolean;
  lat?: number | null;
  lon?: number | null;
  gpx_filename?: string | null;
  gpx_profile_json?: string | null;
}

export interface GroupDetail extends Group {
  created_by: number;
  members: GroupMember[];
  trips: GroupTripSummary[];
}

export interface ShareTripInput {
  trip_id: number;
}

export interface ActivityPeriodStats {
  distance_km: number;
  elevation_gain_m: number;
  duration_min: number;
}

export interface GroupActivityStats {
  month: ActivityPeriodStats;
  year: ActivityPeriodStats;
}

export interface TripParticipantEntry {
  id: number;
  username: string;
  name: string;
  status: 'joined' | 'declined' | null;
}

export interface TripParticipantsResponse {
  joined_count: number;
  total: number;
  members: TripParticipantEntry[];
}
