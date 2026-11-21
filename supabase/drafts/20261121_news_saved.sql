-- NHÁP · CHƯA ÁP · chờ Deren duyệt (UI v3, News › Đã lưu).
-- Đặt ngoài supabase/migrations/ để không bị `supabase db push` áp nhầm. Khi duyệt: đổi tên theo version thật và chuyển vào migrations/.
-- Lưu bài News để đọc lại. Theo mẫu quyền schema trading: RLS bật, không policy, chỉ service_role (server) đọc ghi.
create table if not exists trading.news_saved (
  id          uuid        not null default gen_random_uuid() primary key,
  created_at  timestamptz not null default now(),
  news_id     text        not null,             -- id Finnhub
  url         text        not null check (url ~ '^https?://'),
  headline    text        not null check (char_length(headline) <= 500),
  source      text,
  published   timestamptz,
  related     text,                              -- mã liên quan, cách nhau dấu phẩy
  note        text        check (char_length(note) <= 1000),
  constraint news_saved_news_id_key unique (news_id)
);
comment on table trading.news_saved is 'Tin đã lưu từ trang News (UI v3). Chỉ server đọc ghi.';
create index if not exists news_saved_created_idx on trading.news_saved (created_at desc);
alter table trading.news_saved enable row level security;
revoke all on trading.news_saved from anon, authenticated;
grant select, insert, update, delete on trading.news_saved to service_role;
