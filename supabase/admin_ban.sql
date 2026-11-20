-- ============================================================
-- 挞飞 · 封禁 / 解封（站长专用）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（只需一次）
-- 权限：仅站长邮箱 3659229103@qq.com 可调用
-- ============================================================

-- 账号列表新增 banned_until 字段，所以要重建这个函数
drop function if exists public.tafei_admin_accounts();

create function public.tafei_admin_accounts()
returns table (
  uid uuid,
  email text,
  nickname text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  msg_count bigint,
  banned_until timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以访问这个接口' using errcode = '42501';
  end if;

  return query
    select u.id,
           u.email::text,
           p.nickname::text,
           u.created_at,
           u.last_sign_in_at,
           (select count(*) from public.tafei_messages m
             where m.sender_id = u.id or m.recipient_id = u.id)::bigint,
           u.banned_until
    from auth.users u
    left join public.tafei_profiles p on p.id = u.id
    order by u.created_at desc
    limit 300;
end $$;

create or replace function public.tafei_admin_ban(p_uid uuid, p_days int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_until timestamptz;
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以访问这个接口' using errcode = '42501';
  end if;

  select u.email::text into v_email from auth.users u where u.id = p_uid;
  if v_email is null then
    raise exception '账号不存在';
  end if;
  if lower(v_email) = lower('3659229103@qq.com') then
    raise exception '不能封禁站长自己的账号' using errcode = '42501';
  end if;

  v_until := now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 36500));
  update auth.users set banned_until = v_until where id = p_uid;
  return v_until;
end $$;

create or replace function public.tafei_admin_unban(p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以访问这个接口' using errcode = '42501';
  end if;

  update auth.users set banned_until = null where id = p_uid;
  return true;
end $$;

revoke all on function public.tafei_admin_accounts() from public;
revoke all on function public.tafei_admin_ban(uuid, int) from public;
revoke all on function public.tafei_admin_unban(uuid) from public;
grant execute on function public.tafei_admin_accounts() to authenticated;
grant execute on function public.tafei_admin_ban(uuid, int) to authenticated;
grant execute on function public.tafei_admin_unban(uuid) to authenticated;
