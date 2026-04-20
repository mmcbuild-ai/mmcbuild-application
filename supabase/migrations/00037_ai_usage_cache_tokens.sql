-- Add prompt-cache token tracking to ai_usage_log.
-- Needed to measure hit/miss rates after enabling Anthropic prompt caching
-- on compliance calls (commit f616dd4).
--
-- cache_creation_tokens — tokens written to cache this call (billed 125% of base input)
-- cache_read_tokens      — tokens read from cache this call (billed 10% of base input)

alter table ai_usage_log
  add column if not exists cache_creation_tokens integer default 0,
  add column if not exists cache_read_tokens integer default 0;

comment on column ai_usage_log.cache_creation_tokens is
  'Anthropic prompt cache: input tokens written to cache on this call. Billed at 125% of base input price.';
comment on column ai_usage_log.cache_read_tokens is
  'Anthropic prompt cache: input tokens read from cache on this call. Billed at 10% of base input price (90% discount).';
