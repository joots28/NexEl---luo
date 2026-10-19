import { useMemo, useState } from "react";

const seed = [
  { id: 1, name: "Isabela Moura", handle: "@isabelacria", initials: "IM", time: "12 min", tag: "Criatividade", body: "Você não precisa ter todas as respostas para dar o próximo passo. Às vezes, só precisa começar e aprender no caminho.", likes: 28, replies: 6, reposts: 4, liked: false },
  { id: 2, name: "Caio Nascimento", handle: "@caio.dev", initials: "CN", time: "35 min", tag: "Desenvolvimento", body: "Hoje tirei uma ideia do papel e finalmente vi a primeira versão funcionando. Dividir o problema em partes pequenas fez toda a diferença.", likes: 43, replies: 9, reposts: 7, liked: false },
  { id: 3, name: "Beatriz Lima", handle: "@bia.ux", initials: "BL", time: "1 h", tag: "Design & UX", body: "Uma interface boa não precisa gritar para chamar atenção. Hierarquia, espaço e consistência fazem o conteúdo respirar.", likes: 67, replies: 12, reposts: 11, liked: false }
];

const trends = [
  ["Desenvolvimento", "#BuildInPublic", "+24%"],
  ["Tecnologia", "Interfaces acessíveis", "+18%"],
  ["Criatividade", "Feito em conjunto", "+11%"]
];

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span>; }
function Avatar({ initials, color = "" }) { return <span className={`avatar ${color}`}>{initials}</span>; }

export default function App() {
  const [posts, setPosts] = useState(seed);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Para você");
  const [page, setPage] = useState("Início");
  const [notice, setNotice] = useState("");
  const [following, setFollowing] = useState([]);
  const [saved, setSaved] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [showComposer, setShowComposer] = useState(false);

  const visiblePosts = useMemo(() => posts.filter(p =>
    `${p.name} ${p.handle} ${p.body} ${p.tag}`.toLowerCase().includes(query.toLowerCase())
  ).filter(p => page !== "Salvos" || saved.includes(p.id)), [posts, query, page, saved]);

  function publish() {
    const body = draft.trim();
    if (!body) { setNotice("Escreva algo antes de publicar."); return; }
    if (body.length > 500) { setNotice("Sua publicação pode ter no máximo 500 caracteres."); return; }
    setPosts([{ id: Date.now(), name: "Jonathan Otiniel", handle: "@joots28", initials: "JO", time: "agora", tag: "Comunidade", body, likes: 0, replies: 0, reposts: 0, liked: false }, ...posts]);
    setDraft(""); setShowComposer(false); setPage("Início"); setNotice("Publicação adicionada nesta prévia local.");
  }

  function toggleLike(id) {
    setPosts(posts.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  }
  function toggleFollow(handle) {
    setFollowing(old => old.includes(handle) ? old.filter(x => x !== handle) : [...old, handle]);
  }
  function toggleSave(id) {
    setSaved(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
    setNotice(saved.includes(id) ? "Publicação removida dos salvos." : "Publicação salva nesta prévia local.");
  }
  function toggleRepost(id) {
    setReposts(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
    setNotice(reposts.includes(id) ? "Repost desfeito nesta prévia." : "Repost registrado nesta prévia local.");
  }

  const nav = [
    ["Início", "⌂"], ["Explorar", "⌕"], ["Notificações", "◉"], ["Mensagens", "▤"], ["Salvos", "◇"]
  ];

  return <div className="app-shell">
    <aside className="left-rail">
      <button className="brand-mark" onClick={() => {setPage("Início"); setQuery("");}} aria-label="NexEl início">N<span>.</span></button>
      {nav.map(([label, icon]) => <button key={label} className={`rail-item ${page === label ? "active" : ""}`} onClick={() => {setPage(label); if(label !== "Salvos") setNotice(label === "Mensagens" ? "Mensagens diretas entrarão na próxima etapa conectada." : "");}} aria-label={label} title={label}><Icon>{icon}</Icon></button>)}
      <button className="rail-compose" onClick={() => setShowComposer(true)} aria-label="Nova publicação">＋</button>
      <div className="rail-spacer" />
      <Avatar initials="JO" />
    </aside>

    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mini">N</div><div><strong>NexEl</strong><small>Ideias que conectam.</small></div></div>
      <label className="search"><Icon>⌕</Icon><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar pessoas, assuntos e posts" aria-label="Buscar" /><kbd>/</kbd></label>
      <div className="section-label">SEU ESPAÇO</div>
      {nav.map(([label, icon], i) => <button key={label} className={`side-link ${page === label ? "selected" : ""}`} onClick={() => setPage(label)}><Icon>{icon}</Icon>{label}{label === "Notificações" && <span className="count">3</span>}</button>)}
      <div className="section-row"><span className="section-label">COMUNIDADES</span><button onClick={() => setNotice("Criação de comunidades será habilitada após conectar a API.")} aria-label="Adicionar comunidade">＋</button></div>
      <button className="community"><span className="community-icon blue">DS</span><span><b>Dev & Sistemas</b><small>1,2 mil membros</small></span></button>
      <button className="community"><span className="community-icon green">CR</span><span><b>Criadores</b><small>846 membros</small></span></button>
      <button className="community"><span className="community-icon yellow">ID</span><span><b>Ideias em debate</b><small>512 membros</small></span></button>
      <div className="sidebar-bottom"><div className="tiny-globe">◎</div><b>Um lugar para construir.</b><p>Compartilhe ideias, encontre pessoas e participe de conversas que importam.</p></div>
    </aside>

    <main className="main-column">
      <header className="mobile-top"><button className="brand-mark small" onClick={() => setPage("Início")}>N<span>.</span></button><b>{page === "Início" ? "NexEl" : page}</b><Avatar initials="JO" /></header>
      <div className="page-header"><div><span className="eyebrow">NEXEL / SOCIAL</span><h1>{page === "Início" ? "Seu espaço, suas conversas." : page}</h1><p>Uma boa ideia fica ainda melhor quando é compartilhada.</p></div><button className="icon-button" onClick={() => setNotice("As preferências da conta serão conectadas na próxima etapa.")} aria-label="Preferências">⚙</button></div>

      {showComposer && <section className="composer">
        <Avatar initials="JO" />
        <div className="composer-body"><textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Compartilhe uma ideia, uma descoberta ou algo que te inspira..." autoFocus aria-label="Texto da publicação" /><div className="composer-footer"><span>{draft.length}/500</span><button className="primary-button" onClick={publish}>Publicar <span>↑</span></button></div></div>
      </section>}
      {!showComposer && <button className="composer-prompt" onClick={() => setShowComposer(true)}><Avatar initials="JO" /><span><b>Vamos conversar?</b><small>Compartilhe algo que te inspira...</small></span><span className="prompt-plus">＋</span></button>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
      <div className="feed-tabs"><div>{["Para você", "Recentes"].map(t => <button key={t} className={tab === t ? "chosen" : ""} onClick={() => setTab(t)}>{t}</button>)}</div><span>{visiblePosts.length} publicações</span></div>
      <section className="feed" aria-label="Feed de publicações">
        {visiblePosts.length === 0 && <div className="empty"><b>Nada por aqui ainda.</b><p>Tente outra busca ou publique uma nova ideia.</p></div>}
        {[...visiblePosts].sort((a,b) => tab === "Recentes" ? b.id-a.id : 0).map(post => <article className="post" key={post.id}>
          <Avatar initials={post.initials} color={post.initials === "BL" ? "lavender" : post.initials === "CN" ? "mint" : ""} />
          <div className="post-content"><div className="post-meta"><b>{post.name}</b><span>{post.handle}</span><i>·</i><span>{post.time}</span><button className="more-button" aria-label="Mais opções" onClick={() => toggleSave(post.id)}>•••</button></div><p>{post.body}</p><button className="topic-pill" onClick={() => setQuery(post.tag)}># {post.tag}</button>
            <div className="post-actions"><button onClick={() => setNotice("Respostas serão persistidas quando o backend estiver conectado.")} aria-label="Responder"><Icon>↶</Icon><span>{post.replies}</span></button><button className={reposts.includes(post.id) ? "action-on" : ""} onClick={() => toggleRepost(post.id)} aria-label="Repostar"><Icon>↻</Icon><span>{post.reposts + (reposts.includes(post.id) ? 1 : 0)}</span></button><button className={post.liked ? "like-on" : ""} onClick={() => toggleLike(post.id)} aria-label="Curtir"><Icon>♡</Icon><span>{post.likes}</span></button><button className={saved.includes(post.id) ? "action-on" : ""} onClick={() => toggleSave(post.id)} aria-label="Salvar"><Icon>◇</Icon></button><button onClick={() => {navigator.clipboard?.writeText(post.body);setNotice("Texto copiado, se o navegador permitir.");}} aria-label="Compartilhar"><Icon>↗</Icon></button></div>
          </div>
        </article>)}
      </section>
      <footer className="footer">Sobre <span>·</span> Privacidade <span>·</span> Ajuda <span>·</span> © 2026 NexEl</footer>
    </main>

    <aside className="right-column">
      <div className="right-card trends"><div className="right-title"><b>Em alta agora</b><button onClick={() => setPage("Explorar")}>Ver tudo</button></div>{trends.map(([category, title, change]) => <button className="trend" key={title} onClick={() => {setQuery(title.replace("#",""));setPage("Início");}}><small>{category} · Tendência</small><b>{title}</b><span>{change}</span></button>)}</div>
      <div className="right-card"><div className="right-title"><b>Pessoas para conhecer</b><button onClick={() => setNotice("Mais sugestões chegarão com o backend.")}>Mais</button></div>{[["IM","Isabela Moura","@isabelacria"],["CN","Caio Nascimento","@caio.dev"],["BL","Beatriz Lima","@bia.ux"]].map(([initials,name,handle]) => <div className="person" key={handle}><Avatar initials={initials} color={initials==="BL"?"lavender":initials==="CN"?"mint":""}/><div><b>{name}</b><small>{handle}</small></div><button className={following.includes(handle) ? "follow following" : "follow"} onClick={() => toggleFollow(handle)}>{following.includes(handle) ? "Seguindo" : "Seguir"}</button></div>)}</div>
      <div className="status-card"><span className="status-dot" /> <b>Prévia interativa</b><p>Publicações e interações funcionam nesta sessão. O backend e o login ainda precisam ser conectados para persistência real.</p></div>
    </aside>
    <nav className="mobile-nav">{nav.map(([label, icon]) => <button key={label} className={page === label ? "active" : ""} onClick={() => setPage(label)}><Icon>{icon}</Icon><small>{label === "Notificações" ? "Alertas" : label === "Mensagens" ? "DMs" : label}</small></button>)}</nav>
  </div>;
}