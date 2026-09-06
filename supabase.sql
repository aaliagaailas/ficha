-- ============================================================
--  Ficha · esquema de base de datos
--  Pega todo esto en Supabase > SQL Editor > New query > Run
-- ============================================================

-- Una fila por entrenador. Todo su CRM vive en la columna "datos".
create table if not exists public.entrenadores (
  id          uuid primary key references auth.users(id) on delete cascade,
  datos       jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- Sin esto, cualquiera podria leer la tabla entera.
alter table public.entrenadores enable row level security;

-- Cada entrenador solo ve y edita SU fila. Ni siquiera tu, como dueno
-- del proyecto, puedes leer sus datos desde la aplicacion.
drop policy if exists "leer lo propio"   on public.entrenadores;
drop policy if exists "crear lo propio"  on public.entrenadores;
drop policy if exists "editar lo propio" on public.entrenadores;
drop policy if exists "borrar lo propio" on public.entrenadores;

create policy "leer lo propio" on public.entrenadores
  for select using (auth.uid() = id);

create policy "crear lo propio" on public.entrenadores
  for insert with check (auth.uid() = id);

create policy "editar lo propio" on public.entrenadores
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "borrar lo propio" on public.entrenadores
  for delete using (auth.uid() = id);

-- Marca de tiempo automatica en cada guardado.
create or replace function public.toca_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

drop trigger if exists trg_actualizado on public.entrenadores;
create trigger trg_actualizado
  before update on public.entrenadores
  for each row execute function public.toca_actualizado();

-- ============================================================
--  Comprobacion rapida: deberia devolver 4 politicas
-- ============================================================
-- select policyname from pg_policies where tablename = 'entrenadores';
