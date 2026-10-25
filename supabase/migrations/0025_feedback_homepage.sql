-- One-click "show this customer's comment on the homepage" for feedback responses.
-- Run once in the Supabase SQL editor, after 0024. Safe to deploy the code first: until this
-- is run the switch in /admin/feedback says it isn't set up and no feedback appears on the site.
--
-- Off by default. The app only lets it be switched on for a response that has a comment AND
-- whose author ticked "you may quote my comment" (quote_ok).

alter table feedback
  add column if not exists show_on_homepage boolean not null default false;
