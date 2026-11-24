-- 挞飞 · 头像字段（v21.2）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴 → Run（只需一次）
-- 作用：在个人资料表里增加 avatar_url，头像以压缩后的 data URL 存储。
-- 注意：不写入 auth.users 的 user_metadata，避免头像把登录 JWT 撑大。

alter table public.tafei_profiles
  add column if not exists avatar_url text;

comment on column public.tafei_profiles.avatar_url is '头像 data URL（前端裁剪为 256×256 JPEG）';

-- 日常检查
-- select id, nickname, char_length(avatar_url) as avatar_bytes from public.tafei_profiles order by created_at desc limit 20;
