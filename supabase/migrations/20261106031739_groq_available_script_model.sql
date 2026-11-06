-- Modelo disponível na conta em 06/11/2026. Não transportar prova/saldo do modelo antigo.
update public.mv_ai_free_allowances set enabled=false, grant_revision=gen_random_uuid()
where provider_id='groq' and model='llama-3.3-70b-versatile';
insert into public.mv_ai_free_allowances(provider_id,model)
values ('groq','openai/gpt-oss-20b') on conflict do nothing;
