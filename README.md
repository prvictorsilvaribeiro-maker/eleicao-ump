# Eleição da Diretoria UMP

Votação ao vivo durante o culto: membros votam pelo celular, a mesa controla tudo
pelo painel e o resultado aparece no datashow.

## Telas

| Rota      | Quem usa           | O que faz |
|-----------|--------------------|-----------|
| `/`       | Membros            | Cadastro (nome + senha), cédula, "aguardando encerramento" e resultados |
| `/admin`  | Mesa (você e pastor) | Abrir/encerrar votações, ver quem votou e quem falta, 2º turno, membros, candidatos, controle do telão |
| `/telao`  | Datashow           | QR code, progresso "X de Y votaram", resultado com a linha dos 50% e diretoria eleita |

## Regras implementadas

- Eleito quem tiver **mais de 50% de todos os votos** (abstenções contam no total). Exatamente 50% não elege.
- Sem maioria: o painel sugere o próximo turno com os **dois mais votados + todos empatados com o segundo**
  (ex.: 5, 3, 3, 3 → os quatro). A mesa pode ajustar a seleção.
- Turnos infinitos, ou **"Encerrar com o resultado atual"**: a mesa define o eleito.
- Quem foi eleito some das opções dos outros cargos.
- Resultado só aparece (para todos, inclusive a mesa) depois que a votação é encerrada.
- Ao abrir a primeira votação, os cadastros são encerrados automaticamente. Quem já se cadastrou
  continua conseguindo entrar com nome + senha em outro celular.
- Um voto por pessoa garantido no banco (chave primária em `participacoes`).

### Voto secreto
A tabela `participacoes` registra apenas **quem votou** (sem horário). Os votos são só
**contadores** em `votacao_opcoes`. Não existe nenhuma linha ligando pessoa e candidato,
então nem quem tem acesso ao banco consegue descobrir o voto de alguém.

## Setup

### 1. Supabase
1. Crie um projeto em supabase.com.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Project Settings > API**, copie a `Project URL` e a chave `service_role`.

### 2. Rodar local
```bash
cp .env.example .env.local   # preencha as duas variáveis
npm install
npm run dev
```

### 3. Deploy na Vercel
Importe o repositório e configure as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
A chave `service_role` fica só no servidor; o navegador nunca fala direto com o Supabase.

### 4. Criar os administradores
Você e o pastor se cadastram normalmente pela tela inicial e depois, no SQL Editor:
```sql
update usuarios set is_admin = true where nome_chave in ('victor fulano', 'pastor fulano');
```
(`nome_chave` é o nome em minúsculas, exatamente como foi digitado.)

## Roteiro no dia

1. Antes do culto: cadastre os candidatos em `/admin` e abra `/telao` no computador do datashow.
2. Telão no modo **QR code**; os membros se cadastram. Confira a lista e exclua quem não for membro.
3. **Nova votação**: escolha o cargo, marque os indicados e abra (cadastros fecham sozinhos).
4. Acompanhe "Faltam votar". Encerre. O telão mostra o resultado.
5. Sem maioria: confira a sugestão e clique em **Abrir 2º turno**.
6. Ao final, clique em **Diretoria eleita** no controle do telão.

## Para zerar e testar de novo
```sql
truncate participacoes, votacao_opcoes, votacoes cascade;
update configuracao set cadastro_aberto = true, telao_modo = 'auto';
-- opcional: delete from usuarios where not is_admin;
```

## Observações técnicas
- Atualização por polling (2 a 3 s). Para ~100 pessoas durante uma hora, fica tranquilo dentro
  do plano gratuito de Vercel e Supabase.
- Sessão: cookie httpOnly com token aleatório (30 dias); no banco fica só o hash sha256.
- Senhas com bcrypt.
