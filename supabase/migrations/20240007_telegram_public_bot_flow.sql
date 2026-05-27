alter table if exists public.telegram_bookings
  add column if not exists license_back_file_id text;

do $$
begin
  if to_regclass('public.telegram_customers') is not null then
    execute 'drop policy if exists "Service role only on telegram_customers" on public.telegram_customers';
    execute 'create policy "Telegram bot public access on telegram_customers" on public.telegram_customers for all using (true) with check (true)';
  end if;

  if to_regclass('public.telegram_bookings') is not null then
    execute 'drop policy if exists "Service role only on telegram_bookings" on public.telegram_bookings';
    execute 'create policy "Telegram bot public access on telegram_bookings" on public.telegram_bookings for all using (true) with check (true)';
  end if;

  if to_regclass('public.telegram_conversations') is not null then
    execute 'drop policy if exists "Service role only on telegram_conversations" on public.telegram_conversations';
    execute 'create policy "Telegram bot public access on telegram_conversations" on public.telegram_conversations for all using (true) with check (true)';
  end if;
end
$$;
