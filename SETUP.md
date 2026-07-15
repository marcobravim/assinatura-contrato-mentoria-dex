# Setup do App Assinatura de Contrato

Guia completo para colocar o sistema em produção. Segue a ordem recomendada — faça cada passo uma vez só.

## 0. Resumo do que precisa ser configurado

| Item | Onde | Valor |
|---|---|---|
| Template DOCX | Supabase Storage · bucket `templates` · arquivo `contrato-modelo.docx` | seu arquivo real (há um genérico em [tools/contrato-modelo.docx](tools/contrato-modelo.docx) para testar) |
| Usuário comercial | Supabase Auth | e-mails da Lancio |
| Token Autentique | Secret `AUTENTIQUE_TOKEN` | gerado no painel Autentique |
| Segredo webhook | Secret `AUTENTIQUE_WEBHOOK_SECRET` | você escolhe uma string forte |
| Service Account Google | Secret `GOOGLE_SA_JSON` | JSON baixado do Google Cloud |
| Pasta destino Drive | Secret `GOOGLE_DRIVE_FOLDER_ID` | ID da pasta (parte final da URL) |

**Project Supabase**: `mlvcghqxchrismnxbnho` · URL `https://mlvcghqxchrismnxbnho.supabase.co` · região `sa-east-1`.

---

## 1. Fazer upload do template DOCX

1. Abra o Supabase Dashboard → **Storage** → bucket `templates`.
2. Arraste o arquivo `contrato-modelo.docx` (seu ou o genérico em [tools/contrato-modelo.docx](tools/contrato-modelo.docx)).
3. O nome do arquivo deve ser **exatamente** `contrato-modelo.docx`.

### Placeholders suportados no template

O app usa o contrato Mentoria DSD (Cris Miura Treinamentos). Sintaxe `{nome}` (chave única — padrão do docxtemplater). Cada placeholder precisa estar numa mesma corrida de texto no Word (sem troca de fonte/cor no meio), senão o motor não reconhece.

**Identidade e contrato:**
- `{nome_completo}` — nome do participante
- `{cpf_cnpj}` — documento já formatado pelo form
- `{endereco}` — endereço completo em uma linha
- `{telefone}` — telefone/WhatsApp com DDD
- `{email}` — e-mail do signatário
- `{data_inicio}` — data de início (dd/mm/aaaa)
- `{data_hoje}` — preenchido no momento do envio
- `{modalidade}` — "INDIVIDUAL" ou "DUPLA"
- `{valor_entrada_reserva}` — valor da reserva de vaga, R$ formatado

**Bloco condicional Dupla (`{#dupla}…{/dupla}`):**
Aparece só se modalidade=DUPLA. Dentro dele use:
- `{socio_nome}` `{socio_cpf_cnpj}` `{socio_telefone}` `{socio_email}`

**Pagamento — bloco à vista (`{#forma_vista}…{/forma_vista}`):**
- `{vista_data}` — data do pagamento à vista
- `{vista_meio}` — "Cartão de crédito", "PIX"…

**Pagamento — bloco a prazo (`{#forma_prazo}…{/forma_prazo}`):**
- `{entrada_valor}` `{entrada_data}`
- `{parcelas_count}` `{parcela_valor}`
- Loop das parcelas para tabela: `{#parcelas}{numero}{data}{valor}{/parcelas}` — cada iteração gera uma linha

**Sempre disponíveis:**
- `{forma_pagamento}` — "À Vista" ou "A Prazo"
- `{valor_total}` — total formatado
- `{comercial_email}` — e-mail de quem enviou

> O arquivo em [tools/contrato-modelo.docx](tools/contrato-modelo.docx) já está pronto com todos esses placeholders espelhando o seu Google Doc original. Para editar/ajustar: use Word ou LibreOffice (abrir, editar, salvar como .docx mantendo os placeholders), depois suba o novo arquivo no bucket. Se precisar regerá-lo do zero pelo script, rode `cd tools && node gen-template.mjs`.

---

## 2. Criar usuário comercial (Supabase Auth)

1. Dashboard → **Authentication** → **Users** → **Add user → Create new user**.
2. Preencha e-mail (ex.: `comercial@lancio.com.br`) e senha.
3. Marque **Auto Confirm User** (evita fluxo de e-mail de confirmação).

Repita para cada pessoa do comercial.

---

## 3. Gerar token Autentique

1. Entre em [painel.autentique.com.br](https://painel.autentique.com.br) → **Integrações** → **API**.
2. **Gerar token** (guarde — só aparece uma vez).
3. Rode no terminal:
   ```bash
   supabase secrets set AUTENTIQUE_TOKEN=<token> --project-ref mlvcghqxchrismnxbnho
   supabase secrets set AUTENTIQUE_SANDBOX=true --project-ref mlvcghqxchrismnxbnho
   ```
   Ou use o dashboard: **Project Settings → Edge Functions → Secrets**.

> Mantenha `AUTENTIQUE_SANDBOX=true` até validar o fluxo completo. Documentos sandbox não consomem créditos e são apagados automaticamente em alguns dias. Troque para `false` quando for produção.

---

## 4. Criar Service Account do Google Drive

1. [Google Cloud Console](https://console.cloud.google.com) → crie (ou selecione) um projeto.
2. **APIs & Services → Library → Google Drive API → Enable**.
3. **IAM & Admin → Service Accounts → Create**.
   - Nome: `app-assinatura-contrato`.
   - Sem permissões de projeto (não é necessário).
4. No SA criado → **Keys → Add Key → JSON**. Baixe o arquivo.
5. Rode:
   ```bash
   supabase secrets set GOOGLE_SA_JSON="$(cat ~/Downloads/<arquivo>.json)" --project-ref mlvcghqxchrismnxbnho
   ```

---

## 5. Criar pasta no Drive e compartilhar com o SA

1. No seu Drive Workspace da Lancio, crie uma pasta `Contratos Assinados`.
2. Clique com direito → **Compartilhar** → cole o e-mail do Service Account (algo como `app-assinatura-contrato@seu-projeto.iam.gserviceaccount.com`) → papel **Editor**.
3. Abra a pasta e copie o ID da URL:  
   `https://drive.google.com/drive/folders/<FOLDER_ID>`
4. Rode:
   ```bash
   supabase secrets set GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID> --project-ref mlvcghqxchrismnxbnho
   ```

---

## 6. Definir segredo do webhook

```bash
# Gere uma string aleatória
openssl rand -hex 32

# Defina no Supabase
supabase secrets set AUTENTIQUE_WEBHOOK_SECRET=<string-gerada> --project-ref mlvcghqxchrismnxbnho
```

---

## 7. Configurar webhook no Autentique

1. Painel Autentique → **Integrações → Webhooks**.
2. URL: `https://mlvcghqxchrismnxbnho.supabase.co/functions/v1/autentique-webhook`.
3. Segredo: **o mesmo valor de `AUTENTIQUE_WEBHOOK_SECRET`** do passo anterior.
4. Ative os eventos: `document.finished`, `signature.viewed`, `signature.rejected`.

---

## 8. Rodar localmente

```bash
cd frontend
npm install   # se ainda não rodou
npm run dev   # abre http://localhost:5173
```

Entre com o usuário criado no passo 2 e teste criar um contrato. Em sandbox, a Autentique **não envia e-mail de verdade** — você vai ver o documento criado no painel deles.

---

## 9. Deploy do frontend

Quando tudo estiver validado em dev:

```bash
# Na raiz do projeto
/deploy
```

O comando roda a suíte E2E antes do FTP; aborta se detectar regressão.

---

## 10. Virar produção

Quando o fluxo sandbox funcionar fim a fim:

```bash
supabase secrets set AUTENTIQUE_SANDBOX=false --project-ref mlvcghqxchrismnxbnho
```

A partir daqui cada contrato consome crédito real do Autentique (~$0,01 + custo por canal).
