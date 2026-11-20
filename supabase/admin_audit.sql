-- ============================================================
-- 挞飞 · 站长审查接口（账号列表 / 私信总览 / 删除私信）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（只需一次）
-- 权限：仅站长邮箱 3659229103@qq.com 可调用，其他人一律 42501
-- ============================================================

-- 站长邮箱判断（内联在各自函数里，避免依赖别的函数签名）
create or replace function public.tafei_admin_accounts()
returns table (
  uid uuid,
  email text,
  nickname text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  msg_count bigint
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
             where m.sender_id = u.id or m.recipient_id = u.id)::bigint
    from auth.users u
    left join public.tafei_profiles p on p.id = u.id
    order by u.created_at desc
    limit 300;
end $$;

create or replace function public.tafei_admin_messages(p_query text default '', p_limit int default 100)
returns table (
  id bigint,
  created_at timestamptz,
  sender_email text,
  sender_name text,
  recipient_email text,
  recipient_name text,
  body text,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  q text := coalesce(p_query, '');
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以访问这个接口' using errcode = '42501';
  end if;

  return query
    select m.id,
           m.created_at,
           s.email::text,
           coalesce(sp.nickname, split_part(s.email, '@', 1))::text,
           r.email::text,
           coalesce(rp.nickname, split_part(r.email, '@', 1))::text,
           m.body,
           m.read_at
    from public.tafei_messages m
    join auth.users s on s.id = m.sender_id
    join auth.users r on r.id = m.recipient_id
    left join public.tafei_profiles sp on sp.id = s.id
    left join public.tafei_profiles rp on rp.id = r.id
    where q = ''
       or m.body ilike '%' || q || '%'
       or s.email ilike '%' || q || '%'
       or r.email ilike '%' || q || '%'
       or sp.nickname ilike '%' || q || '%'
       or rp.nickname ilike '%' || q || '%'
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

create or replace function public.tafei_admin_delete_message(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以访问这个接口' using errcode = '42501';
  end if;

  delete from public.tafei_messages where id = p_id;
  return true;
end $$;

-- 只给登录用户执行权，未登录（anon）拿不到
revoke all on function public.tafei_admin_accounts() from public;
revoke all on function public.tafei_admin_messages(text, int) from public;
revoke all on function public.tafei_admin_delete_message(bigint) from public;
grant execute on function public.tafei_admin_accounts() to authenticated;
grant execute on function public.tafei_admin_messages(text, int) to authenticated;
grant execute on function public.tafei_admin_delete_message(bigint) to authenticated;
