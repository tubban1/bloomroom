create schema if not exists bloomroom;
revoke all on schema bloomroom from public, anon, authenticated;

create table if not exists bloomroom.postcards (
  id varchar(12) primary key,
  bouquet text not null,
  to_name varchar(64) not null default '',
  message varchar(240) not null default '',
  from_name varchar(64) not null default '',
  image_base64 text not null,
  created_at timestamptz not null default now(),
  constraint postcard_image_limit check (length(image_base64) <= 1400000),
  constraint postcard_bouquet_limit check (length(bouquet) <= 12000)
);

alter table bloomroom.postcards enable row level security;
revoke all on bloomroom.postcards from public, anon, authenticated;
