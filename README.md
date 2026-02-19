# Jira-Git

Scripts em Node.js para conectar às plataformas **Jira**, **GitHub** e **GitLab**, buscando informações sobre usuários e seus trabalhos.

## Pré-requisitos

- Node.js 18+
- Conta no Jira Cloud (Atlassian)
- Conta no GitHub
- Conta no GitLab (gitlab.com ou self-hosted)

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

2. Edite o arquivo `.env` com suas chaves:

### Jira

- **JIRA_BASE_URL**: URL da sua instância (ex: `https://sua-empresa.atlassian.net`)
- **JIRA_EMAIL**: Email da sua conta Atlassian
- **JIRA_API_TOKEN**: Gere em [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- **JIRA_USER_EMAIL** (opcional): Email de outro usuário para consultar issues. Se vazio, usa o usuário autenticado.

### GitHub

- **GITHUB_TOKEN**: Personal Access Token com permissões `repo`, `read:user`, `read:org`. Gere em [GitHub Tokens](https://github.com/settings/tokens)
- **GITHUB_USERNAME** (opcional): Usuário específico para consultar. Se vazio, usa o usuário autenticado.

### GitLab

- **GITLAB_URL** (opcional): URL base. Padrão: `https://gitlab.com`. Para self-hosted: `https://gitlab.sua-empresa.com`
- **GITLAB_TOKEN**: Personal Access Token. Gere em GitLab > Preferences > Access Tokens (read_api, read_user)
- **GITLAB_USERNAME** (opcional): Usuário específico para consultar. Se vazio, usa o usuário autenticado.

## Uso

### Referência de parâmetros

| Parâmetro | Onde | Descrição |
|-----------|------|-----------|
| `--user=X` | Jira, GitHub, GitLab | Usuário genérico (email para Jira, login para GitHub/GitLab) |
| `--jira-user=X` | Jira, `npm run all` | Email do usuário Jira |
| `--github-user=X` | GitHub, `npm run all` | Login do usuário GitHub |
| `--gitlab-user=X` | GitLab, `npm run all` | Login do usuário GitLab |
| `--last-days=XX` | Jira, GitHub, GitLab | Filtra dados dos últimos XX dias |
| `--content` | Jira issues, GitHub commits/merges, GitLab commits/merges | Inclui diff/conteúdo completo |
| `--worklogs` | `jira:issues`, `npm run all` | Inclui tempo trabalhado (worklog) por tarefa e total |
| `--var=var1,var2` | Todos os scripts | Retorna apenas as variáveis especificadas no JSON |
| `--max=N` | `jira:issues` | Máximo de issues (padrão: 50) |
| `--per-page=N` | GitHub/GitLab issues, commits, merges, activity | Itens por página (padrão: 30) |
| `--state=X` | GitHub/GitLab issues, merges | `open`, `closed`, `all` (GitHub) ou `opened`, `closed`, `all` (GitLab) |
| `--project=ID` | `gitlab:commits` | ID do projeto para commits detalhados |
| `--action=X` | `gitlab:activity` | Filtra por tipo de evento (ex: `pushed`) |
| `--all` | `npm run all` | Executa busca consolidada nas três plataformas |

### Conteúdo das alterações

Use `--content` para incluir o diff/conteúdo das alterações em commits, merge requests e issues do Jira:

```bash
npm run jira:issues -- --content
npm run github:commits -- --content
npm run github:merges -- --content --per-page=5
npm run gitlab:commits -- --project=353 --content
npm run gitlab:merges -- --content
npm run all -- --content
```

- **Jira issues**: todos os dados do ticket (campos, changelog, comentários), exceto anexos (arquivos e imagens)
- **GitHub commits**: diff em formato unificado
- **GitHub merges**: arquivos alterados com patch
- **GitLab commits**: diff por arquivo
- **GitLab merges**: alterações (changes) com diff

### Tempo trabalhado no Jira

Use `--worklogs` com `--last-days=XX` para incluir o tempo registrado em worklogs por tarefa e o total do usuário:

```bash
npm run jira:issues -- --worklogs --last-days=7
npm run jira:issues -- --user=joao@empresa.com --worklogs --last-days=14
npm run all -- --worklogs --last-days=7
```

- Cada issue ganha `timeWorkedSeconds` e `timeWorkedFormatted` (ex: "2h 30m")
- O resultado inclui `totalTimeWorkedSeconds` (soma de todas as tarefas)
- Requer time tracking habilitado no Jira

### Filtro por período

Use `--last-days=XX` para limitar os dados aos últimos XX dias (Jira, GitHub e GitLab):

```bash
npm run jira:issues -- --last-days=7
npm run github:commits -- --last-days=30
npm run all -- --last-days=14
```

### Filtro de variáveis no JSON

Use `--var=var1,var2,var3` para retornar apenas as variáveis especificadas no JSON. O filtro preserva caminhos aninhados que levam às chaves solicitadas:

```bash
npm run jira:issues -- --var=key,summary,status
npm run jira:issues -- --content --var=text_group,body   # comentários e descrição em texto
npm run github:commits -- --var=sha,message,url
npm run all -- --var=jira,github
```

### Usuário específico via linha de comando

Use `--user=X`, `--jira-user=X`, `--github-user=X` ou `--gitlab-user=X` para buscar dados de um usuário específico:

```bash
# Jira: usuário por email
npm run jira:user -- --user=joao@empresa.com
node src/jira/user-issues.js --jira-user=joao@empresa.com --max=20

# GitHub: usuário por login
npm run github:user -- --user=octocat
node src/github/user-issues.js --github-user=octocat --state=open

# GitLab: usuário por login
npm run gitlab:user -- --user=joao
node src/gitlab/user-issues.js --gitlab-user=joao --state=opened

# Consolidado (usa --user para todas as plataformas)
npm run all -- --jira-user=joao@empresa.com --github-user=octocat --gitlab-user=joao
```

### Jira

```bash
# Informações do usuário autenticado
npm run jira:user

# Usuário específico (por email)
npm run jira:user -- --user=email@exemplo.com

# Issues atribuídas ao usuário (padrão: 50)
npm run jira:issues

# Issues de outro usuário
npm run jira:issues -- --jira-user=email@exemplo.com

# Issues com limite customizado, conteúdo completo, worklogs e filtro de variáveis
npm run jira:issues -- --max=20 --content --worklogs --last-days=7 --var=key,summary,content
```

### GitHub

```bash
# Informações do usuário
npm run github:user

# Usuário específico (por login)
npm run github:user -- --user=octocat

# Issues atribuídas ao usuário
npm run github:issues

# Issues de outro usuário
npm run github:issues -- --github-user=octocat

# Com opções (state: open, closed, all)
npm run github:issues -- --state=open --per-page=50 --last-days=7 --var=title,url,state

# Commits do usuário
npm run github:commits
npm run github:commits -- --github-user=octocat --per-page=20 --content --last-days=30

# Pull requests (merges) criados pelo usuário
npm run github:merges
npm run github:merges -- --github-user=octocat --state=open --content --per-page=5

# Atividade recente (eventos)
npm run github:activity
npm run github:activity -- --github-user=octocat --per-page=20 --last-days=14
```

### GitLab

```bash
# Informações do usuário
npm run gitlab:user

# Usuário específico (por login)
npm run gitlab:user -- --user=joao

# Issues atribuídas ao usuário
npm run gitlab:issues

# Issues de outro usuário
npm run gitlab:issues -- --gitlab-user=joao

# Com opções (state: opened, closed, all)
npm run gitlab:issues -- --state=opened --per-page=50 --last-days=7 --var=title,url,state

# Commits (eventos de push) ou commits de um projeto específico
npm run gitlab:commits
npm run gitlab:commits -- --gitlab-user=joao --content --last-days=30
npm run gitlab:commits -- --project=123 --per-page=20 --content

# Merge requests criados pelo usuário
npm run gitlab:merges
npm run gitlab:merges -- --gitlab-user=joao --state=merged --content --per-page=5

# Atividade recente (eventos: push, comment, etc.)
npm run gitlab:activity
npm run gitlab:activity -- --gitlab-user=joao --action=pushed --per-page=20 --last-days=14
```

### Consolidado

```bash
# Busca dados do Jira, GitHub e GitLab em uma única execução
npm run all

# Com usuários específicos
npm run all -- --jira-user=email@empresa.com --github-user=usuario --gitlab-user=joao

# Com todas as opções
npm run all -- --jira-user=email@empresa.com --github-user=usuario --gitlab-user=joao --content --last-days=7 --var=jira,github,gitlab
```

## Estrutura do Projeto

```
jira-git/
├── src/
│   ├── config.js          # Carregamento das variáveis .env
│   ├── index.js           # Script principal consolidado
│   ├── jira/
│   │   ├── client.js      # Cliente HTTP Jira API v3
│   │   ├── user-info.js     # Informações do usuário
│   │   ├── user-issues.js   # Issues do usuário
│   │   └── user-worklogs.js # Tempo trabalhado (worklogs)
│   ├── github/
│   │   ├── client.js        # Cliente HTTP GitHub API
│   │   ├── user-info.js     # Informações do usuário
│   │   ├── user-issues.js   # Issues do usuário
│   │   ├── user-commits.js  # Commits do usuário
│   │   ├── user-merges.js   # Pull requests (merges)
│   │   └── user-activity.js # Atividade/eventos
│   ├── gitlab/
│   │   ├── client.js        # Cliente HTTP GitLab API v4
│   │   ├── user-info.js     # Informações do usuário
│   │   ├── user-issues.js    # Issues do usuário
│   │   ├── user-commits.js  # Commits (push events ou por projeto)
│   │   ├── user-merges.js   # Merge requests
│   │   └── user-activity.js # Atividade/eventos
│   └── utils/
│       └── parse-args.js  # Parser de argumentos CLI
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Licença

MIT
