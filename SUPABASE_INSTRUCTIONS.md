
# Configuración de Base de Datos (Supabase)

Copia y pega el siguiente código en el **SQL Editor** de tu panel de Supabase para habilitar el guardado en la nube y el sistema de contenido dinámico.

```sql
-- ==============================================================================
-- 1. SAVE SLOTS (Persistencia de Jugador)
-- ==============================================================================

create table if not exists save_slots (
  user_id uuid references auth.users not null,
  slot_index int not null,
  data jsonb not null,
  summary jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, slot_index)
);

alter table save_slots enable row level security;

-- Permitir leer solo mis propios slots
create policy "Users can select their own saves"
  on save_slots for select
  using (auth.uid() = user_id);

-- Permitir crear mis propios slots
create policy "Users can insert their own saves"
  on save_slots for insert
  with check (auth.uid() = user_id);

-- Permitir actualizar mis propios slots
create policy "Users can update their own saves"
  on save_slots for update
  using (auth.uid() = user_id);

-- ==============================================================================
-- 2. GAME DEFINITIONS (Contenido Dinámico / Admin Dashboard)
-- ==============================================================================

create table if not exists game_definitions (
  id text primary key,
  category text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

alter table game_definitions enable row level security;

-- Todo el mundo puede descargar los datos del juego (Items, Enemigos)
create policy "Everyone can read game definitions"
  on game_definitions for select
  using (true);

-- Solo usuarios logueados pueden subir cambios desde el Admin Dashboard
-- (Idealmente restringir esto a emails específicos en producción)
create policy "Authenticated users can manage definitions"
  on game_definitions for all
  using (auth.role() = 'authenticated');
```
