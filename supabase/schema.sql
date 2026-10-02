-- =====================================================================
-- Eleição da Diretoria UMP — schema
-- Rode este arquivo inteiro no SQL Editor do Supabase.
--
-- VOTO SECRETO: a tabela `participacoes` guarda QUEM votou (sem horário).
-- Os votos em si são apenas CONTADORES em `votacao_opcoes` / `votacoes`.
-- Não existe nenhuma linha que ligue um usuário a um candidato, nem
-- ordem de inserção ou timestamp que permita cruzar as duas coisas.
-- =====================================================================

create table if not exists configuracao (
  id int primary key default 1 check (id = 1),
  cadastro_aberto boolean not null default true,
  telao_modo text not null default 'auto' check (telao_modo in ('auto', 'qr', 'diretoria'))
);
insert into configuracao (id) values (1) on conflict do nothing;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_chave text not null unique,          -- nome em minúsculas, sem espaços duplicados
  senha_hash text not null,
  token_hash text unique,                   -- token do dispositivo (sha256)
  is_admin boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists cargos (
  id int primary key,
  nome text not null,
  ordem int not null
);
insert into cargos (id, nome, ordem) values
  (1, 'Presidente', 1),
  (2, 'Vice-presidente', 2),
  (3, 'Tesoureiro', 3),
  (4, 'Secretário', 4),
  (5, 'Comunicação', 5)
on conflict do nothing;

create table if not exists candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists candidatos_nome_ativo on candidatos (lower(nome)) where ativo;

create table if not exists votacoes (
  id uuid primary key default gen_random_uuid(),
  cargo_id int not null references cargos(id),
  turno int not null,
  status text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  total_votos int not null default 0,       -- inclui abstenções
  abstencoes int not null default 0,
  resultado text check (resultado in ('maioria', 'pendente', 'novo_turno', 'decisao_manual')),
  eleito_id uuid references candidatos(id),
  criada_em timestamptz not null default now(),
  encerrada_em timestamptz
);
-- Só pode existir UMA votação aberta por vez
create unique index if not exists votacoes_uma_aberta on votacoes (status) where status = 'aberta';

create table if not exists votacao_opcoes (
  votacao_id uuid not null references votacoes(id) on delete cascade,
  candidato_id uuid not null references candidatos(id),
  votos int not null default 0,
  primary key (votacao_id, candidato_id)
);

create table if not exists participacoes (
  votacao_id uuid not null references votacoes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),   -- sem cascade: quem votou não pode ser excluído
  primary key (votacao_id, usuario_id)                -- garante 1 voto por pessoa
);

-- ---------------------------------------------------------------------
-- Registrar voto (atômico). p_candidato NULL = abstenção.
-- ---------------------------------------------------------------------
create or replace function registrar_voto(p_usuario uuid, p_votacao uuid, p_candidato uuid)
returns void language plpgsql as $$
begin
  -- trava a linha da votação: serializa com o encerramento
  perform 1 from votacoes where id = p_votacao and status = 'aberta' for update;
  if not found then
    raise exception 'VOTACAO_FECHADA';
  end if;

  -- PK impede voto duplo (erro 23505)
  insert into participacoes (votacao_id, usuario_id) values (p_votacao, p_usuario);

  if p_candidato is null then
    update votacoes set abstencoes = abstencoes + 1, total_votos = total_votos + 1 where id = p_votacao;
  else
    update votacao_opcoes set votos = votos + 1 where votacao_id = p_votacao and candidato_id = p_candidato;
    if not found then
      raise exception 'CANDIDATO_INVALIDO';
    end if;
    update votacoes set total_votos = total_votos + 1 where id = p_votacao;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Criar votação (valida tudo e fecha os cadastros)
-- ---------------------------------------------------------------------
create or replace function criar_votacao(p_cargo int, p_candidatos uuid[])
returns uuid language plpgsql as $$
declare
  v_id uuid;
  v_turno int;
  v_qtd int;
begin
  if exists (select 1 from votacoes where status = 'aberta') then
    raise exception 'JA_EXISTE_ABERTA';
  end if;
  if exists (select 1 from votacoes where cargo_id = p_cargo and eleito_id is not null) then
    raise exception 'CARGO_CONCLUIDO';
  end if;

  select count(distinct c) into v_qtd from unnest(p_candidatos) c;
  if v_qtd = 0 then
    raise exception 'SEM_CANDIDATOS';
  end if;
  if exists (select 1 from votacoes where eleito_id = any(p_candidatos)) then
    raise exception 'CANDIDATO_JA_ELEITO';
  end if;
  if (select count(*) from candidatos where id = any(p_candidatos) and ativo) <> v_qtd then
    raise exception 'CANDIDATO_INVALIDO';
  end if;

  -- um turno pendente deste cargo vira "houve novo turno"
  update votacoes set resultado = 'novo_turno' where cargo_id = p_cargo and resultado = 'pendente';

  select count(*) + 1 into v_turno from votacoes where cargo_id = p_cargo;

  insert into votacoes (cargo_id, turno) values (p_cargo, v_turno) returning id into v_id;
  insert into votacao_opcoes (votacao_id, candidato_id)
    select v_id, c from (select distinct unnest(p_candidatos) as c) x;

  update configuracao set cadastro_aberto = false, telao_modo = 'auto' where id = 1;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Encerrar votação e apurar: eleito se tiver MAIS de 50% de TODOS os
-- votos (abstenções contam no total).
-- ---------------------------------------------------------------------
create or replace function encerrar_votacao(p_votacao uuid)
returns void language plpgsql as $$
declare
  v_total int;
  v_top record;
begin
  update votacoes set status = 'encerrada', encerrada_em = now()
   where id = p_votacao and status = 'aberta'
   returning total_votos into v_total;
  if not found then
    raise exception 'VOTACAO_NAO_ABERTA';
  end if;

  select candidato_id, votos into v_top
    from votacao_opcoes where votacao_id = p_votacao
   order by votos desc limit 1;

  if v_total > 0 and v_top.votos * 2 > v_total then
    update votacoes set eleito_id = v_top.candidato_id, resultado = 'maioria' where id = p_votacao;
  else
    update votacoes set resultado = 'pendente' where id = p_votacao;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Segurança: todo acesso passa pelo servidor Next.js (service_role).
-- RLS ligado sem policies = a chave anon não lê nem escreve nada.
-- ---------------------------------------------------------------------
alter table configuracao enable row level security;
alter table usuarios enable row level security;
alter table cargos enable row level security;
alter table candidatos enable row level security;
alter table votacoes enable row level security;
alter table votacao_opcoes enable row level security;
alter table participacoes enable row level security;

revoke execute on function registrar_voto(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function criar_votacao(int, uuid[]) from public, anon, authenticated;
revoke execute on function encerrar_votacao(uuid) from public, anon, authenticated;
