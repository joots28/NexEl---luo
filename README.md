# NexEl

**Uma plataforma social para ideias, comunidades e conversas.** NexEl combina a descoberta e as interações de uma rede social com a visão de longo prazo de comunidades, canais e chamadas.

## Estado desta versão

A prévia pública está conectada ao projeto Supabase NexEl. Cadastro e login, perfil, feed, publicações, curtidas, reposts, respostas, favoritos, seguir pessoas, comunidades públicas, adesão de membros, canais padrão e chat de texto persistente usam o banco remoto. As ações protegidas exigem uma conta e respeitam as políticas de Row Level Security (RLS) do Supabase.

**Ainda não considerar prontos:** notificações em tempo real, gestão avançada de canais e permissões, moderação avançada, bots e chamadas de voz/vídeo. Os canais de voz aparecem no sistema, mas áudio/vídeo não está implementado. O chat dos canais e as mensagens privadas atualizam automaticamente em intervalos curtos; ainda não são um canal realtime.

## Stack

- React 19 + JavaScript + Vite 6 (sem TypeScript)
- CSS responsivo para desktop e celular
- Supabase Auth + Postgres + Row Level Security
- GitHub Actions com testes estáticos e build de produção
- Render Static Site para a prévia pública

## Funcionalidades conectadas

- Cadastro com e-mail e senha e login pelo Supabase Auth
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
4. Configure a URL pública do site em **Authentication → URL Configuration** no Supabase. Com confirmação de e-mail habilitada, o usuário precisa confirmar o endereço antes do primeiro login.
5. Mantenha RLS habilitado. As políticas existentes restringem gravações ao usuário autenticado e seus próprios registros.

## Próximos gates antes de ampliar o lançamento

1. Testar cadastro, confirmação de e-mail, login e saída no site publicado.
2. Testar RLS com duas contas independentes e tentativas negativas.
3. Resolver o aviso do Advisor relativo à função SECURITY DEFINER `accept_server_invite` antes de ativar convites de comunidades.
4. Adicionar testes automatizados que executem contra um projeto de teste isolado.
5. Implementar notificações, bloqueios, denúncias, limites contra spam e ferramentas de moderação.
6. Adicionar criação/gestão de canais personalizados e convites seguros; implementar notificações e recibos de leitura das mensagens privadas.
7. Implementar voz/vídeo com infraestrutura própria e testes específicos de qualidade e privacidade.

## Identidade visual

Tema dark com azul-marinho `#071321`, azul `#2F8EE5`, verde `#35D17D` e amarelo `#FFD447`.

Desenvolvido por Jonathan Otiniel como projeto independente.
