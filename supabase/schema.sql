create extension if not exists pgcrypto;

do $$
begin
    create type public.app_role as enum ('manager', 'client');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.request_status as enum (
        'new',
        'negotiating',
        'confirmed',
        'completed',
        'cancelled'
    );
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.cash_kind as enum ('income', 'expense');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.loyalty_transaction_type as enum (
        'earned',
        'redeemed',
        'adjustment',
        'expired'
    );
exception
    when duplicate_object then null;
end
$$;


create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    phone text,
    role public.app_role not null default 'client',
    created_at timestamptz not null default now()
);

create index if not exists idx_profiles_phone
    on public.profiles(phone);


create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique references auth.users(id) on delete set null,
    full_name text not null,
    phone text not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_clients_user_id
    on public.clients(user_id);

create index if not exists idx_clients_phone
    on public.clients(phone);


create table if not exists public.professionals (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    specialty text not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);


create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    price numeric(10,2) not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    constraint services_price_check check (price >= 0)
);

create index if not exists idx_services_active
    on public.services(active);


insert into public.services (name, price)
select x.name, 0
from (
    values
        ('Corte de cabelo'),
        ('Escova'),
        ('Progressiva'),
        ('Hidratação'),
        ('Coloração'),
        ('Manicure'),
        ('Pedicure')
) as x(name)
where not exists (
    select 1
    from public.services s
    where lower(s.name) = lower(x.name)
);


create table if not exists public.vouchers (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    description text,
    discount_percent numeric(5,2) not null default 0,
    active boolean not null default true,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    constraint vouchers_discount_check
        check (discount_percent >= 0 and discount_percent <= 100)
);


create table if not exists public.news (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);


create table if not exists public.beauty_tips (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    category text,
    image_url text,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create index if not exists idx_beauty_tips_active
    on public.beauty_tips(active);


create table if not exists public.service_requests (
    id uuid primary key default gen_random_uuid(),
    client_id uuid,
    service_id uuid,
    professional_id uuid,
    preferred_date text,
    scheduled_at timestamptz,
    notes text,
    voucher_code text,
    negotiated_price numeric(10,2),
    status public.request_status not null default 'new',
    created_at timestamptz not null default now()
);


alter table public.service_requests
    add column if not exists client_id uuid;

alter table public.service_requests
    add column if not exists service_id uuid;

alter table public.service_requests
    add column if not exists professional_id uuid;

alter table public.service_requests
    add column if not exists preferred_date text;

alter table public.service_requests
    add column if not exists scheduled_at timestamptz;

alter table public.service_requests
    add column if not exists notes text;

alter table public.service_requests
    add column if not exists voucher_code text;

alter table public.service_requests
    add column if not exists negotiated_price numeric(10,2);


create table if not exists public.cash_entries (
    id uuid primary key default gen_random_uuid(),
    client_id uuid,
    service_id uuid,
    request_id uuid,
    kind public.cash_kind not null,
    description text not null,
    amount numeric(10,2) not null,
    occurred_at timestamptz not null default now(),
    constraint cash_amount_check check (amount >= 0)
);

alter table public.cash_entries
    add column if not exists client_id uuid;

alter table public.cash_entries
    add column if not exists service_id uuid;

alter table public.cash_entries
    add column if not exists request_id uuid;

create index if not exists idx_cash_entries_client
    on public.cash_entries(client_id);

create index if not exists idx_cash_entries_occurred_at
    on public.cash_entries(occurred_at);


create table if not exists public.loyalty_settings (
    id integer primary key default 1,
    program_active boolean not null default true,
    points_per_completed_service integer not null default 10,
    points_validity_days integer not null default 365,
    updated_at timestamptz not null default now(),
    constraint loyalty_settings_singleton check (id = 1),
    constraint loyalty_points_check check (points_per_completed_service >= 0)
);

alter table public.loyalty_settings
    add column if not exists points_validity_days integer not null default 365;


insert into public.loyalty_settings (
    id,
    program_active,
    points_per_completed_service
)
values (
    1,
    true,
    10
)
on conflict (id) do nothing;


create table if not exists public.loyalty_rewards (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    points_required integer not null,
    bonus_value numeric(10,2),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    constraint loyalty_reward_points_check check (points_required > 0),
    constraint loyalty_reward_bonus_check
        check (bonus_value is null or bonus_value >= 0)
);


create table if not exists public.loyalty_transactions (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    request_id uuid references public.service_requests(id) on delete set null,
    reward_id uuid references public.loyalty_rewards(id) on delete set null,
    points integer not null,
    transaction_type public.loyalty_transaction_type not null,
    description text not null,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    constraint loyalty_transaction_points_check check (points <> 0)
);

alter table public.loyalty_transactions
    add column if not exists expires_at timestamptz;


create index if not exists idx_loyalty_transactions_client
    on public.loyalty_transactions(client_id);

create index if not exists idx_loyalty_transactions_request
    on public.loyalty_transactions(request_id);


alter table public.service_requests
    drop constraint if exists service_requests_client_id_fkey;

alter table public.service_requests
    drop constraint if exists service_requests_service_id_fkey;

alter table public.service_requests
    drop constraint if exists service_requests_professional_id_fkey;


do $$
begin
    update public.service_requests sr
    set client_id = c.id
    from public.clients c
    where sr.client_id = c.user_id
      and sr.client_id is not null;
exception
    when undefined_column then
        null;
end
$$;


do $$
begin
    if not exists (
        select 1
        from public.service_requests sr
        where sr.client_id is not null
          and not exists (
              select 1
              from public.clients c
              where c.id = sr.client_id
          )
    ) then
        null;
    end if;
end
$$;


do $$
begin
    alter table public.service_requests
        add constraint service_requests_client_id_fkey
        foreign key (client_id)
        references public.clients(id)
        on delete cascade;
exception
    when duplicate_object then null;
end
$$;


do $$
begin
    alter table public.service_requests
        add constraint service_requests_service_id_fkey
        foreign key (service_id)
        references public.services(id)
        on delete restrict;
exception
    when duplicate_object then null;
end
$$;


do $$
begin
    alter table public.service_requests
        add constraint service_requests_professional_id_fkey
        foreign key (professional_id)
        references public.professionals(id)
        on delete set null;
exception
    when duplicate_object then null;
end
$$;


create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'manager'
    );
$$;


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        phone,
        role
    )
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'full_name',
            'Cliente'
        ),
        new.raw_user_meta_data ->> 'phone',
        'client'
    )
    on conflict (id) do update
    set
        full_name = excluded.full_name,
        phone = excluded.phone;

    insert into public.clients (
        user_id,
        full_name,
        phone
    )
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'full_name',
            'Cliente'
        ),
        coalesce(
            new.raw_user_meta_data ->> 'phone',
            ''
        )
    )
    on conflict (user_id) do update
    set
        full_name = excluded.full_name,
        phone = excluded.phone;

    return new;
end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


insert into public.clients (
    user_id,
    full_name,
    phone,
    active
)
select
    p.id,
    p.full_name,
    coalesce(p.phone, ''),
    true
from public.profiles p
where p.role = 'client'
  and not exists (
      select 1
      from public.clients c
      where c.user_id = p.id
  );


alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.vouchers enable row level security;
alter table public.news enable row level security;
alter table public.beauty_tips enable row level security;
alter table public.service_requests enable row level security;
alter table public.cash_entries enable row level security;
alter table public.loyalty_settings enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_transactions enable row level security;


drop policy if exists profiles_select_own_or_manager
on public.profiles;

drop policy if exists profiles_insert_manager
on public.profiles;

drop policy if exists profiles_update_own_or_manager
on public.profiles;

drop policy if exists profiles_delete_manager
on public.profiles;


drop policy if exists clients_manager_all
on public.clients;

drop policy if exists clients_client_select
on public.clients;

drop policy if exists clients_client_update
on public.clients;


drop policy if exists professionals_select_authenticated
on public.professionals;

drop policy if exists professionals_manager_write
on public.professionals;


drop policy if exists services_manager_select
on public.services;

drop policy if exists services_authenticated_select
on public.services;

drop policy if exists services_manager_write
on public.services;


drop policy if exists vouchers_select_authenticated
on public.vouchers;

drop policy if exists vouchers_manager_write
on public.vouchers;


drop policy if exists news_select_authenticated
on public.news;

drop policy if exists news_manager_write
on public.news;


drop policy if exists beauty_tips_select_authenticated
on public.beauty_tips;

drop policy if exists beauty_tips_manager_write
on public.beauty_tips;


drop policy if exists requests_client_select_own
on public.service_requests;

drop policy if exists requests_client_insert_own
on public.service_requests;

drop policy if exists requests_manager_insert
on public.service_requests;

drop policy if exists requests_manager_update
on public.service_requests;

drop policy if exists requests_manager_delete
on public.service_requests;


drop policy if exists cash_manager_all
on public.cash_entries;


drop policy if exists loyalty_settings_authenticated_select
on public.loyalty_settings;

drop policy if exists loyalty_settings_manager_write
on public.loyalty_settings;


drop policy if exists loyalty_rewards_authenticated_select
on public.loyalty_rewards;

drop policy if exists loyalty_rewards_manager_write
on public.loyalty_rewards;


drop policy if exists loyalty_transactions_client_select
on public.loyalty_transactions;

drop policy if exists loyalty_transactions_manager_select
on public.loyalty_transactions;

drop policy if exists loyalty_transactions_manager_insert
on public.loyalty_transactions;


create policy profiles_select_own_or_manager
on public.profiles
for select
using (
    id = auth.uid()
    or public.is_manager()
);


create policy profiles_insert_manager
on public.profiles
for insert
with check (
    public.is_manager()
);


create policy profiles_update_own_or_manager
on public.profiles
for update
using (
    id = auth.uid()
    or public.is_manager()
)
with check (
    id = auth.uid()
    or public.is_manager()
);


create policy profiles_delete_manager
on public.profiles
for delete
using (
    public.is_manager()
);


create policy clients_manager_all
on public.clients
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy clients_client_select
on public.clients
for select
using (
    user_id = auth.uid()
);


create policy clients_client_update
on public.clients
for update
using (
    user_id = auth.uid()
)
with check (
    user_id = auth.uid()
);


create policy professionals_select_authenticated
on public.professionals
for select
using (
    auth.uid() is not null
    and (
        active = true
        or public.is_manager()
    )
);


create policy professionals_manager_write
on public.professionals
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy services_authenticated_select
on public.services
for select
using (
    auth.uid() is not null
    and (
        active = true
        or public.is_manager()
    )
);


create policy services_manager_write
on public.services
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy vouchers_select_authenticated
on public.vouchers
for select
using (
    auth.uid() is not null
);


create policy vouchers_manager_write
on public.vouchers
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy news_select_authenticated
on public.news
for select
using (
    auth.uid() is not null
    and (
        active = true
        or public.is_manager()
    )
);


create policy news_manager_write
on public.news
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy beauty_tips_select_authenticated
on public.beauty_tips
for select
using (
    auth.uid() is not null
    and (
        active = true
        or public.is_manager()
    )
);


create policy beauty_tips_manager_write
on public.beauty_tips
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy requests_client_select_own
on public.service_requests
for select
using (
    public.is_manager()
    or exists (
        select 1
        from public.clients c
        where c.id = service_requests.client_id
          and c.user_id = auth.uid()
    )
);


create policy requests_client_insert_own
on public.service_requests
for insert
with check (
    exists (
        select 1
        from public.clients c
        where c.id = service_requests.client_id
          and c.user_id = auth.uid()
    )
);


create policy requests_manager_insert
on public.service_requests
for insert
with check (
    public.is_manager()
);


create policy requests_manager_update
on public.service_requests
for update
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy requests_manager_delete
on public.service_requests
for delete
using (
    public.is_manager()
);


create or replace function public.create_service_requests(
    _service_ids uuid[],
    _notes text default null,
    _voucher_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_client_id uuid;
    v_requested_count integer;
    v_inserted_count integer;
begin
    select c.id
    into v_client_id
    from public.clients c
    where c.user_id = auth.uid()
      and c.active = true;

    if v_client_id is null then
        raise exception 'O cliente não está cadastrado na sua conta.';
    end if;

    select count(*)
    into v_requested_count
    from unnest(_service_ids) as requested(service_id)
    join public.services s on s.id = requested.service_id
    where s.active = true;

    if coalesce(v_requested_count, 0) = 0
       or v_requested_count <> coalesce(array_length(_service_ids, 1), 0)
    then
        raise exception 'Um ou mais serviços selecionados não estão disponíveis.';
    end if;

    insert into public.service_requests (
        client_id,
        service_id,
        notes,
        voucher_code,
        status
    )
    select
        v_client_id,
        requested.service_id,
        nullif(trim(_notes), ''),
        nullif(trim(_voucher_code), ''),
        'new'
    from unnest(_service_ids) as requested(service_id);

    get diagnostics v_inserted_count = row_count;

    if v_inserted_count <> v_requested_count then
        raise exception 'Não foi possível criar todas as solicitações.';
    end if;
end;
$$;


grant execute
on function public.create_service_requests(uuid[], text, text)
to authenticated;


create policy cash_manager_all
on public.cash_entries
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy loyalty_settings_authenticated_select
on public.loyalty_settings
for select
using (
    auth.uid() is not null
);


create policy loyalty_settings_manager_write
on public.loyalty_settings
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy loyalty_rewards_authenticated_select
on public.loyalty_rewards
for select
using (
    auth.uid() is not null
    and (
        active = true
        or public.is_manager()
    )
);


create policy loyalty_rewards_manager_write
on public.loyalty_rewards
for all
using (
    public.is_manager()
)
with check (
    public.is_manager()
);


create policy loyalty_transactions_client_select
on public.loyalty_transactions
for select
using (
    exists (
        select 1
        from public.clients c
        where c.id = loyalty_transactions.client_id
          and c.user_id = auth.uid()
    )
);


create policy loyalty_transactions_manager_select
on public.loyalty_transactions
for select
using (
    public.is_manager()
);


create policy loyalty_transactions_manager_insert
on public.loyalty_transactions
for insert
with check (
    public.is_manager()
);


drop view if exists public.client_services;

create view public.client_services
with (security_invoker = true)
as
select
    id,
    name,
    active
from public.services
where active = true;


grant select
on public.client_services
to authenticated;


drop view if exists public.my_loyalty_summary;

create view public.my_loyalty_summary
with (security_invoker = true)
as
select
    c.id as client_id,
    c.full_name,
    coalesce(sum(lt.points), 0)::integer as total_points
from public.clients c
left join public.loyalty_transactions lt
    on lt.client_id = c.id
where c.user_id = auth.uid()
group by
    c.id,
    c.full_name;


grant select
on public.my_loyalty_summary
to authenticated;


drop view if exists public.manager_service_requests;

create view public.manager_service_requests
with (security_invoker = true)
as
select
    sr.id,
    c.id as client_id,
    c.full_name as client_name,
    c.phone as client_phone,
    s.id as service_id,
    s.name as service_name,
    s.price as service_base_price,
    p.id as professional_id,
    p.name as professional_name,
    p.specialty as professional_specialty,
    sr.preferred_date,
    sr.scheduled_at,
    sr.notes,
    sr.voucher_code,
    sr.negotiated_price,
    sr.status,
    sr.created_at
from public.service_requests sr
join public.clients c
    on c.id = sr.client_id
join public.services s
    on s.id = sr.service_id
left join public.professionals p
    on p.id = sr.professional_id;


grant select
on public.manager_service_requests
to authenticated;


create or replace function public.award_loyalty_for_completed_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_program_active boolean;
    v_points integer;
    v_validity_days integer;
    v_already_earned boolean;
begin

    if new.status = 'completed'
       and old.status is distinct from new.status
    then

        select
            program_active,
            points_per_completed_service,
            points_validity_days
        into
            v_program_active,
            v_points,
            v_validity_days
        from public.loyalty_settings
        where id = 1;

        if coalesce(v_program_active, false)
           and coalesce(v_points, 0) > 0
        then

            select exists (
                select 1
                from public.loyalty_transactions
                where request_id = new.id
                  and transaction_type = 'earned'
            )
            into v_already_earned;

            if not v_already_earned then

                insert into public.loyalty_transactions (
                    client_id,
                    request_id,
                    points,
                    transaction_type,
                    description,
                    expires_at
                )
                values (
                    new.client_id,
                    new.id,
                    v_points,
                    'earned',
                    'Pontos por serviço concluído',
                    now() + make_interval(days => greatest(coalesce(v_validity_days, 365), 0))
                );

            end if;

        end if;

    end if;

    return new;

end;
$$;


drop trigger if exists trg_award_loyalty_completed
on public.service_requests;


create trigger trg_award_loyalty_completed
after update of status
on public.service_requests
for each row
execute procedure public.award_loyalty_for_completed_request();


insert into public.loyalty_rewards (
    name,
    description,
    points_required,
    bonus_value,
    active
)
select
    'Bônus de R$ 30,00',
    'Recompensa de fidelidade',
    100,
    30,
    true
where not exists (
    select 1
    from public.loyalty_rewards
    where lower(name) = lower('Bônus de R$ 30,00')
);


insert into public.loyalty_rewards (
    name,
    description,
    points_required,
    bonus_value,
    active
)
select
    'Bônus de R$ 50,00',
    'Recompensa de fidelidade',
    200,
    50,
    true
where not exists (
    select 1
    from public.loyalty_rewards
    where lower(name) = lower('Bônus de R$ 50,00')
);


select
    table_name
from information_schema.tables
where table_schema = 'public'
and table_name in (
    'profiles',
    'clients',
    'professionals',
    'services',
    'vouchers',
    'news',
    'beauty_tips',
    'service_requests',
    'cash_entries',
    'loyalty_settings',
    'loyalty_rewards',
    'loyalty_transactions'
)
order by table_name;