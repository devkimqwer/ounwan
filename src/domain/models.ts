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
  likeCount: number;
  likedByCurrentUser: boolean;
  likeUserIds: string[];
  commentCount: number;
  comments: PostComment[];
  media: PostMedia[];
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

export interface SettlementRow {
  settlementId: string;
  userId: string;
  validWorkoutCount: number;
  missedCount: number;
  autoFineAmount: number;
  finalFineAmount: number;
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
