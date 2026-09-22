-- CRONOS / Prime Tech — catálogo financeiro dinâmico + vínculos em lançamentos/parcelas
-- Aplicar APÓS 0015_cronos_custom_profile_storage_policies.sql

begin;

-- Aceita todas as formas já oferecidas pela interface do Cronos.
alter table public.payment_installments
  drop constraint if exists payment_installments_payment_method_check;

alter table public.payment_installments
  add constraint payment_installments_payment_method_check
  check (payment_method in (
    'cash','pix','credit_card','debit_card','boleto','transfer','store_credit','check','other'
  ));

-- Ao liquidar uma parcela, preserva categoria/conta e competência no realizado.
create or replace function private.post_installment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.paid_at is not null
     and (tg_op = 'INSERT' or old.paid_at is null)
  then
    insert into public.financial_entries (
      company_id,
      type,
      category,
      category_id,
      account_id,
      competence_date,
      description,
      amount,
      occurred_at,
      service_order_id,
      payment_method,
      created_by,
      installment_id
    )
    values (
      new.company_id,
      new.type,
      new.category,
      new.category_id,
      new.account_id,
      coalesce(new.competence_date, new.due_date),
      new.description || ' (' || new.installment_number || '/' || new.installment_count || ')',
      new.amount,
      new.paid_at,
      new.service_order_id,
      new.payment_method,
      auth.uid(),
      new.id
    )
    on conflict (installment_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.post_installment() from public, anon;

drop trigger if exists post_installment on public.payment_installments;
create trigger post_installment
after insert or update
on public.payment_installments
for each row execute function private.post_installment();

-- Remove a assinatura anterior para o PostgREST não encontrar overload ambíguo.
drop function if exists public.create_payment_plan(
  uuid, uuid, text, text, text, numeric, integer, date, text, boolean
);

create or replace function public.create_payment_plan(
  p_request_id uuid,
  p_order_id uuid,
  p_type text,
  p_category text,
  p_description text,
  p_amount numeric,
  p_count integer,
  p_first_due date,
  p_method text,
  p_paid boolean default false,
  p_category_id uuid default null,
  p_account_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_company_count integer;
  v_order public.service_orders;
  v_category public.financial_categories;
  v_account public.financial_accounts;
  v_category_name text;
  v_n integer;
  v_cents bigint;
  v_base bigint;
  v_remainder bigint;
  v_piece numeric;
  v_due date;
begin
  if p_request_id is null then
    raise exception 'Identificador obrigatório';
  end if;

  if p_type not in ('income', 'expense') then
    raise exception 'Tipo financeiro inválido';
  end if;

  if p_amount is null
     or p_amount <= 0
     or p_amount <> round(p_amount, 2)
     or p_count is null
     or p_count not between 1 and 36
     or p_amount * 100 < p_count
     or p_first_due is null
     or length(trim(coalesce(p_description, ''))) < 3
  then
    raise exception 'Revise valor, parcelas, data e descrição';
  end if;

  if p_method not in (
    'cash','pix','credit_card','debit_card','boleto','transfer','store_credit','check','other'
  ) then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_paid and p_count <> 1 then
    raise exception 'Baixe cada parcela após confirmar o pagamento';
  end if;

  if p_order_id is not null then
    select * into v_order
    from public.service_orders
    where id = p_order_id;

    if not found then
      raise exception 'Ordem de Serviço não encontrada';
    end if;

    v_company := v_order.company_id;
  else
    select count(distinct u.company_id)
    into v_company_count
    from public.user_company_access u
    where u.user_id = auth.uid()
      and u.active = true
      and private.has_company_permission(u.company_id, 'finance.manage');

    if v_company_count <> 1 then
      raise exception 'Não foi possível determinar a empresa ativa para este lançamento';
    end if;

    select u.company_id
    into v_company
    from public.user_company_access u
    where u.user_id = auth.uid()
      and u.active = true
      and private.has_company_permission(u.company_id, 'finance.manage')
    order by u.company_id
    limit 1;
  end if;

  if v_company is null
     or not private.has_company_permission(v_company, 'finance.manage')
  then
    raise exception 'Usuário sem permissão financeira nesta empresa';
  end if;

  if p_category_id is not null then
    select * into v_category
    from public.financial_categories
    where id = p_category_id
      and company_id = v_company
      and active = true;

    if not found then
      raise exception 'Categoria financeira inválida para esta empresa';
    end if;

    if v_category.direction <> 'both' and v_category.direction <> p_type then
      raise exception 'A categoria financeira não aceita este tipo de lançamento';
    end if;

    v_category_name := v_category.name;
  else
    v_category_name := trim(coalesce(p_category, ''));
  end if;

  if length(v_category_name) = 0 then
    raise exception 'Categoria financeira obrigatória';
  end if;

  if p_account_id is not null then
    select * into v_account
    from public.financial_accounts
    where id = p_account_id
      and company_id = v_company
      and active = true;

    if not found then
      raise exception 'Conta financeira inválida para esta empresa';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_request_id::text));

  if exists (
    select 1
    from public.payment_installments
    where plan_id = p_request_id
  ) then
    return;
  end if;

  v_cents := round(p_amount * 100)::bigint;
  v_base := v_cents / p_count;
  v_remainder := v_cents % p_count;

  for v_n in 1..p_count loop
    v_piece := (
      v_base + case when v_n <= v_remainder then 1 else 0 end
    )::numeric / 100;

    v_due := (p_first_due + make_interval(months => v_n - 1))::date;

    insert into public.payment_installments (
      company_id,
      plan_id,
      installment_number,
      installment_count,
      service_order_id,
      type,
      category,
      category_id,
      account_id,
      competence_date,
      description,
      amount,
      due_date,
      payment_method,
      paid_at,
      created_by
    )
    values (
      v_company,
      p_request_id,
      v_n,
      p_count,
      p_order_id,
      p_type,
      v_category_name,
      p_category_id,
      p_account_id,
      v_due,
      trim(p_description),
      v_piece,
      v_due,
      p_method,
      case when p_paid then now() else null end,
      auth.uid()
    );
  end loop;
end;
$$;

revoke all on function public.create_payment_plan(
  uuid,uuid,text,text,text,numeric,integer,date,text,boolean,uuid,uuid
) from public, anon;

grant execute on function public.create_payment_plan(
  uuid,uuid,text,text,text,numeric,integer,date,text,boolean,uuid,uuid
) to authenticated;

commit;
