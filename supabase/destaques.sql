begin;

create schema if not exists juju_private;
revoke all on schema juju_private from public;

-- Break the RLS cycle between products and highlights while exposing only a boolean.
create or replace function juju_private.has_active_highlight(target_product_id bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.juju_highlights
    where product_id = target_product_id and active
  );
$$;
revoke all on function juju_private.has_active_highlight(bigint) from public;
grant execute on function juju_private.has_active_highlight(bigint) to anon, authenticated;

alter policy "published products" on public.juju_products using (
  active and (
    exists (select 1 from public.juju_categories c
            where c.id = juju_products.category_id and c.active)
    or juju_private.has_active_highlight(id)
  )
);

commit;
