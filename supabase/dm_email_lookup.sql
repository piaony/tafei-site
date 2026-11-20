-- ============================================================
-- 挞飞 · 私信收件人按邮箱查找（不提供成员列表）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（只需一次）
-- 规则：必须登录；只有完整、精确匹配的注册邮箱才会返回结果
-- ============================================================

create or replace function public.tafei_lookup_peer(p_email text)
returns table (uid uuid, nickname text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_mail text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
  v_nick text;
begin
  -- 必须是已登录用户
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'sub', '') = '' then
    raise exception '请先登录后再查找收件人' using errcode = '42501';
  end if;

  -- 格式不像邮箱就直接返回空，避免用它扫库
  if v_mail !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return;
  end if;

  select u.id into v_uid
  from auth.users u
  where lower(u.email) = v_mail
  limit 1;

  if v_uid is null then
    return;
  end if;

  select p.nickname into v_nick
  from public.tafei_profiles p
  where p.id = v_uid;

  uid := v_uid;
  nickname := coalesce(v_nick, split_part(v_mail, '@', 1));
  return next;
end $$;

revoke all on function public.tafei_lookup_peer(text) from public;
grant execute on function public.tafei_lookup_peer(text) to authenticated;
