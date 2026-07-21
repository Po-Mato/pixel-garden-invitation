# 관리자 이메일 알림 운영 안내

## 현재 동작

- RSVP와 방명록의 신규 작성 및 하객 수정은 D1 알림 큐에 한 번만 저장됩니다.
- 이메일 연결 전 알림은 삭제되지 않고 관리자 화면에 보관됩니다.
- 연결 후 신규 알림은 즉시 발송하며, 일시 오류는 5분, 30분, 2시간, 8시간 간격으로 최대 5회 시도합니다.
- 일일 발송 한도 오류는 24시간 후 다시 시도합니다.
- 발신자 미인증, 허용되지 않은 수신자, 영구 반송 등 설정 오류는 자동 반복하지 않습니다.
- 설정을 고친 뒤 관리자 화면의 `실패 재시도`로 최종 실패 알림을 다시 큐에 넣을 수 있습니다.
- Cloudflare 자체 전달 재시도와 별개로, 이 큐는 Email Sending API 호출 실패만 재시도합니다.

## 최초 활성화

1. Cloudflare DNS에서 관리하는 사용자 소유 도메인을 준비합니다.
2. Cloudflare 대시보드의 `Compute > Email Service > Email Sending`에서 발신 도메인을 온보딩합니다.
3. `Email Routing > Destination addresses`에 실제 수신 주소를 추가하고 인증합니다.
4. `worker/wrangler.toml`에 다음 바인딩을 추가합니다.

```toml
[[send_email]]
name = "EMAIL"
allowed_sender_addresses = ["invitation@example.com"]
allowed_destination_addresses = ["admin@example.com"]
```

5. 주소는 저장소에 직접 넣지 않고 Worker secret으로 등록합니다.

```bash
pnpm --filter @wedding-game/worker exec wrangler secret put ADMIN_NOTIFICATION_EMAIL_FROM
pnpm --filter @wedding-game/worker exec wrangler secret put ADMIN_NOTIFICATION_EMAIL_TO
```

6. Worker를 배포한 뒤 테스트 RSVP를 등록해 관리자 화면에서 `이메일 발송 완료` 상태를 확인합니다.
7. Cloudflare Email Service Activity와 수신함에서 실제 전달 결과를 함께 확인합니다.

## 활성화 전 확인할 실데이터

- 관리자 알림 수신 이메일
- Cloudflare에서 관리 중인 발신 도메인
- 발신 주소의 로컬 파트. 권장값은 `invitation@도메인`입니다.
