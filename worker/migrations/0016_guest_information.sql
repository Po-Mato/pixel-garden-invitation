CREATE TABLE invitation_announcements (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 60),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 300),
  tone TEXT NOT NULL CHECK (tone IN ('info', 'important', 'urgent')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  action_kind TEXT NOT NULL DEFAULT 'none' CHECK (action_kind IN ('none', 'directions', 'venue_phone', 'external')),
  action_label TEXT NOT NULL DEFAULT '' CHECK (length(action_label) <= 24),
  action_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 0 AND 999),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_announcements_public
  ON invitation_announcements(invitation_id, active, starts_at, ends_at, pinned, sort_order);

CREATE TABLE invitation_faqs (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (length(category) BETWEEN 1 AND 30),
  question TEXT NOT NULL CHECK (length(question) BETWEEN 1 AND 80),
  answer TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 500),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100 CHECK (sort_order BETWEEN 0 AND 999),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
);

CREATE INDEX idx_invitation_faqs_public
  ON invitation_faqs(invitation_id, active, featured, category, sort_order);

INSERT OR IGNORE INTO invitation_faqs (
  id, invitation_id, category, question, answer, active, featured, sort_order, created_at, updated_at
)
SELECT
  'faq_seed_parking', id, '교통·주차', '주차는 가능한가요?',
  'MJ컨벤션 주차장은 약 500대 이상 수용 가능하며, 예식 하객은 2시간 무료 주차가 가능합니다.',
  1, 1, 10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM invitations WHERE id = 'sample-garden';

INSERT OR IGNORE INTO invitation_faqs (
  id, invitation_id, category, question, answer, active, featured, sort_order, created_at, updated_at
)
SELECT
  'faq_seed_transit', id, '교통·주차', '대중교통으로 어떻게 가나요?',
  '소사역 1번 출구에서 도보 약 3분 거리입니다. 길 찾기 버튼에서 이용하실 지도 앱을 선택할 수 있습니다.',
  1, 1, 20, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM invitations WHERE id = 'sample-garden';

INSERT OR IGNORE INTO invitation_faqs (
  id, invitation_id, category, question, answer, active, featured, sort_order, created_at, updated_at
)
SELECT
  'faq_seed_hall', id, '예식 안내', '예식장은 몇 층인가요?',
  '예식은 MJ컨벤션 5층 파티오볼룸에서 진행됩니다.',
  1, 1, 30, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM invitations WHERE id = 'sample-garden';

INSERT OR IGNORE INTO invitation_faqs (
  id, invitation_id, category, question, answer, active, featured, sort_order, created_at, updated_at
)
SELECT
  'faq_seed_arrival', id, '예식 안내', '몇 시까지 도착하면 좋을까요?',
  '여유롭게 인사와 접수를 하실 수 있도록 예식 시작 20~30분 전 도착을 권합니다.',
  1, 0, 40, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM invitations WHERE id = 'sample-garden';
