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

## 회원탈퇴

더보기 화면의 로그아웃 아래에서 회원탈퇴를 요청할 수 있습니다. 재확인 후 OAuth 연결해제가 완료되어야 사용자 논리삭제를 진행합니다.

- 카카오 연결해제에는 서버 전용 `KAKAO_ADMIN_KEY`가 필요합니다. 카카오디벨로퍼스에서 해당 키의 연결해제 API 호출 권한을 허용해야 합니다. 브라우저에 키를 노출하지 않습니다.
- 관리자인 그룹이 남아 있으면 먼저 관리자 위임 또는 그룹 삭제가 필요합니다.
- 탈퇴 시 사용자 상태를 deleted로 변경하고 그룹·시즌 참여를 종료하며, 가입 대기 요청을 취소하고 푸시 구독을 비활성화합니다.
- 게시글·댓글·결산 기록은 보존합니다. 탈퇴한 계정은 복원하지 않으며 재가입 시 기존 신규 사용자 발급 흐름을 사용합니다.
- 연결해제 실패 시 사용자 논리삭제는 수행하지 않습니다. 연결해제 후 DB 처리 실패는 외부 API와 DB가 하나의 트랜잭션이 아니므로 카카오 연결 자체를 되돌릴 수 없습니다. 재시도 시 카카오의 이미 미연결 상태(-101)를 허용하여 DB 탈퇴 처리를 다시 시도합니다.
- 기존 기기의 세션 쿠키도 사용자 활성 상태 검사에서 거부합니다.
- 공급자별 연결해제는 `src/auth/oauth-unlink.ts`에서 선택합니다. OAuth 공급자를 추가할 때 해당 공급자의 설정 검증과 재시도 가능한 연결해제 핸들러를 함께 등록해야 합니다.

연결해제 API와 오류 코드는 [카카오 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api#unlink), [오류 코드 문서](https://developers.kakao.com/docs/ko/rest-api/error-code)를 참고합니다.

## 알림

앱 내부 알림은 DB에 저장되며, Web Push 키가 설정된 경우 구독된 브라우저로 푸시 알림을 발송합니다. 로컬 개발 환경에서 origin 설정이 맞지 않거나 VAPID 키가 비어 있으면 푸시 발송은 비활성화될 수 있습니다.
## 운영 로그

Docker 컨테이너 로그는 `compose.yaml`과 `compose.prod.yaml`의 `json-file` logging option으로 회전합니다.

- 최대 파일 크기: `10m`
- 보관 파일 수: `5`

주간 결산 배치와 대기 시즌 자동 시작 배치는 EC2 cron에서 다음 명령으로 실행하고 파일 로그를 남깁니다.

```cron
*/5 * * * * docker exec ounwan-app npm run batch:weekly-settlement >> /var/log/ounwan-weekly-settlement.log 2>&1
*/5 * * * * docker exec ounwan-app npm run batch:activate-pending-seasons >> /var/log/ounwan-season-activation.log 2>&1
```

배치 파일 로그는 `ops/logrotate`의 설정 파일을 EC2의 `/etc/logrotate.d`에 복사해 회전합니다.

```bash
sudo cp ops/logrotate/ounwan-weekly-settlement /etc/logrotate.d/ounwan-weekly-settlement
sudo cp ops/logrotate/ounwan-season-activation /etc/logrotate.d/ounwan-season-activation
```

로컬에서 대기 시즌 자동 시작 배치를 수동 실행하려면 다음 명령을 사용합니다.

```bash
npm run batch:activate-pending-seasons:local
```

## 저장소 미참조 파일 정리 배치

매일 한국시간 05:10에 현재 저장소(local/S3)의 전체 파일을 순회합니다.
그룹이나 시즌 상태로 필터링하지 않으며, 종료된 시즌도 동일하게 처리합니다.

- 삭제되지 않은 인증 게시글의 원본·썸네일, 삭제되지 않은 잔고 게시글 이미지, 삭제되지 않은 사용자의 아바타는 보존합니다.
- 위 데이터에서 참조하지 않는 파일 중 마지막 수정 시각이 24시간 이상 지난 파일만 삭제합니다. 따라서 업로드 중인 파일이나 최근 교체된 파일은 바로 정리하지 않습니다.
- 삭제 직전에 DB 참조와 파일 변경 여부를 다시 확인합니다. DB 조회에 실패하면 삭제를 중단합니다.
- DB 데이터는 수정하지 않습니다. 실패한 파일은 저장소에 남아 다음 실행에서 다시 검사되므로 별도 마이그레이션이나 삭제 완료 컬럼은 필요하지 않습니다.
- 동시 실행은 DB 트랜잭션 advisory lock으로 차단합니다. 개별 파일 삭제 실패는 로그를 남기고 계속 진행하며 종료 코드는 1입니다.
- 로컬은 설정된 업로드 루트 아래 일반 파일만 처리하며 심볼릭 링크는 건너뜁니다.
- S3 버전 관리가 켜져 있거나 일시 중지된 경우 미참조 키의 파일 버전을 개별 삭제합니다. 사용 중인 키는 과거 버전도 보존하고, 데이터가 없는 삭제 마커는 정리하지 않습니다. Object Lock 등으로 삭제가 거부되면 우회하지 않고 실패로 기록합니다.

**현재 DB와 저장소가 같은 환경인지 반드시 확인하세요.** 버킷 전체를 검사하므로 다른 서비스와 공유하는 버킷에는 사용하지 마세요. 최초 실행 전 dry-run 결과를 검토하세요.

```bash
# 로컬: 조회만 수행
npm run batch:cleanup-storage:local -- --dry-run
# 로컬: 실제 삭제
npm run batch:cleanup-storage:local
# 운영: 조회만 수행
docker exec ounwan-app npm run batch:cleanup-storage -- --dry-run
# 운영: 실제 삭제
docker exec ounwan-app npm run batch:cleanup-storage
```

### 운영 스케줄 및 로그

기존 Docker 이미지에 배치 소스가 포함되므로 재배포 후 사용합니다. cron은 별도로 설치해야 합니다.

```bash
timedatectl
# 서버 시간대가 UTC인 경우: 20:10 UTC = 다음 날 05:10 KST
sudo cp ops/cron/ounwan-storage-cleanup /etc/cron.d/ounwan-storage-cleanup
sudo chmod 0644 /etc/cron.d/ounwan-storage-cleanup
sudo cp ops/logrotate/ounwan-storage-cleanup /etc/logrotate.d/ounwan-storage-cleanup
sudo chmod 0644 /etc/logrotate.d/ounwan-storage-cleanup
```

서버 시간대가 Asia/Seoul이면 cron 파일의 시간 부분을 `10 5 * * *`로 변경합니다.
이 파일은 `/etc/cron.d`용이므로 사용자 crontab에 그대로 붙이지 않습니다. 두 곳에 중복 등록하지 마세요.
로그는 `/var/log/ounwan-storage-cleanup.log`에 기록하며 기존 배치와 동일한 logrotate 정책을 적용합니다.

### S3 IAM 권한

기존 AWS SDK default credential provider chain과 EC2 Instance Profile을 그대로 사용합니다. 별도 Access Key 환경변수는 추가하지 않습니다.

- 버킷 ARN: `s3:GetBucketVersioning`, `s3:ListBucket`
- 객체 ARN: `s3:GetObject`, `s3:DeleteObject`
- 버전 관리 버킷 추가 권한: 버킷 ARN에 `s3:ListBucketVersions`, 객체 ARN에 `s3:GetObjectVersion`, `s3:DeleteObjectVersion`

S3의 버전별 물리삭제와 조건부 삭제는 [AWS DeleteObject 문서](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html)를 따릅니다.
