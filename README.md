# NexEl

**Uma plataforma social para ideias, comunidades e conversas.** NexEl combina a descoberta e as interações de uma rede social com a visão de longo prazo de comunidades, canais e chamadas.

## Estado desta versão

A prévia pública está conectada ao projeto Supabase NexEl. A rede social exige uma sessão válida para exibir o feed e as demais áreas; visitantes veem apenas a tela de entrada. Cadastro e login por e-mail/senha e login social com Google/GitHub (depois de configurar os provedores OAuth) usam Supabase Auth. Perfil, feed, publicações, curtidas, reposts, respostas, favoritos, seguir pessoas, comunidades, canais e mensagens usam o banco remoto, com regras Row Level Security (RLS).

**Ainda não considerar prontos:** notificações em tempo real, gestão avançada de canais e permissões, moderação avançada, bots e chamadas de voz/vídeo. Os canais de voz aparecem no sistema, mas áudio/vídeo não está implementado. O chat dos canais e as mensagens privadas atualizam automaticamente em intervalos curtos; ainda não são um canal realtime.

## Stack

- React 19 + JavaScript + Vite 6 (sem TypeScript)
- CSS responsivo para desktop e celular
- Supabase Auth + Postgres + Row Level Security
- GitHub Actions com testes estáticos e build de produção
- Render Static Site para a prévia pública

## Funcionalidades conectadas

- Tela de entrada obrigatória antes de exibir feed e conteúdo social
- Cadastro e login com e-mail/senha pelo Supabase Auth
- Botões para login OAuth com GitHub e Google (requer Client ID/Secret e ativação dos provedores no Supabase)
- Criação de perfil e edição de nome, usuário e bio
- Feed público carregado do banco
- Publicações de texto de até 500 caracteres
- Curtidas, reposts, respostas (até 300 caracteres), favoritos e seguir/deixar de seguir persistidos no banco
- Contadores de curtidas, respostas e reposts calculados a partir dos registros existentes
- Busca por pessoas, conteúdo e tópico
- Feed de itens salvos vinculado à conta
- Criação de comunidades públicas com canais padrão de texto e voz
- Descoberta e entrada em comunidades públicas; lista das comunidades das quais a pessoa participa
- Chat de texto persistente por canal com atualização automática, limite de 2.000 caracteres e controle de acesso RLS
- Mensagens privadas entre duas contas, com acesso restrito a quem envia ou recebe, validação de identidade e limite de 2.000 caracteres
- Feedback de erros, estado de carregamento e layout adaptável

## Executar localmente

Requer Node.js compatível com Vite 6.

```bash
npm install
npm test
npm run build
npm run dev
```

## Configuração do Supabase

1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com a URL do projeto e uma chave publishable/anon pública.
3. Nunca use uma chave `service_role` ou secret no navegador.
4. Configure a URL pública do site em **Authentication → URL Configuration** no Supabase. Adicione `https://nexel-social.onrender.com` às Redirect URLs permitidas; mantenha a URL local de desenvolvimento se necessário. Com confirmação de e-mail habilitada, o usuário precisa confirmar o endereço antes do primeiro login.
5. Para Google e GitHub, crie uma OAuth App em cada provedor, copie o Client ID/Client Secret para **Authentication → Sign In / Providers** e ative cada provedor. Use como callback OAuth do provedor a URL informada pelo próprio Supabase, no formato `https://<project-ref>.supabase.co/auth/v1/callback`. Não coloque os segredos no código do frontend.
6. Mantenha RLS habilitado. As políticas existentes restringem gravações ao usuário autenticado e seus próprios registros.

## Próximos gates antes de ampliar o lançamento

1. Testar cadastro, confirmação de e-mail, login e saída no site publicado.
2. Ativar e validar o OAuth de Google e GitHub com credenciais próprias do projeto.
3. Testar RLS com duas contas independentes, tentativas anônimas e tentativas negativas.
4. Resolver o aviso do Advisor relativo à função SECURITY DEFINER `accept_server_invite` antes de ativar convites de comunidades.
5. Adicionar testes automatizados que executem contra um projeto de teste isolado.
6. Implementar notificações, bloqueios, denúncias, limites contra spam e ferramentas de moderação.
7. Adicionar criação/gestão de canais personalizados e convites seguros; implementar notificações e recibos de leitura das mensagens privadas.
8. Implementar voz/vídeo com infraestrutura própria e testes específicos de qualidade e privacidade.

## Identidade visual

Tema dark com azul-marinho `#071321`, azul `#2F8EE5`, verde `#35D17D` e amarelo `#FFD447`.

Desenvolvido por Jonathan Otiniel como projeto independente.
