drop index if exists public.customers_search_keywords_idx;

alter table public.customers
  drop column if exists search_keywords;
