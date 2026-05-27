do $$
begin
  if to_regclass('public.telegram_bot_settings') is not null then
    execute 'drop policy if exists "Telegram bot settings live write" on public.telegram_bot_settings';
    execute 'create policy "Telegram bot settings live write" on public.telegram_bot_settings for all using (id = ''live'') with check (id = ''live'')';
  end if;
end
$$;
