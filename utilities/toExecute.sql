create unique index campaign_participation_limit_1 on transactions (login_id, campaign_id) where type='credit_to_wallet' and status='PAID';
alter table logins add constraint check_below_zero CHECK (spin_count>(-1));
alter table leagues add constraint check_below_zero CHECK (spots>(-1));