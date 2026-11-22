-- 挞飞 · 精灵小屋 v2（养成 / 额度 / 云端同步）
-- 用法：Supabase 控制台 → SQL Editor → 整段粘贴 → Run（只需一次）
-- 依赖：supabase/daily_tasks.sql 已执行（复用 tafei_balance / tafei_balance_ledger / tafei_add_balance）
-- 说明：价格写在 tafei_spirit_config.key = 'catalog' 的 JSON 里，站长后台可改；客户端只读目录。
-- 安全：买角色/皮肤/道具、保存养成状态都走 security definer 函数；普通用户只能读自己的档案。

begin;

-- 1) 精灵目录与价格（唯一一行 catalog，value 是完整 JSON）
create table if not exists public.tafei_spirit_config (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.tafei_spirit_config (key, value)
values (
  'catalog',
  jsonb_build_object(
    'version', 1,
    'spirits', jsonb_build_object(
      'xiaota',    jsonb_build_object('price', 0,  'enabled', true, 'mode', 'free'),
      'xi-shi',    jsonb_build_object('price', 20, 'enabled', true, 'mode', 'request'),
      'angela',    jsonb_build_object('price', 24, 'enabled', true, 'mode', 'request'),
      'yao',       jsonb_build_object('price', 28, 'enabled', true, 'mode', 'request'),
      'gardener',  jsonb_build_object('price', 32, 'enabled', true, 'mode', 'request'),
      'doctor',    jsonb_build_object('price', 36, 'enabled', true, 'mode', 'request'),
      'mechanic',  jsonb_build_object('price', 40, 'enabled', true, 'mode', 'request'),
      'perfumer',  jsonb_build_object('price', 44, 'enabled', true, 'mode', 'request'),
      'tanluning', jsonb_build_object('price', 52, 'enabled', true, 'mode', 'request')
    ),
    'skins', jsonb_build_object(
      'xiaota-default',    jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'xiaota'),
      'xi-shi-default',    jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'xi-shi'),
      'angela-default',    jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'angela'),
      'yao-default',       jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'yao'),
      'gardener-default',  jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'gardener'),
      'doctor-default',    jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'doctor'),
      'mechanic-default',  jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'mechanic'),
      'perfumer-default',  jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'perfumer'),
      'tanluning-daily',   jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'tanluning'),
      'tanluning-bridal',  jsonb_build_object('price', 0,  'enabled', true, 'spirit', 'tanluning'),
      'tanluning-uniform', jsonb_build_object('price', 18, 'enabled', true, 'spirit', 'tanluning')
    ),
    'items', jsonb_build_object(
      'sugar-cake',   jsonb_build_object('price', 2,  'enabled', true),
      'tea',          jsonb_build_object('price', 3,  'enabled', true),
      'osmanthus',    jsonb_build_object('price', 5,  'enabled', true),
      'sweet-soup',   jsonb_build_object('price', 8,  'enabled', true),
      'tanhua-cake',  jsonb_build_object('price', 12, 'enabled', true),
      'anshen-soup',  jsonb_build_object('price', 15, 'enabled', true),
      'kite',         jsonb_build_object('price', 5,  'enabled', true),
      'rattle',       jsonb_build_object('price', 8,  'enabled', true),
      'sandbag',      jsonb_build_object('price', 10, 'enabled', true),
      'mirror',       jsonb_build_object('price', 18, 'enabled', true),
      'lantern',      jsonb_build_object('price', 20, 'enabled', true),
      'album',        jsonb_build_object('price', 25, 'enabled', true)
    ),
    'rules', jsonb_build_object(
      'satietyDecayPerHour', 1.2,
      'moodDecayPerHour', 0.8,
      'sleepinessGainPerHour', 1.5,
      'angerGainPerHour', 0.6,
      'sleepRecoverPerHour', 4,
      'idleSleepMinutes', 10,
      'autoSleepAt', 85,
      'idleSleepAt', 65,
      'angerHigh', 75,
      'hungerLow', 25,
      'moodHigh', 75,
      'fightBondPenalty', 2,
      'tickMinutes', 1
    )
  )
)
on conflict (key) do nothing;

-- 2) 每个用户的养成档案
create table if not exists public.tafei_spirit_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_spirit text not null default '',
  selected_skin text not null default '',
  status jsonb not null default '{}'::jsonb,
  bond jsonb not null default '{}'::jsonb,
  inventory jsonb not null default '{}'::jsonb,
  owned_spirits text[] not null default '{}'::text[],
  owned_skins text[] not null default '{}'::text[],
  widget jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists tafei_spirit_profiles_updated_idx
  on public.tafei_spirit_profiles (updated_at desc);

-- 3) 保存当前伙伴 / 皮肤 / 状态 / 亲密度 / 挂件位置
create or replace function public.tafei_spirit_save_state(p_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $tafei$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '请先登录后再保存伙伴状态';
  end if;

  insert into public.tafei_spirit_profiles as p (
    user_id, selected_spirit, selected_skin, status, bond, widget, updated_at
  ) values (
    v_uid,
    coalesce(p_state->>'selected_spirit', ''),
    coalesce(p_state->>'selected_skin', ''),
    coalesce(p_state->'status', '{}'::jsonb),
    coalesce(p_state->'bond', '{}'::jsonb),
    coalesce(p_state->'widget', '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update set
    selected_spirit = excluded.selected_spirit,
    selected_skin = excluded.selected_skin,
    status = excluded.status,
    bond = excluded.bond,
    widget = excluded.widget,
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$tafei$;

-- 4) 花站内额度：解锁角色 / 买皮肤 / 买食物玩具
create or replace function public.tafei_spirit_buy(p_kind text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $tafei$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb;
  v_price numeric := 0;
  v_enabled boolean := true;
  v_spirit text := '';
  v_mode text := 'purchase';
  v_balance numeric := 0;
  v_owned_spirits text[] := '{}'::text[];
  v_owned_skins text[] := '{}'::text[];
  v_inventory jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception '请先登录后再使用额度';
  end if;
  if p_kind is null or p_kind not in ('spirit', 'skin', 'item') then
    raise exception '未知的商品类型';
  end if;
  if p_id is null or length(trim(p_id)) = 0 then
    raise exception '商品 id 不能为空';
  end if;

  select value into v_cfg
  from public.tafei_spirit_config
  where key = 'catalog';
  if v_cfg is null then
    raise exception '精灵目录还没初始化，请先联系站长';
  end if;

  if p_kind = 'spirit' then
    if not (v_cfg->'spirits' ? p_id) then
      raise exception '目录里没有这个角色';
    end if;
    v_enabled := coalesce((v_cfg->'spirits'->p_id->>'enabled')::boolean, true);
    v_mode := coalesce(v_cfg->'spirits'->p_id->>'mode', 'purchase');
    v_price := case when v_mode = 'free' then 0 else coalesce((v_cfg->'spirits'->p_id->>'price')::numeric, 0) end;
  elsif p_kind = 'skin' then
    if not (v_cfg->'skins' ? p_id) then
      raise exception '目录里没有这套皮肤';
    end if;
    v_price := coalesce((v_cfg->'skins'->p_id->>'price')::numeric, 0);
    v_enabled := coalesce((v_cfg->'skins'->p_id->>'enabled')::boolean, true);
    v_spirit := coalesce(v_cfg->'skins'->p_id->>'spirit', '');
  else
    if not (v_cfg->'items' ? p_id) then
      raise exception '目录里没有这个道具';
    end if;
    v_price := coalesce((v_cfg->'items'->p_id->>'price')::numeric, 0);
    v_enabled := coalesce((v_cfg->'items'->p_id->>'enabled')::boolean, true);
  end if;

  if not v_enabled then
    raise exception '这个商品暂未上架';
  end if;
  if p_kind = 'spirit' and v_mode = 'request' then
    raise exception '这款由站长后台私下发放，不开放额度购买';
  end if;

  insert into public.tafei_spirit_profiles (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select owned_spirits, owned_skins, inventory
    into v_owned_spirits, v_owned_skins, v_inventory
  from public.tafei_spirit_profiles
  where user_id = v_uid;

  if p_kind = 'spirit' and p_id = any(v_owned_spirits) then
    return jsonb_build_object('already', true, 'kind', p_kind, 'id', p_id);
  end if;
  if p_kind = 'skin' and p_id = any(v_owned_skins) then
    return jsonb_build_object('already', true, 'kind', p_kind, 'id', p_id);
  end if;
  if p_kind = 'skin' and v_spirit <> '' and not (v_spirit = any(v_owned_spirits)) then
    raise exception '先解锁这个角色，再买她的皮肤';
  end if;

  insert into public.tafei_balance (user_id, current_amount, updated_at)
  values (v_uid, 0, now())
  on conflict (user_id) do nothing;

  select coalesce(current_amount, 0) into v_balance
  from public.tafei_balance
  where user_id = v_uid;

  if v_balance < v_price then
    raise exception '额度不足，还差 %', (v_price - v_balance);
  end if;

  if v_price > 0 then
    update public.tafei_balance
      set current_amount = current_amount - v_price, updated_at = now()
    where user_id = v_uid;
    insert into public.tafei_balance_ledger (user_id, amount, source, note, balance_after)
    values (v_uid, -v_price, 'spirit_shop', p_kind || ':' || p_id, v_balance - v_price);
  end if;

  if p_kind = 'spirit' then
    update public.tafei_spirit_profiles
      set owned_spirits = array_append(owned_spirits, p_id), updated_at = now()
    where user_id = v_uid;
  elsif p_kind = 'skin' then
    update public.tafei_spirit_profiles
      set owned_skins = array_append(owned_skins, p_id), updated_at = now()
    where user_id = v_uid;
  else
    update public.tafei_spirit_profiles
      set inventory = jsonb_set(
        inventory,
        array[p_id],
        to_jsonb(coalesce((inventory->>p_id)::int, 0) + 1),
        true
      ),
      updated_at = now()
    where user_id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'price', v_price);
end;
$tafei$;

-- 5) 站长手动发放精灵（不扣额度，直接写 owned_spirits）
create or replace function public.tafei_admin_spirit_grant(p_uid uuid, p_spirit_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $tafei$
declare
  v_cfg jsonb;
  v_owned text[] := '{}'::text[];
  v_already boolean := false;
begin
  if lower(coalesce(current_setting('request.jwt.claims', true)::json ->> 'email', '')) <> lower('3659229103@qq.com') then
    raise exception '只有站长可以发放精灵' using errcode = '42501';
  end if;
  if p_uid is null or p_spirit_id is null or length(trim(p_spirit_id)) = 0 then
    raise exception '账号和精灵不能为空';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_uid) then
    raise exception '账号不存在';
  end if;

  select value into v_cfg from public.tafei_spirit_config where key = 'catalog';
  if v_cfg is null or not (v_cfg->'spirits' ? p_spirit_id) then
    raise exception '精灵目录里没有这个角色';
  end if;

  select owned_spirits into v_owned
  from public.tafei_spirit_profiles
  where user_id = p_uid;

  v_already := p_spirit_id = any(coalesce(v_owned, '{}'::text[]));

  insert into public.tafei_spirit_profiles (user_id, owned_spirits)
  values (p_uid, array[p_spirit_id]::text[])
  on conflict (user_id) do update set
    owned_spirits = case
      when p_spirit_id = any(public.tafei_spirit_profiles.owned_spirits)
        then public.tafei_spirit_profiles.owned_spirits
      else array_append(public.tafei_spirit_profiles.owned_spirits, p_spirit_id)
    end,
    selected_spirit = case
      when public.tafei_spirit_profiles.selected_spirit = ''
        then p_spirit_id
      else public.tafei_spirit_profiles.selected_spirit
    end,
    updated_at = now();

  return jsonb_build_object('ok', true, 'already', v_already, 'spirit', p_spirit_id);
end;
$tafei$;

-- 6) 聊天页读取对方的公开伙伴信息（只暴露伙伴、皮肤、状态，不暴露私信/额度）
create or replace view public.tafei_spirit_public as
select
  user_id,
  selected_spirit,
  selected_skin,
  status,
  bond,
  updated_at
from public.tafei_spirit_profiles;

-- 7) 权限
alter table public.tafei_spirit_config enable row level security;
alter table public.tafei_spirit_profiles enable row level security;

drop policy if exists tafei_spirit_config_read on public.tafei_spirit_config;
create policy tafei_spirit_config_read on public.tafei_spirit_config
  for select to anon, authenticated using (true);

drop policy if exists tafei_spirit_config_admin_insert on public.tafei_spirit_config;
create policy tafei_spirit_config_admin_insert on public.tafei_spirit_config
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = '3659229103@qq.com');

drop policy if exists tafei_spirit_config_admin_update on public.tafei_spirit_config;
create policy tafei_spirit_config_admin_update on public.tafei_spirit_config
  for update to authenticated
  using ((auth.jwt() ->> 'email') = '3659229103@qq.com')
  with check ((auth.jwt() ->> 'email') = '3659229103@qq.com');

drop policy if exists tafei_spirit_profiles_select_own on public.tafei_spirit_profiles;
create policy tafei_spirit_profiles_select_own on public.tafei_spirit_profiles
  for select to authenticated using (auth.uid() = user_id);

grant select on public.tafei_spirit_config to anon, authenticated;
grant insert, update on public.tafei_spirit_config to authenticated;
grant select on public.tafei_spirit_profiles to authenticated;
grant select on public.tafei_spirit_public to authenticated;

revoke all on function public.tafei_spirit_save_state(jsonb) from public, anon;
revoke all on function public.tafei_spirit_buy(text, text) from public, anon;
grant execute on function public.tafei_spirit_save_state(jsonb) to authenticated;
grant execute on function public.tafei_spirit_buy(text, text) to authenticated;
revoke all on function public.tafei_admin_spirit_grant(uuid, text) from public, anon;
grant execute on function public.tafei_admin_spirit_grant(uuid, text) to authenticated;

commit;
