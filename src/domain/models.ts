export type Role = "admin" | "treasurer" | "member";

export type GroupVisibility = "private" | "public";

export interface User {
  id: string;
  kakaoId: string;
  name: string;
  avatarColor: string;
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

export interface Season {
  id: string;
  groupId: string;
  name: string;
  startDate: string;
  endDate?: string;
  targetWorkoutCountPerWeek: number;
  finePerMiss: number;
  status: "active" | "closed";
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

export interface BankRecord {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdAt: string;
  memo?: string;
  imageUrl: string;
}

export interface AccountInfo {
  groupId: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
}
