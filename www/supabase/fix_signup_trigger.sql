-- 修复注册报错：Database error saving new user
-- 诊断结果：auth.users 上有 on_tafei_user_created → public.tafei_create_profile() 的 INSERT 触发器
-- 本脚本只替换这个函数的实现，不删除任何触发器，保留 on_tafei_username_updated。
-- 用法：Supabase 控制台 → SQL Editor → 整段粘贴 → Run（一次即可）

create or replace function public.tafei_create_profile()
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
exception
  when others then
    -- 档案写入失败也不阻止注册，错误会留在 Postgres 日志里
    raise warning 'tafei_create_profile failed: %', sqlerrm;
    return new;
end;
$$;

-- 让 GoTrue 的 auth 角色有权限执行这个触发器函数
grant execute on function public.tafei_create_profile() to supabase_auth_admin;

-- 验证：注册一个新账号后执行
-- select id, nickname, created_at from public.tafei_profiles order by created_at desc limit 5;
