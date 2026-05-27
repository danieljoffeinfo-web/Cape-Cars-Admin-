do $$
begin
  if to_regclass('public.telegram_sessions') is not null then
    execute 'drop policy if exists "Allow all on telegram_sessions" on public.telegram_sessions';
    execute 'create policy "Service role only on telegram_sessions" on public.telegram_sessions for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;

  if to_regclass('public.telegram_leads') is not null then
    execute 'drop policy if exists "Allow all on telegram_leads" on public.telegram_leads';
    execute 'create policy "Service role only on telegram_leads" on public.telegram_leads for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;

  if to_regclass('public.telegram_customers') is not null then
    execute 'drop policy if exists "Allow all on telegram_customers" on public.telegram_customers';
    execute 'create policy "Service role only on telegram_customers" on public.telegram_customers for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;

  if to_regclass('public.telegram_bookings') is not null then
    execute 'drop policy if exists "Allow all on telegram_bookings" on public.telegram_bookings';
    execute 'create policy "Service role only on telegram_bookings" on public.telegram_bookings for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;

  if to_regclass('public.telegram_conversations') is not null then
    execute 'drop policy if exists "Allow all on telegram_conversations" on public.telegram_conversations';
    execute 'create policy "Service role only on telegram_conversations" on public.telegram_conversations for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end
$$;
