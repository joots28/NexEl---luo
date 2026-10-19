# NexEl

**Uma plataforma social para ideias, comunidades e conversas.** NexEl combina a descoberta e as interações de uma rede social com a visão futura de comunidades, canais e chamadas.

> Estado honesto: esta versão entrega uma prévia social responsiva com interações locais. O projeto Supabase NexEl já existe e tem tabelas sociais/de comunidade com RLS habilitado, mas a interface desta versão ainda não está conectada à autenticação nem às consultas remotas. Login, persistência real, mensagens diretas e voz/vídeo não devem ser considerados prontos.

## Stack
- React 19 + JavaScript + Vite 6
- CSS responsivo para desktop e celular
- Supabase para futura integração de autenticação, feed e comunidades
- GitHub Actions com gate de teste e build

## Recursos da prévia atual
- Feed adaptável a desktop e celular
- Busca por texto, pessoas e tags
- Publicação local de texto com limite de 500 caracteres
- Curtidas, reposts, salvos e seguir/deixar de seguir na sessão
- Navegação responsiva e mensagens de feedback acessíveis
- Identidade dark: azul-marinho `#071321`, azul `#2F8EE5`, verde `#35D17D`, amarelo `#FFD447`

## Executar localmente
Requer Node.js 20 ou compatível com Vite 6.

```bash
npm install
npm test
npm run build
npm run dev
```

## Configuração do Supabase
1. Copie `.env.example` para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Nunca coloque uma service-role key no frontend.
4. A conexão de Auth e do feed ainda precisa ser implementada e testada antes de ativar as operações remotas.

## Gates antes do lançamento público
1. Instalação limpa, build de produção e auditoria de dependências.
2. Integrar Auth, perfis, feed, curtidas, reposts, favoritos e seguir ao Supabase.
3. Sincronizar todas as migrations SQL do banco remoto para este repositório.
4. Testar RLS com duas contas independentes e tentativas negativas.
5. Validar denúncias, bloqueios, limites contra spam e privacidade.
6. Testar desktop/mobile e configurar hospedagem.
7. Voz/vídeo, bots e administração de comunidades ficam para etapas posteriores com testes específicos.

## Design
Mockups editáveis foram preparados no Canva. O design é referência visual; a implementação funcional da prévia está nos arquivos React/CSS deste repositório.

Desenvolvido por Jonathan Otiniel como projeto independente.
