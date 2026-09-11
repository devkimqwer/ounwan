# Ounwan

친구들과 함께 운동 인증을 남기고, 시즌별 목표 달성 여부와 벌금을 관리하는 운동 인증 PWA입니다.

## 주요 기능

- 카카오 로그인 기반 사용자 인증
- 그룹 생성, 그룹 전환, 초대 링크, 참여 요청 승인/반려
- 시즌 생성과 대기중/진행중/종료 상태 관리
- 운동 인증 게시글 등록, 사진/영상 업로드, 상세 보기
- 게시글 좋아요, 댓글, 본인 게시글 삭제, 관리자 무효 처리
- 홈, 피드, 인증, 캘린더, 더보기 중심의 모바일 우선 화면
- 주간 운동 횟수와 예상 벌금 조회
- 주간 결산 데이터와 결산 완료 알림
- 계좌 정보와 통장 잔고 기록 관리
- 앱 내부 알림 목록, 읽음 처리, 삭제
- Web Push 구독과 푸시 알림 발송

## 기술 스택

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM / Drizzle Kit
- Kakao OAuth
- Web Push
- Sharp
- AWS S3 compatible storage

## 프로젝트 구조

```text
ounwan/
  src/app/                 Next.js App Router, 서버 액션, API 라우트
  src/auth/                카카오 OAuth와 세션 처리
  src/db/                  Drizzle schema, query, command, seed
  src/domain/              앱 도메인 타입과 데이터 모델
  src/features/app/        주요 PWA 화면 컴포넌트
  src/features/auth/       로그인 이후 그룹/프로필 온보딩 화면
  src/storage/             local/S3 저장소 어댑터
  public/                  PWA manifest, service worker, 정적 자산
  drizzle/                 DB migration 파일
```

## 환경 변수

`.env.example`을 기준으로 로컬 환경 파일(`.env.local`) 또는 배포 환경 파일(`.env.production.local`)을 구성합니다.

| 변수 | 설명 |
| --- | --- |
| `OUNWAN_APP_ORIGIN` | 앱의 외부 접근 주소 |
| `OUNWAN_AVATAR_API_URL` | 아바타 발급 API |
| `OUNWAN_STORAGE_PROVIDER` | `local` 또는 `s3` |
| `OUNWAN_S3_BUCKET` | S3/Object Storage bucket |
| `OUNWAN_S3_REGION` | S3 region |
| `OUNWAN_VAPID_PUBLIC_KEY` | Web Push 공개키 |
| `OUNWAN_VAPID_PRIVATE_KEY` | Web Push 개인키 |
| `OUNWAN_VAPID_SUBJECT` | Web Push VAPID subject |
| `POSTGRES_HOST` | PostgreSQL Host |
| `POSTGRES_PORT` | PostgreSQL Port |
| `POSTGRES_DB` | PostgreSQL Databaese 이름 |
| `POSTGRES_USER` | PostgreSQL ID |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 |
| `KAKAO_REDIRECT_URI` | Kakao redirect URI, 미설정 시 앱 origin 기준 자동 생성 |
| `KAKAO_REST_API_KEY` | Kakao REST API key |
| `KAKAO_CLIENT_SECRET` | Kakao client secret |
| `APP_IMAGE` | 앱 배포 시 사용할 이미지 주소(AWS ECR Endpoint) |

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run db:up:local
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 데이터베이스

Drizzle schema는 `src/db/schema.ts`에 있으며 migration 파일은 `drizzle/`에 저장됩니다.

```bash
npm run db:generate:local
npm run db:migrate:local
npm run db:studio:local
```

로컬 PostgreSQL 컨테이너를 종료하려면 다음 명령을 사용합니다.

```bash
npm run db:down
```

## 빌드와 실행

```bash
npm run build
npm run start
```

Docker 배포 구성은 `Dockerfile`, `compose.yaml`, `compose.prod.yaml`을 기준으로 관리합니다.

## 저장소 전략

업로드 파일은 `OUNWAN_STORAGE_PROVIDER` 값에 따라 저장소가 선택됩니다.

- `local`: `LOCAL_UPLOAD_ROOT` 하위에 파일 저장
- `s3`: S3 호환 Object Storage에 파일 저장

업로드 파일 조회는 공개 bucket에 직접 의존하지 않고 `/uploads/{storageKey}` 서버 라우트를 통해 처리합니다.

## 알림

앱 내부 알림은 DB에 저장되며, Web Push 키가 설정된 경우 구독된 브라우저로 푸시 알림을 발송합니다. 로컬 개발 환경에서 origin 설정이 맞지 않거나 VAPID 키가 비어 있으면 푸시 발송은 비활성화될 수 있습니다.
