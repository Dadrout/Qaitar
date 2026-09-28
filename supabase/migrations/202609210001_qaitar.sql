create extension if not exists vector with schema extensions;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  case_type text,
  status text not null default 'NEW_CASE',
  seller_name text,
  product_name text,
  amount numeric(14,2),
  currency text not null default 'KZT',
  purchase_date date,
  issue_summary text,
  seller_response_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  document_type text,
  extracted_data jsonb not null default '{}'::jsonb,
  analysis_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.case_events (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  language text not null default 'ru',
  source_url text not null,
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.legal_chunks (
  id uuid primary key default gen_random_uuid(),
  legal_document_id uuid not null references public.legal_documents(id) on delete cascade,
  law_name text not null,
  article text not null,
  section text,
  text text not null,
  language text not null default 'ru',
  source_url text not null,
  embedding extensions.vector(768),
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('russian', coalesce(law_name, '') || ' ' || coalesce(article, '') || ' ' || coalesce(text, ''))) stored
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type text not null,
  content text not null,
  file_path text,
  created_at timestamptz not null default now()
);

create index if not exists legal_chunks_embedding_hnsw on public.legal_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists legal_chunks_search_idx on public.legal_chunks using gin (search_vector);
create unique index if not exists legal_documents_title_source_unique on public.legal_documents(title, source_url);
create unique index if not exists legal_chunks_document_article_section_unique on public.legal_chunks(legal_document_id, article, section);
create index if not exists case_documents_case_idx on public.case_documents(case_id);
create index if not exists case_events_case_idx on public.case_events(case_id, created_at);

alter table public.cases enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_events enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_chunks enable row level security;
alter table public.generated_documents enable row level security;

revoke all on public.cases, public.case_documents, public.case_events, public.legal_documents, public.legal_chunks, public.generated_documents from anon, authenticated;
grant all on public.cases, public.case_documents, public.case_events, public.legal_documents, public.legal_chunks, public.generated_documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.hybrid_search_legal_chunks(
  query_text text,
  query_embedding extensions.vector(768),
  match_count integer default 6
)
returns table (
  id uuid,
  law_name text,
  article text,
  section text,
  text text,
  language text,
  source_url text,
  score double precision
)
language sql
stable
set search_path = ''
as $$
  with semantic as (
    select lc.id, row_number() over (order by lc.embedding OPERATOR(extensions.<=>) query_embedding) as rank
    from public.legal_chunks lc
    where lc.embedding is not null
    order by lc.embedding OPERATOR(extensions.<=>) query_embedding
    limit greatest(match_count * 4, 12)
  ),
  keyword as (
    select lc.id, row_number() over (order by ts_rank_cd(lc.search_vector, websearch_to_tsquery('russian', query_text)) desc) as rank
    from public.legal_chunks lc
    where lc.search_vector @@ websearch_to_tsquery('russian', query_text)
    order by ts_rank_cd(lc.search_vector, websearch_to_tsquery('russian', query_text)) desc
    limit greatest(match_count * 4, 12)
  ),
  fused as (
    select coalesce(semantic.id, keyword.id) as id,
      coalesce(1.0 / (60 + semantic.rank), 0.0) + coalesce(1.0 / (60 + keyword.rank), 0.0) as score
    from semantic full outer join keyword on semantic.id = keyword.id
  )
  select lc.id, lc.law_name, lc.article, lc.section, lc.text, lc.language, lc.source_url, fused.score
  from fused join public.legal_chunks lc on lc.id = fused.id
  order by fused.score desc
  limit least(greatest(match_count, 3), 6);
$$;

revoke all on function public.hybrid_search_legal_chunks(text, extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.hybrid_search_legal_chunks(text, extensions.vector, integer) to service_role;
