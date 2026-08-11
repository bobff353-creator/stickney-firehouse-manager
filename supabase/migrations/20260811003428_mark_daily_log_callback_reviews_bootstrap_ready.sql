do $$
begin
  if to_regclass('firehouse.daily_log_callback_submissions') is null
     or to_regclass('firehouse.callback_review_settings') is null then
    raise exception 'Callback review schema must exist before advancing the runtime bootstrap marker';
  end if;

  insert into firehouse.system_meta(key,value,updated_at)
  values('runtime_bootstrap_version','stickney-runtime-bootstrap-2026-08-10-daily-log-callback-reviews-v1',now())
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
end $$;
