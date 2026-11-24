-- 挞飞 · 签到与每日任务（v21.7）
-- 用法：Supabase 控制台 → SQL Editor → 整段粘贴 → Run（只需一次）
-- 作用：签到、连续签到奖励、每日任务进度、领取额度、额度流水。
-- 安全：所有写操作只走 security definer 函数；客户端只能读自己的记录。

begin;

-- 1) 额度主表（如果已有，只补字段，不改原数据）
create table if not exists public.tafei_balance (
  user_id uuid primary key,
  current_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.tafei_balance add column if not exists current_amount numeric not null default 0;
alter table public.tafei_balance add column if not exists updated_at timestamptz not null default now();

-- 2) 额度流水
create table if not exists public.tafei_balance_ledger (
  id bigserial primary key,
  user_id uuid not null,
  amount numeric not null,
  source text not null,
  note text not null default '',
  balance_after numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists tafei_balance_ledger_user_time_idx
  on public.tafei_balance_ledger (user_id, created_at desc);

-- 3) 任务配置
create table if not exists public.tafei_task_catalog (
  task_key text primary key,
  title text not null,
  description text not null default '',
  reward integer not null default 1,
  target_count integer not null default 1,
  once boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 4) 签到记录（每个用户每天一条）
create table if not exists public.tafei_daily_checkins (
  user_id uuid not null,
  checkin_date date not null,
  streak integer not null default 1,
  base_reward integer not null default 1,
  bonus_reward integer not null default 0,
  total_reward integer not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);
create index if not exists tafei_daily_checkins_date_idx
  on public.tafei_daily_checkins (checkin_date desc);

-- 5) 任务事件（前端只上报“发生了什么事”，发不发额度由函数校验）
create table if not exists public.tafei_task_events (
  id bigserial primary key,
  user_id uuid not null,
  task_key text not null,
  event_key text not null default '',
  event_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, task_key, event_key, event_date)
);
create index if not exists tafei_task_events_user_day_idx
  on public.tafei_task_events (user_id, event_date desc);

-- 6) 领取记录
create table if not exists public.tafei_task_claims (
  id bigserial primary key,
  user_id uuid not null,
  task_key text not null,
  claim_date date not null,
  reward integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, task_key, claim_date)
);
create index if not exists tafei_task_claims_user_day_idx
  on public.tafei_task_claims (user_id, claim_date desc);

-- 7) 任务配置种子（改文案/奖励改这里即可）
insert into public.tafei_task_catalog (task_key, title, description, reward, target_count, once, active, sort)
values
  ('device_view', '逛 3 台机型', '打开 3 台不同机型的详情，每台停留 3 秒以上。', 1, 3, false, true, 1),
  ('post', '发布 1 条求助', '在求助台发布一条带机型、问题描述的求助。', 2, 1, false, true, 2),
  ('comment', '回复 1 条求助', '回复别人的求助，内容不少于 5 个字。', 1, 1, false, true, 3),
  ('profile', '完善头像与昵称', '设置头像并填写昵称，一次性奖励。', 3, 1, true, true, 4)
on conflict (task_key) do update set
  title = excluded.title,
  description = excluded.description,
  reward = excluded.reward,
  target_count = excluded.target_count,
  once = excluded.once,
  active = excluded.active,
  sort = excluded.sort,
  updated_at = now();

-- 8) 内部加额度函数
create or replace function public.tafei_add_balance(
  p_user uuid,
  p_amount numeric,
  p_source text,
  p_note text default ''
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if p_user is null then
    raise exception '缺少用户' using errcode = '22023';
  end if;
  if p_amount is null or p_amount = 0 then
    select coalesce(current_amount, 0) into v_balance
    from public.tafei_balance where user_id = p_user;
    return coalesce(v_balance, 0);
  end if;

  insert into public.tafei_balance as b (user_id, current_amount, updated_at)
  values (p_user, p_amount, now())
  on conflict (user_id) do update
    set current_amount = coalesce(b.current_amount, 0) + p_amount,
        updated_at = now()
  returning b.current_amount into v_balance;

  insert into public.tafei_balance_ledger (user_id, amount, source, note, balance_after)
  values (p_user, p_amount, coalesce(nullif(p_source, ''), 'manual'), coalesce(p_note, ''), v_balance);

  return v_balance;
end;
$$;

-- 9) 每日签到：基础 1 额度；连续 3/7/30 天额外 +2/+5/+20
create or replace function public.tafei_checkin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_last date;
  v_last_streak integer := 0;
  v_streak integer := 1;
  v_bonus integer := 0;
  v_total integer := 1;
  v_balance numeric;
begin
  if v_uid is null then
    raise exception '请先登录' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext('tafei_checkin:' || v_uid::text));

  if exists (select 1 from public.tafei_daily_checkins where user_id = v_uid and checkin_date = v_today) then
    select coalesce(current_amount, 0) into v_balance from public.tafei_balance where user_id = v_uid;
    select streak into v_streak from public.tafei_daily_checkins where user_id = v_uid and checkin_date = v_today;
    return jsonb_build_object(
      'ok', true, 'already', true, 'today', v_today, 'streak', coalesce(v_streak, 0),
      'base', 0, 'bonus', 0, 'total', 0, 'balance', coalesce(v_balance, 0)
    );
  end if;

  select max(checkin_date) into v_last
  from public.tafei_daily_checkins where user_id = v_uid;

  if v_last = v_today - 1 then
    select streak into v_last_streak
    from public.tafei_daily_checkins
    where user_id = v_uid and checkin_date = v_last;
    v_streak := coalesce(v_last_streak, 0) + 1;
  else
    v_streak := 1;
  end if;

  if v_streak = 3 then v_bonus := 2;
  elsif v_streak = 7 then v_bonus := 5;
  elsif v_streak = 30 then v_bonus := 20;
  else v_bonus := 0;
  end if;
  v_total := 1 + v_bonus;

  insert into public.tafei_daily_checkins
    (user_id, checkin_date, streak, base_reward, bonus_reward, total_reward)
  values (v_uid, v_today, v_streak, 1, v_bonus, v_total)
  on conflict (user_id, checkin_date) do nothing;

  if not found then
    select coalesce(current_amount, 0) into v_balance from public.tafei_balance where user_id = v_uid;
    return jsonb_build_object(
      'ok', true, 'already', true, 'today', v_today, 'streak', v_streak,
      'base', 0, 'bonus', 0, 'total', 0, 'balance', coalesce(v_balance, 0)
    );
  end if;

  v_balance := public.tafei_add_balance(
    v_uid, v_total, 'checkin',
    '签到 ' || v_today || ' · 连续 ' || v_streak || ' 天 · 基础 1 + 奖励 ' || v_bonus
  );

  return jsonb_build_object(
    'ok', true, 'already', false, 'today', v_today, 'streak', v_streak,
    'base', 1, 'bonus', v_bonus, 'total', v_total, 'balance', v_balance
  );
end;
$$;

-- 10) 任务状态：签到、连续天数、4 个任务进度、是否已领
create or replace function public.tafei_task_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_checked boolean;
  v_streak integer := 0;
  v_last date;
  v_balance numeric := 0;
  v_tasks jsonb;
begin
  if v_uid is null then
    raise exception '请先登录' using errcode = '28000';
  end if;

  select coalesce(current_amount, 0) into v_balance
  from public.tafei_balance where user_id = v_uid;

  select exists (
    select 1 from public.tafei_daily_checkins
    where user_id = v_uid and checkin_date = v_today
  ) into v_checked;

  select max(checkin_date) into v_last
  from public.tafei_daily_checkins where user_id = v_uid;

  if v_checked then
    select streak into v_streak from public.tafei_daily_checkins
    where user_id = v_uid and checkin_date = v_today;
  elsif v_last = v_today - 1 then
    select streak into v_streak from public.tafei_daily_checkins
    where user_id = v_uid and checkin_date = v_last;
  else
    v_streak := 0;
  end if;

  with task_rows as (
    select
      c.task_key, c.title, c.description, c.reward, c.target_count, c.once, c.sort,
      case
        when c.task_key = 'profile' then
          case when exists (
            select 1 from public.tafei_profiles p
            where p.id = v_uid
              and char_length(coalesce(p.nickname, '')) >= 2
              and char_length(coalesce(p.avatar_url, '')) > 20
          ) then 1 else 0 end
        else (
          select count(distinct e.event_key)
          from public.tafei_task_events e
          where e.user_id = v_uid and e.task_key = c.task_key and e.event_date = v_today
        )
      end as progress,
      case
        when c.once then exists (
          select 1 from public.tafei_task_claims k
          where k.user_id = v_uid and k.task_key = c.task_key
        )
        else exists (
          select 1 from public.tafei_task_claims k
          where k.user_id = v_uid and k.task_key = c.task_key and k.claim_date = v_today
        )
      end as claimed
    from public.tafei_task_catalog c
    where c.active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', task_key,
    'title', title,
    'description', description,
    'reward', reward,
    'target', target_count,
    'progress', least(progress, target_count),
    'ready', progress >= target_count and not claimed,
    'claimed', claimed,
    'once', once
  ) order by sort), '[]'::jsonb) into v_tasks
  from task_rows;

  return jsonb_build_object(
    'ok', true,
    'today', v_today,
    'checked_today', v_checked,
    'streak', coalesce(v_streak, 0),
    'last_date', v_last,
    'balance', coalesce(v_balance, 0),
    'tasks', v_tasks
  );
end;
$$;

-- 11) 任务事件上报：只接受配置表里的任务，单日最多记 3 条事件
create or replace function public.tafei_task_event(
  p_task_key text,
  p_event_key text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_task public.tafei_task_catalog;
  v_key text;
  v_count integer;
begin
  if v_uid is null then
    raise exception '请先登录' using errcode = '28000';
  end if;

  select * into v_task from public.tafei_task_catalog
  where task_key = p_task_key and active;
  if not found then
    raise exception '未知任务' using errcode = '22023';
  end if;
  if v_task.once then
    return jsonb_build_object('ok', true, 'ignored', true, 'reason', '一次性任务不需要上报');
  end if;

  v_key := left(coalesce(nullif(trim(p_event_key), ''), p_task_key || '-' || extract(epoch from now())::bigint::text), 80);

  perform pg_advisory_xact_lock(hashtext('tafei_task_event:' || v_uid::text || ':' || p_task_key));

  select count(*) into v_count
  from public.tafei_task_events
  where user_id = v_uid and task_key = p_task_key and event_date = v_today;

  if v_count >= 3 then
    return jsonb_build_object('ok', false, 'reason', '今日上报次数已满', 'progress', least(v_count, v_task.target_count), 'target', v_task.target_count);
  end if;

  insert into public.tafei_task_events (user_id, task_key, event_key, event_date)
  values (v_uid, p_task_key, v_key, v_today)
  on conflict (user_id, task_key, event_key, event_date) do nothing;

  select count(distinct event_key) into v_count
  from public.tafei_task_events
  where user_id = v_uid and task_key = p_task_key and event_date = v_today;

  return jsonb_build_object(
    'ok', true,
    'progress', least(v_count, v_task.target_count),
    'target', v_task.target_count,
    'ready', v_count >= v_task.target_count
  );
end;
$$;

-- 12) 领取任务奖励
create or replace function public.tafei_claim_task(p_task_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_task public.tafei_task_catalog;
  v_progress integer := 0;
  v_claimed boolean;
  v_balance numeric;
begin
  if v_uid is null then
    raise exception '请先登录' using errcode = '28000';
  end if;

  select * into v_task from public.tafei_task_catalog
  where task_key = p_task_key and active;
  if not found then
    raise exception '未知任务' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('tafei_task_claim:' || v_uid::text));

  if v_task.task_key = 'profile' then
    select case when exists (
      select 1 from public.tafei_profiles p
      where p.id = v_uid
        and char_length(coalesce(p.nickname, '')) >= 2
        and char_length(coalesce(p.avatar_url, '')) > 20
    ) then 1 else 0 end into v_progress;

    select exists (
      select 1 from public.tafei_task_claims
      where user_id = v_uid and task_key = v_task.task_key
    ) into v_claimed;
  else
    select count(distinct event_key) into v_progress
    from public.tafei_task_events
    where user_id = v_uid and task_key = v_task.task_key and event_date = v_today;

    select exists (
      select 1 from public.tafei_task_claims
      where user_id = v_uid and task_key = v_task.task_key and claim_date = v_today
    ) into v_claimed;
  end if;

  if v_claimed then
    select coalesce(current_amount, 0) into v_balance from public.tafei_balance where user_id = v_uid;
    return jsonb_build_object('ok', true, 'already', true, 'balance', coalesce(v_balance, 0), 'reward', 0, 'progress', v_progress);
  end if;

  if v_progress < v_task.target_count then
    raise exception '任务还没完成' using errcode = '22023';
  end if;

  insert into public.tafei_task_claims (user_id, task_key, claim_date, reward)
  values (v_uid, v_task.task_key, v_today, v_task.reward)
  on conflict (user_id, task_key, claim_date) do nothing;

  if not found then
    select coalesce(current_amount, 0) into v_balance from public.tafei_balance where user_id = v_uid;
    return jsonb_build_object('ok', true, 'already', true, 'balance', coalesce(v_balance, 0), 'reward', 0, 'progress', v_progress);
  end if;

  v_balance := public.tafei_add_balance(
    v_uid, v_task.reward, 'task:' || v_task.task_key, '领取任务「' || v_task.title || '」'
  );

  return jsonb_build_object(
    'ok', true, 'already', false, 'balance', v_balance,
    'reward', v_task.reward, 'progress', v_progress, 'target', v_task.target_count
  );
end;
$$;

-- 13) 站长任务看板：签到、领取、发放额度、任务分布
create or replace function public.tafei_admin_task_stats(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 60);
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_days_json jsonb;
  v_tasks_json jsonb;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> '3659229103@qq.com' then
    raise exception '无权访问' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', d::date,
    'checkins', (select count(*) from public.tafei_daily_checkins c where c.checkin_date = d::date),
    'claims', (select count(*) from public.tafei_task_claims k where k.claim_date = d::date),
    'credits', (select coalesce(sum(l.amount), 0) from public.tafei_balance_ledger l
      where (l.created_at at time zone 'Asia/Shanghai')::date = d::date
        and (l.source = 'checkin' or l.source like 'task:%'))
  ) order by d desc), '[]'::jsonb)
  into v_days_json
  from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as g(d);

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', c.task_key,
    'title', c.title,
    'claims', (select count(*) from public.tafei_task_claims k where k.task_key = c.task_key and k.claim_date = v_today),
    'reward', c.reward
  ) order by c.sort), '[]'::jsonb)
  into v_tasks_json
  from public.tafei_task_catalog c
  where c.active;

  return jsonb_build_object(
    'today', v_today,
    'checkins_today', (select count(*) from public.tafei_daily_checkins where checkin_date = v_today),
    'checkin_users_7d', (select count(distinct user_id) from public.tafei_daily_checkins where checkin_date >= v_today - 6),
    'claims_today', (select count(*) from public.tafei_task_claims where claim_date = v_today),
    'credits_today', (select coalesce(sum(amount), 0) from public.tafei_balance_ledger
      where (created_at at time zone 'Asia/Shanghai')::date = v_today
        and (source = 'checkin' or source like 'task:%')),
    'total_balance', (select coalesce(sum(current_amount), 0) from public.tafei_balance),
    'days', v_days_json,
    'tasks', v_tasks_json
  );
end;
$$;

-- 13) RLS：客户端只能读自己的记录
alter table public.tafei_balance enable row level security;
alter table public.tafei_balance_ledger enable row level security;
alter table public.tafei_task_catalog enable row level security;
alter table public.tafei_daily_checkins enable row level security;
alter table public.tafei_task_events enable row level security;
alter table public.tafei_task_claims enable row level security;

drop policy if exists tafei_balance_select_own on public.tafei_balance;
create policy tafei_balance_select_own on public.tafei_balance
  for select to authenticated using (user_id = auth.uid());

drop policy if exists tafei_balance_ledger_select_own on public.tafei_balance_ledger;
create policy tafei_balance_ledger_select_own on public.tafei_balance_ledger
  for select to authenticated using (user_id = auth.uid());

drop policy if exists tafei_task_catalog_select_active on public.tafei_task_catalog;
create policy tafei_task_catalog_select_active on public.tafei_task_catalog
  for select to authenticated using (active);

drop policy if exists tafei_daily_checkins_select_own on public.tafei_daily_checkins;
create policy tafei_daily_checkins_select_own on public.tafei_daily_checkins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists tafei_task_events_select_own on public.tafei_task_events;
create policy tafei_task_events_select_own on public.tafei_task_events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists tafei_task_claims_select_own on public.tafei_task_claims;
create policy tafei_task_claims_select_own on public.tafei_task_claims
  for select to authenticated using (user_id = auth.uid());

-- 14) 权限：只开放读表 + 调用函数
grant select on public.tafei_balance to authenticated;
grant select on public.tafei_balance_ledger to authenticated;
grant select on public.tafei_task_catalog to authenticated;
grant select on public.tafei_daily_checkins to authenticated;
grant select on public.tafei_task_events to authenticated;
grant select on public.tafei_task_claims to authenticated;

revoke all on function public.tafei_add_balance(uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.tafei_checkin() from public, anon;
revoke all on function public.tafei_task_status() from public, anon;
revoke all on function public.tafei_task_event(text, text) from public, anon;
revoke all on function public.tafei_claim_task(text) from public, anon;
revoke all on function public.tafei_admin_task_stats(integer) from public, anon;

grant execute on function public.tafei_checkin() to authenticated;
grant execute on function public.tafei_task_status() to authenticated;
grant execute on function public.tafei_task_event(text, text) to authenticated;
grant execute on function public.tafei_claim_task(text) to authenticated;
grant execute on function public.tafei_admin_task_stats(integer) to authenticated;

commit;

-- 验证（可选）
-- select * from public.tafei_task_catalog order by sort;
-- select count(*) from public.tafei_balance;
