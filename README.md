# Bárbara & Felipe — Save the Date

Experiência editorial mobile-first em Next.js 15, React 19 e TypeScript. Todo o convite acontece em uma única viewport: oceano interativo, composição fotográfica e convite formam três atos controlados por estado React, sem rolagem da página ou mudança de rota. O áudio permanece montado e contínuo entre as cenas.

## Executar localmente

Requer Node.js 22 ou superior, pois a persistência utiliza o módulo nativo `node:sqlite`.

```bash
npm install
npm run dev
```

Produção:

```bash
npm run build
npm run start
```

## Configuração

Copie `.env.example` para `.env.local` em desenvolvimento ou configure as mesmas variáveis no ambiente de hospedagem:

```env
INVITATIONS_DB_PATH=/caminho/em/volume-persistente/invitations.sqlite
INVITATION_DATA_KEY=chave-base64-de-32-bytes
NEXT_PUBLIC_SITE_URL=https://seu-dominio.com.br
```

Gere a chave de criptografia com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- `INVITATION_DATA_KEY` é obrigatória em produção. Nunca a versione.
- `INVITATIONS_DB_PATH` deve apontar para um volume persistente com backup. O padrão local é `.data/invitations.sqlite`.
- `NEXT_PUBLIC_SITE_URL` define a URL absoluta usada nos metadados sociais.
- Em desenvolvimento, se não houver chave, o projeto cria uma chave local privada em `.data/development.key`.

## Persistência e privacidade

Os endereços são gravados em SQLite fora da pasta pública. Cada payload é criptografado com AES-256-GCM e IV aleatório; o banco guarda apenas o conteúdo cifrado, metadados técnicos e um hash irreversível do endereço de rede usado para limitar abuso. A API expõe somente `POST /api/invitations`: não existe rota pública de listagem ou leitura.

O formulário valida os campos no navegador e o endpoint repete a validação no servidor. A API limita o corpo real da requisição, verifica a origem, usa campo-isca contra robôs e aplica limite de cinco envios por hora por hash. A verificação do limite e a gravação acontecem sob a mesma transação SQLite. Para consultar ou exportar os dados, crie uma ferramenta administrativa autenticada fora da área pública — não adicione uma rota GET sem controle de acesso.

## Fotografias

As fotos selecionadas do ZIP foram convertidas para WebP em `public/photos`, com até 2400 px e qualidade 86–90. O componente `next/image` entrega dimensões responsivas e lazy loading para todas as imagens abaixo da dobra. Para regenerar os ativos:

```bash
node scripts/prepare_photos.mjs <pasta-com-jpgs> public/photos
```

## Mídia da abertura e som

A abertura utiliza somente duas mídias visuais, centralizadas em `OCEAN_MEDIA` dentro de `lib/event.ts`:

- `public/media/ocean-fallback-desktop.mp4` para telas largas;
- `public/media/ocean-fallback-mobile.mp4` para telas de até 767 px.

A ambiência usa `public/media/mare-ambiente-suave.mp3`, uma gravação natural de ondas com 4min47s, disponibilizada em domínio público no [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Waves.ogg). O player aplica filtro de graves, suavização das frequências altas, volume final baixo, fade-in de 3,6 segundos e fade-out de 1,6 segundo. O áudio nunca começa sem interação.

## Data do evento

Edite `lib/event.ts`. A data oficial é 08 de agosto de 2027. Como o horário da cerimônia não foi informado, a contagem regressiva usa provisoriamente 00h00 em `America/Belem`.

## Validação visual

`scripts/visual_qa.mjs` usa Chrome DevTools Protocol contra uma instância Chromium já iniciada com porta de depuração. Ele percorre os três atos por mouse, toque e teclado em 1440, 390 e 360 px; captura a ondulação do oceano e cada composição; verifica a ausência de rolagem da página, continuidade do áudio, foco, `prefers-reduced-motion`, rolagem interna do formulário, ViaCEP e envio real para o banco de QA.

Além dos controles visíveis, `←`, `→`, `Page Up`, `Page Down`, `Home` e `End` navegam entre os atos. Os indicadores laterais também permitem acesso direto a qualquer cena.

O site respeita `prefers-reduced-motion`, pausa o vídeo quando necessário e mantém o áudio ambiente ativo durante toda a navegação até que a pessoa o desligue ou saia da página.

Com a aplicação de QA em execução, a auditoria de respostas da API e do conteúdo cifrado pode ser repetida com:

```bash
QA_URL=http://localhost:3100 QA_DB_PATH=.data/qa-invitations.sqlite npm run qa:security
```
