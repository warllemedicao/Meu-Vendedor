-- Histórias: escolha de tipo de personagem independente do gênero e da plataforma.
-- Histórias antigas ficam com 'nao_definido' para não atribuir retrospectivamente um estilo.
alter table public.mv_story_topics
  add column if not exists character_style text not null default 'nao_definido';
alter table public.mv_story_projects
  add column if not exists character_style text not null default 'nao_definido';

alter table public.mv_story_topics
  add constraint mv_story_topics_character_style_check
  check (character_style in ('nao_definido', 'frutinhas', 'infantil', 'pessoas_cabeca_fruta'));
alter table public.mv_story_projects
  add constraint mv_story_projects_character_style_check
  check (character_style in ('nao_definido', 'frutinhas', 'infantil', 'pessoas_cabeca_fruta'));

-- Permitir mesmo título com estilos diferentes sem sobrescrever temas existentes.
alter table public.mv_story_topics drop constraint if exists mv_story_topics_user_id_subject_title_key;
alter table public.mv_story_topics
  add constraint mv_story_topics_user_subject_title_style_key
  unique (user_id, subject, title, character_style);
