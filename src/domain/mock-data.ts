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

export const CURRENT_USER_ID = "user-1";
export const CURRENT_GROUP_ID = "group-ounwan";
export const CURRENT_SEASON_ID = "season-2026-3";

export const users: User[] = [
  { id: "user-1", kakaoId: "kakao-1", name: "김지수", avatarColor: "#5e4ea5" },
  { id: "user-2", kakaoId: "kakao-2", name: "박은영", avatarColor: "#8b5cf6" },
  { id: "user-3", kakaoId: "kakao-3", name: "이철수", avatarColor: "#f59e0b" },
  { id: "user-4", kakaoId: "kakao-4", name: "최민준", avatarColor: "#3b82f6" },
  { id: "user-5", kakaoId: "kakao-5", name: "정수아", avatarColor: "#ec4899" },
  { id: "user-6", kakaoId: "kakao-6", name: "한태양", avatarColor: "#10b981" },
];

export const groups: Group[] = [
  {
    id: CURRENT_GROUP_ID,
    name: "오운완",
    visibility: "private",
    ownerUserId: CURRENT_USER_ID,
  },
];

export const memberships: GroupMembership[] = [
  { groupId: CURRENT_GROUP_ID, userId: "user-1", roles: ["admin", "treasurer"], joinedAt: "2026-08-01" },
  { groupId: CURRENT_GROUP_ID, userId: "user-2", roles: ["member"], joinedAt: "2026-08-01" },
  { groupId: CURRENT_GROUP_ID, userId: "user-3", roles: ["member"], joinedAt: "2026-08-01" },
  { groupId: CURRENT_GROUP_ID, userId: "user-4", roles: ["member"], joinedAt: "2026-08-05" },
  { groupId: CURRENT_GROUP_ID, userId: "user-5", roles: ["member"], joinedAt: "2026-08-18" },
  { groupId: CURRENT_GROUP_ID, userId: "user-6", roles: ["member"], joinedAt: "2026-08-10" },
];

export const seasons: Season[] = [
  {
    id: CURRENT_SEASON_ID,
    groupId: CURRENT_GROUP_ID,
    name: "2026 시즌 3",
    startDate: "2026-08-01",
    targetWorkoutCountPerWeek: 3,
    finePerMiss: 5000,
    status: "active",
  },
];

export const posts: WorkoutPost[] = [
  {
    id: "post-1",
    groupId: CURRENT_GROUP_ID,
    seasonId: CURRENT_SEASON_ID,
    userId: "user-1",
    workoutDate: "2026-08-18",
    createdAt: "2026-08-18T07:32:00+09:00",
    content: "오늘도 달렸다. 5km 완주.",
    workoutType: "러닝",
    isInvalid: false,
    likeCount: 4,
    likedByCurrentUser: false,
    likeUserIds: ["user-2", "user-3", "user-4", "user-5"],
    commentCount: 2,
    comments: [
      { id: "comment-1", postId: "post-1", userId: "user-2", content: "오오 5km 대단하다!", createdAt: "2026-08-18T08:10:00+09:00" },
      { id: "comment-2", postId: "post-1", userId: "user-3", content: "나도 오늘 달려야겠다", createdAt: "2026-08-18T09:22:00+09:00" },
    ],
    media: [
      {
        id: "media-1",
        postId: "post-1",
        type: "image",
        url: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&h=600&fit=crop&auto=format",
        sortOrder: 1,
      },
    ],
  },
  {
    id: "post-2",
    groupId: CURRENT_GROUP_ID,
    seasonId: CURRENT_SEASON_ID,
    userId: "user-2",
    workoutDate: "2026-08-18",
    createdAt: "2026-08-18T18:45:00+09:00",
    content: "상체 위주로 운동. 벤치프레스 개인 최고 기록.",
    workoutType: "헬스",
    isInvalid: false,
    likeCount: 6,
    likedByCurrentUser: true,
    likeUserIds: ["user-1", "user-3", "user-4", "user-5", "user-6", "user-7"],
    commentCount: 3,
    comments: [
      { id: "comment-3", postId: "post-2", userId: "user-1", content: "개인 최고 기록 축하!", createdAt: "2026-08-18T19:03:00+09:00" },
      { id: "comment-4", postId: "post-2", userId: "user-3", content: "상체 운동 멋지다", createdAt: "2026-08-18T19:15:00+09:00" },
      { id: "comment-5", postId: "post-2", userId: "user-4", content: "나도 다음엔 벤치 도전", createdAt: "2026-08-18T19:40:00+09:00" },
    ],
    media: [
      {
        id: "media-2",
        postId: "post-2",
        type: "image",
        url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=600&fit=crop&auto=format",
        sortOrder: 1,
      },
    ],
  },
  {
    id: "post-3",
    groupId: CURRENT_GROUP_ID,
    seasonId: CURRENT_SEASON_ID,
    userId: "user-5",
    workoutDate: "2026-08-15",
    createdAt: "2026-08-15T11:00:00+09:00",
    content: "수영장 1000m 완료",
    workoutType: "수영",
    isInvalid: true,
    invalidatedByUserId: "user-1",
    invalidatedAt: "2026-08-15T13:20:00+09:00",
    likeCount: 2,
    likedByCurrentUser: true,
    likeUserIds: ["user-1", "user-2"],
    commentCount: 0,
    comments: [],
    media: [
      {
        id: "media-3",
        postId: "post-3",
        type: "image",
        url: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&h=600&fit=crop&auto=format",
        sortOrder: 1,
      },
    ],
  },
];

export const settlement: Settlement = {
  id: "settlement-2026-08-10",
  groupId: CURRENT_GROUP_ID,
  seasonId: CURRENT_SEASON_ID,
  weekStartDate: "2026-08-10",
  weekEndDate: "2026-08-16",
  status: "draft",
};

export const settlementRows: SettlementRow[] = [
  { settlementId: settlement.id, userId: "user-1", validWorkoutCount: 4, missedCount: 0, autoFineAmount: 0, finalFineAmount: 0 },
  { settlementId: settlement.id, userId: "user-2", validWorkoutCount: 2, missedCount: 1, autoFineAmount: 5000, finalFineAmount: 5000 },
  { settlementId: settlement.id, userId: "user-3", validWorkoutCount: 1, missedCount: 2, autoFineAmount: 10000, finalFineAmount: 10000 },
  { settlementId: settlement.id, userId: "user-5", validWorkoutCount: 0, missedCount: 3, autoFineAmount: 15000, finalFineAmount: 15000 },
];

export const bankRecords: BankRecord[] = [
  {
    id: "bank-1",
    groupId: CURRENT_GROUP_ID,
    createdByUserId: CURRENT_USER_ID,
    createdAt: "2026-08-18T14:30:00+09:00",
    memo: "8월 2주차 결산 후 잔고 업데이트",
    imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&h=400&fit=crop&auto=format",
  },
];

export const accountInfo: AccountInfo = {
  groupId: CURRENT_GROUP_ID,
  bankName: "카카오뱅크",
  accountNumber: "3333-12-3456789",
  holderName: "김지수",
};

export function getUser(userId: string) {
  return users.find((user) => user.id === userId) ?? users[0];
}

export function getCurrentMembership() {
  return memberships.find(
    (membership) =>
      membership.groupId === CURRENT_GROUP_ID && membership.userId === CURRENT_USER_ID,
  );
}
