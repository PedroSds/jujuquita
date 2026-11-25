begin;
alter table public.juju_categories add column if not exists show_name boolean not null default true;

do $migration$
declare
  definition text := pg_get_functiondef('public.juju_save(jsonb,bigint)'::regprocedure);
  updated text;
begin
  if position('show_name=excluded.show_name' in definition) = 0 then
    updated := replace(definition,
      'public.juju_categories(id,name,active,sort_order,image_url)',
      'public.juju_categories(id,name,active,sort_order,image_url,show_name)');
    updated := replace(updated,
      'select id,name,active,sort_order,image_url from jsonb_to_recordset(payload->''categories'') as r(id bigint,name text,active boolean,sort_order int,image_url text)',
      'select r.id,r.name,r.active,r.sort_order,r.image_url,coalesce(r.show_name,(select c.show_name from public.juju_categories c where c.id=r.id),true) from jsonb_to_recordset(payload->''categories'') as r(id bigint,name text,active boolean,sort_order int,image_url text,show_name boolean)');
    updated := replace(updated,
      'sort_order=excluded.sort_order,image_url=excluded.image_url;',
      'sort_order=excluded.sort_order,image_url=excluded.image_url,show_name=excluded.show_name;');
    if position('image_url,show_name)' in updated) = 0 or
       position('coalesce(r.show_name' in updated) = 0 or
       position('show_name=excluded.show_name' in updated) = 0 then
      raise exception 'Estrutura de juju_save inesperada; revisão necessária';
    end if;
    execute updated;
  end if;
end
$migration$;

commit;

select 'Opção de nome da categoria instalada' as resultado;
