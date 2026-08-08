# AZO Studio — configuração administrativa

O painel administrativo fica em `/admin/` e **não possui link, botão ou referência visível no site público**.

## 1. Ativar os serviços no projeto Firebase

No projeto `projectazo-9ed9d`:

1. Authentication → Sign-in method → habilite **Email/Password**.
2. Firestore Database → crie o banco padrão em modo de produção.
3. Storage → ative o bucket `projectazo-9ed9d.firebasestorage.app`.

## 2. Criar o administrador

Em Authentication → Users, crie o usuário administrativo com e-mail e senha fortes.

Copie o `UID` desse usuário e, no Firestore, crie manualmente:

- coleção: `admins`
- documento: `<UID do usuário>`
- campos:
  - `active`: `true` (boolean)
  - `name`: nome exibido no painel (string, opcional)

O painel **não possui cadastro público**. Uma conta autenticada que não tenha um documento ativo em `admins/{uid}` é desconectada e não recebe permissão de escrita.

## 3. Publicar as regras de segurança

Os arquivos versionados nesta PR são:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

Com Firebase CLI autenticado no projeto:

```bash
firebase use projectazo-9ed9d
firebase deploy --only firestore:rules,storage
```

As regras deixam a leitura do conteúdo público liberada para o site, mas restringem alterações de textos, projetos e uploads ao usuário autenticado que estiver na coleção `admins` com `active: true`.

## 4. Domínios autorizados

Em Authentication → Settings → Authorized domains, mantenha apenas os domínios realmente usados pelo site e pelo ambiente de teste.

## 5. Como o painel funciona

- **Textos & títulos:** detecta os textos das páginas, título da aba, meta description e textos Open Graph e salva apenas as diferenças no Firestore.
- **Todas as imagens:** contém um manifesto com as 87 imagens existentes, inclusive imagens de galerias que não aparecem no HTML até a lightbox ser aberta. Uma substituição é enviada ao Firebase Storage e passa a substituir a imagem original no site.
- **Projetos:** cria projetos extras com múltiplas imagens no Storage. Projetos publicados aparecem automaticamente em `projetos.html`.
- **Restaurar imagem:** remove a substituição do Firestore/Storage e volta imediatamente para o arquivo original do repositório.

## Segurança

A configuração pública do Firebase (`apiKey`, `projectId`, etc.) identifica o app web e não funciona como senha administrativa. A proteção de gravação está nas regras do Firestore/Storage e na validação do UID administrativo.

Não adicione uma rota de cadastro público nem altere as regras para `allow write: if request.auth != null`; isso permitiria que qualquer usuário autenticado gravasse conteúdo.
