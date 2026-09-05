import type {
  AccountInfo,
  AdminGroupMember,
  BankRecord,
  Group,
  GroupMembership,
  UserGroupMembership,
  Season,
  SeasonParticipant,
  Settlement,
  SettlementRow,
  User,
  WorkoutPost,
} from "./models";

export interface OunwanAppData {
  currentUserId: string;
  currentGroupId: string;
  currentSeasonId: string;
  currentUser: User;
  approvedGroups: UserGroupMembership[];
  adminGroupMembers: AdminGroupMember[];
  users: User[];
  group: Group;
  membership: GroupMembership;
  season: Season;
  seasons: Season[];
  seasonParticipants: SeasonParticipant[];
  posts: WorkoutPost[];
  settlement: Settlement;
  settlementRows: SettlementRow[];
  bankRecords: BankRecord[];
  accountInfo: AccountInfo;
}
