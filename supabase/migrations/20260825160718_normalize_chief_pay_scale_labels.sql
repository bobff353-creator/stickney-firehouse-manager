-- Preserve the stable pay-scale IDs, rates, employee links, and rate history.
-- Only the user-facing titles change from employee-specific labels to ranks.
insert into firehouse.rank_permissions (rank, permission_key, allowed, updated_at)
select 'Chief', permission_key, allowed, updated_at
from firehouse.rank_permissions
where rank = 'Chief — O''Dowd'
on conflict (rank, permission_key) do nothing;

insert into firehouse.rank_permissions (rank, permission_key, allowed, updated_at)
select 'Deputy Chief', permission_key, allowed, updated_at
from firehouse.rank_permissions
where rank = 'Chief — Babinec'
on conflict (rank, permission_key) do nothing;

delete from firehouse.rank_permissions
where rank in ('Chief — O''Dowd', 'Chief — Babinec');

update firehouse.pay_scales
set label = case id
  when 'deputy-chief-1' then 'Chief'
  when 'deputy-chief-2' then 'Deputy Chief'
  else label
end
where id in ('deputy-chief-1', 'deputy-chief-2');
