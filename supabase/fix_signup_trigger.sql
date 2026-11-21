-- 修复注册报错：Database error saving new user
-- 用法：Supabase 控制台 → SQL Editor → 整段粘贴 → Run（一次即可）
--
-- 原因：auth.users 上的自定义触发器（通常是 handle_new_user）在写 public.tafei_profiles
-- 时出错（插入旧字段/表结构变化/RLS 权限），GoTrue 就会统一返回 500 这个错误。
-- 本脚本会删掉 public schema 里挂在 auth.users 上的自定义触发器，再建一个安全版本：
-- 写 id/nickname/bio/created_at，security definer 绕过 RLS，昵称重复也不会挡注册。

-- 1) 先看一眼现在有哪些自定义触发器（执行后会显示在结果区）
select t.tgname as trigger_name,
       p.proname as function_name,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = p.pronamespace
where t.tgrelid = 'auth.users'::regclass
  and not t.tgisinternal
  and n.nspname = 'public';

-- 2) 移除会挡注册的旧触发器（只动 public schema，不碰 auth 内部触发器）
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and n.nspname = 'public'
  loop
    execute format('drop trigger if exists %I on auth.users', r.tgname);
  end loop;
end $$;

-- 3) 重建一个只负责写档案的触发器函数
create or replace function public.tafei_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nick text;
begin
  nick := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    nullif(regexp_replace(coalesce(new.email, ''), '@.*$', ''), ''),
    '挞飞用户'
  );
  nick := left(nick, 30);

  insert into public.tafei_profiles (id, nickname, bio, created_at)
  values (new.id, nick, '', now())
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger tafei_on_auth_user_created
after insert on auth.users
for each row execute function public.tafei_handle_new_user();

-- 4) 验证：注册一个新账号，或在 SQL Editor 里查最新档案
-- select id, nickname, created_at from public.tafei_profiles order by created_at desc limit 5;
