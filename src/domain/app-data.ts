import type {
  AccountInfo,
  BankRecord,
  Group,
  GroupMembership,
  Season,
  Settlement,
  SettlementRow,
  User,
  WorkoutPost,
} from "./models";

export interface OunwanAppData {
  currentUserId: string;
  currentGroupId: string;
  currentSeasonId: string;
  users: User[];
  group: Group;
  membership: GroupMembership;
  season: Season;
  posts: WorkoutPost[];
  settlement: Settlement;
  settlementRows: SettlementRow[];
  bankRecords: BankRecord[];
  accountInfo: AccountInfo;
}
