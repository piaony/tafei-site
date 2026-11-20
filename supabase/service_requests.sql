-- 挞飞 · 技术服务预约表
-- 用法：Supabase 控制台 → SQL Editor → 全选粘贴 → Run（一次即可）

create table if not exists public.tafei_service_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device text not null check (char_length(device) <= 80),
  os_version text check (char_length(os_version) <= 80),
  service text not null check (char_length(service) <= 60),
  contact text not null check (char_length(contact) <= 120),
  contact_type text default 'QQ' check (char_length(contact_type) <= 20),
  note text check (char_length(note) <= 500),
  source text default 'web',
  status text not null default 'new' check (status in ('new','contacted','quoted','done','closed'))
);

alter table public.tafei_service_requests enable row level security;

-- 匿名访客只能提交，不能读取
drop policy if exists "svc_anon_insert" on public.tafei_service_requests;
create policy "svc_anon_insert" on public.tafei_service_requests
  for insert to anon, authenticated
  with check (true);

-- 只有站长邮箱可以查看、修改状态
drop policy if exists "svc_admin_read" on public.tafei_service_requests;
create policy "svc_admin_read" on public.tafei_service_requests
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = '3659229103@qq.com');

drop policy if exists "svc_admin_update" on public.tafei_service_requests;
create policy "svc_admin_update" on public.tafei_service_requests
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = '3659229103@qq.com')
  with check ((select auth.jwt() ->> 'email') = '3659229103@qq.com');

create index if not exists tafei_service_requests_created_idx
  on public.tafei_service_requests (created_at desc);

-- 日常查看（在 SQL Editor 里执行）
-- select created_at, device, os_version, service, contact_type, contact, note, status
-- from public.tafei_service_requests order by created_at desc limit 50;
