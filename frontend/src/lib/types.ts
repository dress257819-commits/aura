// Hand-written mirrors of the backend Pydantic models (backend/models/models.py).
// Nothing infers across the Python boundary — keep these in sync in the same edit.

export interface MusicTrack {
  title: string;
  artist: string;
  url: string;
}

export interface Appearance {
  theme: string;
  font: string;
  accent: string;
  card_style: string;
  glass: number;
  effects: boolean;
  custom_css: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  name: string;
  bio: string;
  location: string;
  avatar_url: string;
  cover_url: string;
  interests: string[];
  daily_question: string;
  music: MusicTrack[];
  appearance: Appearance;
  plan: string;
  created_at: string;
}

export interface MeProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  bio: string;
  location: string;
  avatar_url: string;
  cover_url: string;
  interests: string[];
  daily_question: string;
  music: MusicTrack[];
  appearance: Appearance;
  chatbot?: ChatbotSettings;
  leaderboard_visible: boolean;
  plan: string;
  created_at: string;
}

export interface ChatbotSettings {
  enabled: boolean;
  name: string;
  tone: "witty" | "professional" | "genz" | "whimsical";
  greeting: string;
  boundaries: string[];
  instructions: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  name: string;
  avatar_url: string;
  interactions: number;
  profile_views: number;
  link_clicks: number;
  poll_votes: number;
  followers: number;
}

export interface LeaderboardResponse {
  period_days: number;
  entries: LeaderboardEntry[];
}

export interface Link {
  id: string;
  user_id: string;
  platform: string;
  title: string;
  url: string;
  description: string;
  thumbnail_url: string;
  icon_url: string;
  sort_order: number;
  clicks: number;
  active: boolean;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  user_id: string;
  url: string;
  caption: string;
  created_at: string;
}

export type MessageStatus = "pending" | "published" | "rejected";

export interface Message {
  id: string;
  recipient_id: string;
  recipient_username: string;
  content: string;
  sender_name: string;
  status: MessageStatus;
  answer: string;
  favorite: boolean;
  visitor_id: string;
  created_at: string;
}

export interface MessageCounts {
  pending: number;
  total: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  user_id: string;
  question: string;
  options: PollOption[];
  active: boolean;
  created_at: string;
}

export interface ProfileBundle {
  profile: PublicProfile;
  links: Link[];
  gallery: GalleryItem[];
  poll: Poll | null;
  qa: Message[];
  followers: number;
  following: boolean;
}

export interface DaySeriesPoint {
  date: string;
  views: number;
  clicks: number;
  messages: number;
}

export interface TopLink {
  id: string;
  title: string;
  clicks: number;
}

export interface AnalyticsSummary {
  totals: Record<string, number>;
  days: DaySeriesPoint[];
  top_links: TopLink[];
  followers: number;
  messages_pending: number;
  chat_messages: number;
}

export interface PlanInfo {
  key: string;
  name: string;
  price: number;
  nepal_price?: number;
  tagline: string;
  features: string[];
  promotion_active?: boolean;
  promotion_ends_at?: string | null;
}

export interface BillingOptions {
  international: { stripe: boolean };
  nepal: { esewa: boolean; khalti: boolean };
}

export interface CheckoutResponse {
  payment_id: string;
  provider: "stripe" | "esewa" | "khalti";
  checkout_url: string;
  form_fields: Record<string, string>;
}

export interface ExploreCard {
  username: string;
  name: string;
  avatar_url: string;
  cover_url: string;
  bio: string;
  interests: string[];
  followers: number;
  following: boolean;
  plan: string;
  theme: string;
}

export interface FollowState {
  following: boolean;
  followers: number;
}
