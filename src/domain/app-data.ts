import type {
  AccountInfo,
  AdminGroupMember,
  BankRecord,
  Group,
  GroupMembership,
  NotificationPage,
  UserGroupMembership,
  Season,
  SeasonParticipant,
  Settlement,
  SettlementRow,
  SettlementSummary,
  User,
  WeeklyUserWorkoutStatus,
  WorkoutPost,
} from "./models";

export interface OunwanAppData {
  currentUserId: string;
  currentGroupId: string;
  currentSeasonId?: string;
  currentUser: User;
  approvedGroups: UserGroupMembership[];
  adminGroupMembers: AdminGroupMember[];
  users: User[];
  group: Group;
  membership: GroupMembership;
  season?: Season;
  seasons: Season[];
  seasonParticipants: SeasonParticipant[];
  posts: WorkoutPost[];
  weeklyUserWorkoutStatus?: WeeklyUserWorkoutStatus;
  settlement?: Settlement;
  settlementSummaries: SettlementSummary[];
  settlementRows: SettlementRow[];
  bankRecords: BankRecord[];
  accountInfo: AccountInfo;
  notifications: NotificationPage;
}
