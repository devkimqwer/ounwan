import type { PostReactionType } from "./post-reactions";

export type Role = "admin" | "treasurer" | "member";

export type GroupVisibility = "private" | "public";

export interface User {
  id: string;
  publicId: string;
  kakaoId: string;
  name: string;
  avatarUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  visibility: GroupVisibility;
  ownerUserId: string;
}

export interface GroupMembership {
  groupId: string;
  userId: string;
  roles: Role[];
  joinedAt: string;
  leftAt?: string;
}

export interface UserGroupMembership {
  group: Group;
  membership: GroupMembership;
  leaveDelegateCandidates?: User[];
}

export type AdminGroupMemberStatus = "approved" | "pending";
export type AdminGroupMemberStatusFilter = "all" | AdminGroupMemberStatus;

export interface AdminGroupMember {
  id: string;
  status: AdminGroupMemberStatus;
  user: User;
  roles: Role[];
  isCurrentUser?: boolean;
  joinedAt?: string;
  leftAt?: string;
  requestedAt?: string;
  requestId?: string;
}



export interface AuthGroupSwitchOption {
  group: Group;
  membership: GroupMembership;
  hasActiveSeason: boolean;
  pendingSeason?: Season;
  isCurrent: boolean;
}
export interface PendingGroupJoinRequest {
  id: string;
  group: Group;
  requestedAt: string;
}
export interface GroupInvite {
  id: string;
  group: Group;
  createdByUser: User;
  inviteToken: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
  status: "active" | "disabled" | "expired";
}

export type DailyDuplicatePolicy = "count_once" | "count_all";

export interface Season {
  id: string;
  groupId: string;
  name: string;
  startDate: string;
  endDate?: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
  weekStartDay: number;
  dayStartTime: string;
  dailyDuplicatePolicy: DailyDuplicatePolicy;
  nextSettlementAt?: string;
  status: "pending" | "active" | "closed";
}

export interface SeasonParticipant {
  id: string;
  seasonId: string;
  user: User;
  startDate: string;
  endDate?: string;
}

export interface PostMedia {
  id: string;
  postId: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  sortOrder: number;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface PostReaction {
  userId: string;
  type: PostReactionType;
  createdAt: string;
}

export interface PostReactionSummary {
  type: PostReactionType;
  count: number;
}

export interface WorkoutPost {
  id: string;
  groupId: string;
  seasonId: string;
  userId: string;
  workoutDate: string;
  createdAt: string;
  content?: string;
  workoutType?: string;
  isInvalid: boolean;
  invalidatedByUserId?: string;
  invalidatedAt?: string;
  reactionCount: number;
  currentUserReactionTypes: PostReactionType[];
  reactionSummaries: PostReactionSummary[];
  reactions: PostReaction[];
  commentCount: number;
  comments: PostComment[];
  media: PostMedia[];
}

export interface WorkoutPostCursor {
  createdAt: string;
  id: string;
}

export interface WorkoutPostPage {
  posts: WorkoutPost[];
  nextCursor?: WorkoutPostCursor;
  hasMore: boolean;
}

export interface Settlement {
  id: string;
  groupId: string;
  seasonId: string;
  weekStartDate: string;
  weekEndDate: string;
  status: "draft" | "confirmed";
  confirmedAt?: string;
  comment?: string;
}

export interface SettlementSummary {
  id: string;
  groupId: string;
  seasonId: string;
  seasonName: string;
  weekStartDate: string;
  weekEndDate: string;
  status: "draft" | "confirmed";
  confirmedAt?: string;
  participantCount: number;
  finalFineAmountTotal: number;
}

export interface SettlementRow {
  settlementId: string;
  userId: string;
  validWorkoutCount: number;
  missedCount: number;
  autoFineAmount: number;
  finalFineAmount: number;
  dailyResults: SettlementDailyResults;
  memo?: string;
}

export type SettlementDailyResults = Record<string, SettlementDailyResult>;

export interface SettlementDailyResult {
  count: number;
  countedPostIds: string[];
}

export interface SettlementDetail extends Settlement {
  seasonName: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
  participantCount: number;
  autoFineAmountTotal: number;
  finalFineAmountTotal: number;
  adjustmentAmountTotal: number;
  days: string[];
  rows: SettlementRow[];
}
export interface MemberWorkoutStatus {
  groupId: string;
  currentUserId: string;
  seasonName?: string;
  today?: string;
  days: string[];
  members: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    dailyResults: SettlementDailyResults;
    validWorkoutCount: number;
  }>;
}

export interface WeeklyUserWorkoutStatus {
  weekStartDate: string;
  weekEndDate: string;
  targetWorkoutCount: number;
  validWorkoutCount: number;
  missedCount: number;
  finePerMiss: number;
  estimatedFineAmount: number;
}
export interface BankRecord {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdAt: string;
  memo?: string;
  imageUrl: string;
}


export type NotificationActionType = "post_detail" | "group_member_management" | "settlement_detail";

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  actionType?: NotificationActionType;
  actionTargetId?: string;
  groupId?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  unreadCount: number;
  nextOffset?: number;
}

export interface AccountInfo {
  groupId: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
}
