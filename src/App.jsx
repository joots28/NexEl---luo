import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";
import "./backend.css";

const trends = [
  ["Desenvolvimento", "#BuildInPublic", "+24%"],
  ["Tecnologia", "Interfaces acessíveis", "+18%"],
  ["Criatividade", "Feito em conjunto", "+11%"]
];

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function Avatar({ initials, color = "" }) {
  return <span className={"avatar " + color}>{initials || "NX"}</span>;
}

function initialsFor(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "NX";
}

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "agora";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " h";
  if (seconds < 604800) return Math.floor(seconds / 86400) + " d";
  return new Date(value).toLocaleDateString("pt-BR");
}

function friendlyError(error) {
  const message = error?.message || "Não foi possível concluir a operação.";
  if (/duplicate key|unique constraint/i.test(message)) return "Esse nome de usuário já está em uso. Escolha outro.";
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar.";
  if (/row-level security|violates row-level security/i.test(message)) return "O banco bloqueou essa ação por segurança. Confira as políticas de acesso.";
  return message;
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Para você");
  const [page, setPage] = useState("Início");
  const [notice, setNotice] = useState("");
  const [following, setFollowing] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authFeedback, setAuthFeedback] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [replyPost, setReplyPost] = useState(null);
  const [replyRows, setReplyRows] = useState([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [myServers, setMyServers] = useState([]);
  const [publicServers, setPublicServers] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [currentServer, setCurrentServer] = useState(null);
  const [serverChannels, setServerChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerDesc, setNewServerDesc] = useState("");
  const [newServerBusy, setNewServerBusy] = useState(false);

  const nav = [
    ["Início", "⌂"],
    ["Explorar", "⌕"],
    ["Comunidades", "▦"],
    ["Notificações", "◉"],
    ["Mensagens", "▤"],
    ["Salvos", "◇"]
  ];

  async function ensureProfile(account) {
    if (!supabase || !account) return null;

    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url")
      .eq("id", account.id)
      .maybeSingle();

    if (readError) throw readError;
    if (existing) return existing;

    const emailName = (account.email || "usuario").split("@")[0]
      .toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    const base = emailName.length >= 3 ? emailName : "usuario";
    const username = (base + "_" + account.id.replace(/-/g, "").slice(0, 8)).slice(0, 32);
    const displayName = String(
      account.user_metadata?.display_name ||
      account.user_metadata?.full_name ||
      (account.email || "Pessoa usuária").split("@")[0]
    ).trim().slice(0, 80) || "Pessoa usuária";

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({ id: account.id, username, display_name: displayName, bio: "" })
      .select("id, username, display_name, bio, avatar_url")
      .single();

    if (createError) {
      const { data: retry, error: retryError } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("id", account.id)
        .maybeSingle();
      if (retryError || !retry) throw createError;
      return retry;
    }
    return created;
  }

  const refreshFeed = useCallback(async () => {
    if (!supabase) {
      setPosts([]);
      setSavedIds([]);
      setFollowing([]);
      setLoadingFeed(false);
      return;
    }

    setLoadingFeed(true);
    try {
      const { data: rows, error } = await supabase
        .from("social_posts")
        .select("id, author_id, body, topic, created_at")
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) throw error;
      const postRows = rows || [];
      const postIds = postRows.map(post => post.id);
      const authorIds = [...new Set(postRows.map(post => post.author_id))];

      const profileRequest = authorIds.length
        ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
        : Promise.resolve({ data: [], error: null });

      const related = postIds.length
        ? await Promise.all([
            supabase.from("social_post_likes").select("post_id, user_id").in("post_id", postIds),
            supabase.from("social_post_reposts").select("post_id, user_id").in("post_id", postIds),
            supabase.from("social_post_replies").select("id, post_id").in("post_id", postIds),
            profileRequest
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            await profileRequest
          ];

      const [likesResult, repostsResult, repliesResult, profilesResult] = related;
      const profileById = new Map((profilesResult.data || []).map(item => [item.id, item]));
      const likes = likesResult.data || [];
      const reposts = repostsResult.data || [];
      const replies = repliesResult.data || [];

      let bookmarks = [];
      let follows = [];
      if (user?.id) {
        const [bookmarkResult, followResult] = await Promise.all([
          supabase.from("social_post_bookmarks").select("post_id").eq("user_id", user.id),
          supabase.from("social_follows").select("followed_id").eq("follower_id", user.id)
        ]);
        if (bookmarkResult.error) throw bookmarkResult.error;
        if (followResult.error) throw followResult.error;
        bookmarks = bookmarkResult.data || [];
        follows = followResult.data || [];
      }

      const savedSet = new Set(bookmarks.map(item => item.post_id));
      const followedSet = new Set(follows.map(item => item.followed_id));

      setSavedIds([...savedSet]);
      setFollowing([...followedSet]);
      setPosts(postRows.map(post => {
        const author = profileById.get(post.author_id);
        const name = author?.display_name || author?.username || "Pessoa usuária";
        const postLikes = likes.filter(item => item.post_id === post.id);
        const postReposts = reposts.filter(item => item.post_id === post.id);
        return {
          id: post.id,
          authorId: post.author_id,
          name,
          handle: author?.username ? "@" + author.username : "@usuario",
          initials: initialsFor(name),
          avatarUrl: author?.avatar_url || "",
          createdAt: post.created_at,
          time: timeAgo(post.created_at),
          tag: post.topic || "Comunidade",
          body: post.body,
          likes: postLikes.length,
          replies: replies.filter(item => item.post_id === post.id).length,
          reposts: postReposts.length,
          liked: postLikes.some(item => item.user_id === user?.id),
          reposted: postReposts.some(item => item.user_id === user?.id),
          saved: savedSet.has(post.id),
          isFollowing: followedSet.has(post.author_id)
        };
      }));
    } catch (error) {
      setNotice("Não consegui atualizar o feed: " + friendlyError(error));
    } finally {
      setLoadingFeed(false);
    }
  }, [user?.id]);

  const loadCommunities = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyServers([]);
      setPublicServers([]);
      return;
    }
    setCommunitiesLoading(true);
    try {
      const [membersResult, publicResult] = await Promise.all([
        supabase.from("server_members").select("server_id, role").eq("user_id", user.id),
        supabase.from("servers").select("id, owner_id, name, description, is_public, created_at").eq("is_public", true).order("created_at", { ascending: false }).limit(100)
      ]);
      if (membersResult.error) throw membersResult.error;
      if (publicResult.error) throw publicResult.error;

      const memberships = membersResult.data || [];
      const memberIds = [...new Set(memberships.map(row => row.server_id))];
      const memberServersResult = memberIds.length
        ? await supabase.from("servers").select("id, owner_id, name, description, is_public, created_at").in("id", memberIds)
        : { data: [], error: null };
      if (memberServersResult.error) throw memberServersResult.error;

      const all = new Map();
      [...(publicResult.data || []), ...(memberServersResult.data || [])].forEach(server => {
        all.set(server.id, server);
      });
      const memberSet = new Set(memberIds);
      setMyServers([...all.values()].filter(server => memberSet.has(server.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setPublicServers([...all.values()].filter(server => server.is_public && !memberSet.has(server.id)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      setNotice("Não consegui carregar as comunidades: " + friendlyError(error));
    } finally {
      setCommunitiesLoading(false);
    }
  }, [user?.id]);

  const loadChannelMessages = useCallback(async (channel) => {
    if (!supabase || !channel || channel.type !== "text") return;
    setChatLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, body, created_at, edited_at")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const messages = rows || [];
      const authorIds = [...new Set(messages.map(message => message.author_id))];
      const profileResult = authorIds.length
        ? await supabase.from("profiles").select("id, username, display_name").in("id", authorIds)
        : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const byId = new Map((profileResult.data || []).map(person => [person.id, person]));
      setChannelMessages(messages.reverse().map(message => {
        const author = byId.get(message.author_id);
        const name = author?.display_name || author?.username || "Pessoa usuária";
        return { ...message, name, handle: author?.username ? "@" + author.username : "@usuario", initials: initialsFor(name), time: timeAgo(message.created_at) };
      }));
    } catch (error) {
      setNotice("Não consegui carregar as mensagens do canal: " + friendlyError(error));
      setChannelMessages([]);
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(friendlyError(error));
      setUser(data.session?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || !supabase) {
      setProfile(null);
      return () => { active = false; };
    }

    ensureProfile(user)
      .then(data => { if (active) setProfile(data); })
      .catch(error => { if (active) setNotice("Não consegui carregar seu perfil: " + friendlyError(error)); });

    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    if (page !== "Comunidades" || !currentChannel || currentChannel.type !== "text") return undefined;
    const interval = window.setInterval(() => loadChannelMessages(currentChannel), 12000);
    return () => window.clearInterval(interval);
  }, [page, currentChannel?.id, loadChannelMessages]);

  const visiblePosts = useMemo(() => {
    const text = query.trim().toLowerCase();
    return posts.filter(post =>
      (page !== "Salvos" || post.saved) &&
      (!text || (post.name + " " + post.handle + " " + post.body + " " + post.tag).toLowerCase().includes(text))
    ).sort((a, b) => tab === "Recentes"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : 0);
  }, [posts, query, page, tab]);

  const suggestions = useMemo(() => {
    const unique = new Map();
    posts.forEach(post => {
      if (post.authorId !== user?.id && !unique.has(post.authorId)) {
        unique.set(post.authorId, {
          id: post.authorId,
          initials: post.initials,
          name: post.name,
          handle: post.handle
        });
      }
    });
    return [...unique.values()].slice(0, 4);
  }, [posts, user?.id]);

  function requireUser(message = "Entre ou crie uma conta para usar essa função.") {
    if (user) return true;
    setAuthMode("login");
    setAuthFeedback(message);
    setAuthOpen(true);
    return false;
  }

  async function publish() {
    const body = draft.trim();
    if (!body) {
      setNotice("Escreva algo antes de publicar.");
      return;
    }
    if (body.length > 500) {
      setNotice("Sua publicação pode ter no máximo 500 caracteres.");
      return;
    }
    if (!requireUser("Faça login para publicar e compartilhar suas ideias.")) return;
    if (!supabase) return;

    setActionBusy("publish");
    try {
      await ensureProfile(user);
      const { error } = await supabase.from("social_posts").insert({
        author_id: user.id,
        body,
        topic: "Comunidade",
        visibility: "public"
      });
      if (error) throw error;
      setDraft("");
      setShowComposer(false);
      setPage("Início");
      setQuery("");
      setNotice("Publicação enviada para o feed.");
      await refreshFeed();
    } catch (error) {
      setNotice("Não foi possível publicar: " + friendlyError(error));
    } finally {
      setActionBusy("");
    }
  }

  async function togglePostRelation(table, post, active, kind) {
    if (!requireUser()) return;
    if (!supabase || actionBusy) return;

    setActionBusy(kind + post.id);
    try {
      let result;
      if (active) {
        result = await supabase.from(table).delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        result = await supabase.from(table).insert({ post_id: post.id, user_id: user.id });
      }
      if (result.error) throw result.error;
      await refreshFeed();
      const messages = {
        like: active ? "Curtida removida." : "Você curtiu a publicação.",
        repost: active ? "Repost desfeito." : "Publicação repostada.",
        save: active ? "Publicação removida dos salvos." : "Publicação salva."
      };
      setNotice(messages[kind]);
    } catch (error) {
      setNotice("Não foi possível atualizar a publicação: " + friendlyError(error));
    } finally {
      setActionBusy("");
    }
  }

  async function toggleFollow(person) {
    if (!requireUser("Entre para seguir outras pessoas e montar seu feed.")) return;
    if (!supabase || actionBusy) return;
    const active = following.includes(person.id);
    setActionBusy("follow" + person.id);
    try {
      const result = active
        ? await supabase.from("social_follows").delete().eq("follower_id", user.id).eq("followed_id", person.id)
        : await supabase.from("social_follows").insert({ follower_id: user.id, followed_id: person.id });
      if (result.error) throw result.error;
      await refreshFeed();
      setNotice(active ? "Você deixou de seguir " + person.name + "." : "Agora você segue " + person.name + ".");
    } catch (error) {
      setNotice("Não foi possível atualizar quem você segue: " + friendlyError(error));
    } finally {
      setActionBusy("");
    }
  }

  async function openServer(server) {
    if (!user || !supabase) {
      setPage("Comunidades");
      setAuthMode("login");
      setAuthFeedback("Entre para acessar comunidades e canais.");
      setAuthOpen(true);
      return;
    }
    setCurrentServer(server);
    setCurrentChannel(null);
    setServerChannels([]);
    setChannelMessages([]);
    setChatDraft("");
    setPage("Comunidades");
    setCommunitiesLoading(true);
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("id, server_id, name, type, category, is_private, position")
        .eq("server_id", server.id)
        .order("position", { ascending: true });
      if (error) throw error;
      const rows = data || [];
      setServerChannels(rows);
      const firstText = rows.find(channel => channel.type === "text");
      if (firstText) {
        setCurrentChannel(firstText);
        await loadChannelMessages(firstText);
      }
    } catch (error) {
      setNotice("Não foi possível abrir os canais: " + friendlyError(error));
    } finally {
      setCommunitiesLoading(false);
    }
  }

  async function openChannel(channel) {
    setCurrentChannel(channel);
    setChatDraft("");
    setChannelMessages([]);
    if (channel.type === "text") {
      await loadChannelMessages(channel);
    } else {
      setNotice("O canal de voz já aparece na comunidade. Áudio ao vivo precisa da camada WebRTC, que ainda será implementada.");
    }
  }

  async function joinCommunity(server) {
    if (!requireUser("Entre para participar de comunidades.")) return;
    if (!supabase) return;
    if (myServers.some(item => item.id === server.id)) {
      await openServer(server);
      return;
    }
    setActionBusy("join-" + server.id);
    try {
      const { error } = await supabase.from("server_members").insert({
        server_id: server.id,
        user_id: user.id,
        role: "member"
      });
      if (error) throw error;
      await loadCommunities();
      setNotice("Você entrou na comunidade " + server.name + ".");
      await openServer(server);
    } catch (error) {
      setNotice("Não foi possível entrar na comunidade: " + friendlyError(error));
    } finally {
      setActionBusy("");
    }
  }

  async function createCommunity(event) {
    event.preventDefault();
    const name = newServerName.trim();
    const description = newServerDesc.trim();
    if (name.length < 2 || name.length > 48) {
      setNotice("O nome da comunidade deve ter de 2 a 48 caracteres.");
      return;
    }
    if (description.length > 180) {
      setNotice("A descrição pode ter no máximo 180 caracteres.");
      return;
    }
    if (!requireUser("Entre para criar uma comunidade.")) return;
    if (!supabase || newServerBusy) return;

    setNewServerBusy(true);
    try {
      await ensureProfile(user);
      const { data: serverId, error } = await supabase.rpc("create_server_with_defaults", {
        p_name: name,
        p_description: description,
        p_is_public: true
      });
      if (error) throw error;
      const { data: server, error: readError } = await supabase
        .from("servers")
        .select("id, owner_id, name, description, is_public, created_at")
        .eq("id", serverId)
        .single();
      if (readError) throw readError;
      setCommunityOpen(false);
      setNewServerName("");
      setNewServerDesc("");
      await loadCommunities();
      setNotice("Comunidade criada com canais de texto e voz.");
      await openServer(server);
    } catch (error) {
      setNotice("Não foi possível criar a comunidade: " + friendlyError(error));
    } finally {
      setNewServerBusy(false);
    }
  }

  async function sendChannelMessage(event) {
    event.preventDefault();
    const body = chatDraft.trim();
    if (!body) {
      setNotice("Escreva uma mensagem antes de enviar.");
      return;
    }
    if (body.length > 2000) {
      setNotice("A mensagem pode ter no máximo 2.000 caracteres.");
      return;
    }
    if (!requireUser("Entre para enviar mensagens nos canais.")) return;
    if (!supabase || !currentChannel || currentChannel.type !== "text" || chatBusy) return;

    setChatBusy(true);
    try {
      await ensureProfile(user);
      const { error } = await supabase.from("messages").insert({
        channel_id: currentChannel.id,
        author_id: user.id,
        body
      });
      if (error) throw error;
      setChatDraft("");
      setNotice("");
      await loadChannelMessages(currentChannel);
    } catch (error) {
      setNotice("Não foi possível enviar a mensagem: " + friendlyError(error));
    } finally {
      setChatBusy(false);
    }
  }

  function openCommunityHub() {
    setCurrentServer(null);
    setCurrentChannel(null);
    setChannelMessages([]);
    setPage("Comunidades");
    setNotice("");
  }

  async function loadReplies(post) {
    if (!supabase || !post) return;
    setReplyLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("social_post_replies")
        .select("id, author_id, body, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;

      const items = rows || [];
      const authorIds = [...new Set(items.map(item => item.author_id))];
      const profileResult = authorIds.length
        ? await supabase.from("profiles").select("id, username, display_name").in("id", authorIds)
        : { data: [], error: null };
      if (profileResult.error) throw profileResult.error;
      const profilesById = new Map((profileResult.data || []).map(item => [item.id, item]));

      setReplyRows(items.map(item => {
        const author = profilesById.get(item.author_id);
        const name = author?.display_name || author?.username || "Pessoa usuária";
        return {
          ...item,
          name,
          handle: author?.username ? "@" + author.username : "@usuario",
          initials: initialsFor(name),
          time: timeAgo(item.created_at)
        };
      }));
    } catch (error) {
      setNotice("Não foi possível carregar as respostas: " + friendlyError(error));
      setReplyRows([]);
    } finally {
      setReplyLoading(false);
    }
  }

  async function openReplies(post) {
    setReplyPost(post);
    setReplyDraft("");
    setReplyRows([]);
    await loadReplies(post);
  }

  async function submitReply(event) {
    event.preventDefault();
    const body = replyDraft.trim();
    if (!body) {
      setNotice("Escreva uma resposta antes de enviar.");
      return;
    }
    if (body.length > 300) {
      setNotice("Sua resposta pode ter no máximo 300 caracteres.");
      return;
    }
    if (!requireUser("Entre para responder a esta publicação.")) return;
    if (!supabase || !replyPost || replyBusy) return;

    setReplyBusy(true);
    try {
      await ensureProfile(user);
      const { error } = await supabase.from("social_post_replies").insert({
        post_id: replyPost.id,
        author_id: user.id,
        body
      });
      if (error) throw error;
      setReplyDraft("");
      await Promise.all([loadReplies(replyPost), refreshFeed()]);
      setNotice("Resposta publicada.");
    } catch (error) {
      setNotice("Não foi possível publicar a resposta: " + friendlyError(error));
    } finally {
      setReplyBusy(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!supabase) {
      setAuthFeedback("A conexão com o Supabase não está configurada nesta versão.");
      return;
    }
    setAuthBusy(true);
    setAuthFeedback("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { display_name: authName.trim() } }
        });
        if (error) throw error;
        if (data.session) {
          setAuthOpen(false);
          setNotice("Conta criada. Bem-vindo ao NexEl!");
        } else {
          setAuthFeedback("Conta criada! Confira seu e-mail e confirme o cadastro. Depois, volte aqui para entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        setAuthOpen(false);
        setAuthPassword("");
        setAuthFeedback("");
        setNotice("Login realizado. Bom te ver no NexEl!");
      }
    } catch (error) {
      setAuthFeedback(friendlyError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice("Não foi possível sair: " + friendlyError(error));
      return;
    }
    setProfileOpen(false);
    setNotice("Você saiu da sua conta.");
  }

  function openProfile() {
    setProfileName(profile?.display_name || "");
    setProfileUsername(profile?.username || "");
    setProfileBio(profile?.bio || "");
    setProfileOpen(true);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user || !supabase || !profile) return;
    const username = profileUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    const displayName = profileName.trim().slice(0, 80);
    const bio = profileBio.trim().slice(0, 160);
    if (username.length < 3 || !displayName) {
      setNotice("O nome precisa ter até 80 caracteres e o usuário, de 3 a 32 caracteres.");
      return;
    }

    setProfileBusy(true);
    try {
      const { data, error } = await supabase.from("profiles")
        .update({ username, display_name: displayName, bio, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("id, username, display_name, bio, avatar_url")
        .single();
      if (error) throw error;
      setProfile(data);
      setProfileOpen(false);
      setNotice("Perfil atualizado.");
      await refreshFeed();
    } catch (error) {
      setNotice("Não foi possível salvar o perfil: " + friendlyError(error));
    } finally {
      setProfileBusy(false);
    }
  }

  function sharePost(post) {
    if (!navigator.clipboard?.writeText) {
      setNotice("Seu navegador não permitiu copiar o texto automaticamente.");
      return;
    }
    navigator.clipboard.writeText(post.body)
      .then(() => setNotice("Texto da publicação copiado para compartilhar."))
      .catch(() => setNotice("Não consegui copiar o texto neste navegador."));
  }

  function selectPage(label) {
    setPage(label);
    if (label === "Comunidades") {
      setCurrentServer(null);
      setCurrentChannel(null);
      setChannelMessages([]);
      setNotice("");
    } else if (label === "Mensagens") setNotice("Mensagens diretas continuam planejadas para uma etapa própria; os canais de comunidade já terão chat de texto.");
    else if (label === "Notificações") setNotice("Notificações em tempo real serão adicionadas na próxima etapa.");
    else setNotice("");
  }

  const initials = initialsFor(profile?.display_name || user?.email || "NexEl");

  return <div className="app-shell">
    <aside className="left-rail">
      <button className="brand-mark" onClick={() => { setPage("Início"); setQuery(""); }} aria-label="NexEl início">N<span>.</span></button>
      {nav.map(([label, icon]) => <button key={label} className={"rail-item " + (page === label ? "active" : "")} onClick={() => selectPage(label)} aria-label={label} title={label}><Icon>{icon}</Icon></button>)}
      <button className="rail-compose" onClick={() => setShowComposer(true)} aria-label="Nova publicação">＋</button>
      <div className="rail-spacer" />
      <button className="avatar-button" onClick={user ? openProfile : () => setAuthOpen(true)} aria-label="Conta"><Avatar initials={initials} /></button>
    </aside>

    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mini">N</div><div><strong>NexEl</strong><small>Ideias que conectam.</small></div></div>
      <label className="search"><Icon>⌕</Icon><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar pessoas, assuntos e posts" aria-label="Buscar" /><kbd>/</kbd></label>
      <div className="section-label">SEU ESPAÇO</div>
      {nav.map(([label, icon]) => <button key={label} className={"side-link " + (page === label ? "selected" : "")} onClick={() => selectPage(label)}><Icon>{icon}</Icon>{label}{label === "Notificações" && <span className="count">•</span>}</button>)}
      <div className="section-row"><span className="section-label">SUAS COMUNIDADES</span><button onClick={() => { if (user) setCommunityOpen(true); else { setAuthMode("login"); setAuthFeedback("Entre para criar sua comunidade."); setAuthOpen(true); } }} aria-label="Criar comunidade">＋</button></div>
      {myServers.map(server => <button className="community" key={server.id} onClick={() => openServer(server)}><span className="community-icon blue">{initialsFor(server.name).slice(0, 2)}</span><span><b>{server.name}</b><small>{server.description || "Comunidade NexEl"}</small></span></button>)}
      {!user && <p className="sidebar-community-empty">Entre para ver suas comunidades.</p>}
      {user && myServers.length === 0 && <p className="sidebar-community-empty">{communitiesLoading ? "Carregando..." : "Você ainda não participa de comunidades."}</p>}
      <button className="community-discover-link" onClick={openCommunityHub}><span>＋</span><b>Explorar comunidades</b></button>
      <div className="sidebar-bottom"><div className="tiny-globe">◎</div><b>Um lugar para construir.</b><p>Compartilhe ideias, encontre pessoas e participe de conversas que importam.</p></div>
    </aside>

    <main className="main-column">
      <header className="mobile-top"><button className="brand-mark small" onClick={() => { setPage("Início"); setQuery(""); }}>N<span>.</span></button><b>{page === "Início" ? "NexEl" : page}</b><button className="avatar-button" onClick={user ? openProfile : () => setAuthOpen(true)}><Avatar initials={initials} /></button></header>
      <div className="page-header">
        <div><span className="eyebrow">NEXEL / SOCIAL</span><h1>{page === "Início" ? "Seu espaço, suas conversas." : page}</h1><p>Uma boa ideia fica ainda melhor quando é compartilhada.</p></div>
        <div className="header-actions">
          {user
            ? <><button className="account-chip" onClick={openProfile}>{profile?.display_name || user.email || "Minha conta"}</button><button className="ghost-button" onClick={signOut}>Sair</button></>
            : <button className="primary-button" onClick={() => { setAuthMode("login"); setAuthFeedback(""); setAuthOpen(true); }}>Entrar</button>}
          <button className="icon-button" onClick={user ? openProfile : () => setNotice("Entre no NexEl para configurar seu perfil.")} aria-label="Preferências">⚙</button>
        </div>
      </div>

      {page === "Comunidades" ? <section className="community-workspace">
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        {!user ? <div className="feature-placeholder"><div className="placeholder-symbol">▦</div><h2>Encontre sua comunidade</h2><p>Entre para descobrir espaços públicos, participar de canais e conversar com pessoas.</p><button className="primary-button" onClick={() => { setAuthMode("login"); setAuthFeedback(""); setAuthOpen(true); }}>Entrar para continuar</button></div>
        : currentServer ? <div className="server-layout">
          <aside className="server-channel-list">
            <div className="server-heading"><div><span className="eyebrow">COMUNIDADE</span><h2>{currentServer.name}</h2><p>{currentServer.description || "Seu espaço de conversa."}</p></div><button className="ghost-button" onClick={openCommunityHub}>Explorar</button></div>
            <div className="channel-group-title">CANAIS</div>
            {serverChannels.map(channel => <button key={channel.id} className={"channel-link " + (currentChannel?.id === channel.id ? "selected" : "")} onClick={() => openChannel(channel)}><span className="channel-prefix">{channel.type === "voice" ? "◖" : "#"}</span><span>{channel.name}</span>{channel.type === "voice" && <small>voz</small>}</button>)}
            {!communitiesLoading && serverChannels.length === 0 && <p className="sidebar-community-empty">Nenhum canal disponível.</p>}
            {currentServer.owner_id === user.id && <div className="server-owner-note">Você é a pessoa responsável por esta comunidade.</div>}
          </aside>
          <div className="server-chat">
            {!currentChannel && <div className="feature-placeholder"><div className="placeholder-symbol">#</div><h2>Escolha um canal</h2><p>Selecione um canal na lista para começar.</p></div>}
            {currentChannel?.type === "voice" && <div className="feature-placeholder voice-placeholder"><div className="placeholder-symbol">◖</div><h2>{currentChannel.name}</h2><p>Este canal já está salvo no banco. Voz ao vivo ainda depende da camada WebRTC e de sinalização segura; não vamos fingir que o áudio já está funcionando.</p><button className="ghost-button" onClick={() => { const textChannel = serverChannels.find(channel => channel.type === "text"); if (textChannel) openChannel(textChannel); }}>Ir para o chat de texto</button></div>}
            {currentChannel?.type === "text" && <>
              <header className="chat-header"><div><span className="chat-hash">#</span><h2>{currentChannel.name}</h2><small>{currentServer.name}</small></div><button className="icon-button" onClick={() => loadChannelMessages(currentChannel)} aria-label="Atualizar mensagens" title="Atualizar mensagens">↻</button></header>
              <section className="chat-message-list" aria-label="Mensagens do canal">
                {chatLoading && channelMessages.length === 0 && <div className="reply-state">Carregando mensagens...</div>}
                {!chatLoading && channelMessages.length === 0 && <div className="reply-state"><b>Esse canal está tranquilo por enquanto.</b><p>Envie a primeira mensagem para iniciar a conversa.</p></div>}
                {channelMessages.map(message => <article className="chat-message" key={message.id}>
                  <Avatar initials={message.initials} />
                  <div className="chat-message-content"><div className="chat-message-meta"><b>{message.name}</b><span>{message.handle}</span><time>{message.time}</time></div><p>{message.body}</p></div>
                </article>)}
              </section>
              <form className="chat-composer" onSubmit={sendChannelMessage}>
                <textarea aria-label="Mensagem do canal" value={chatDraft} onChange={event => setChatDraft(event.target.value)} maxLength={2000} rows={2} placeholder={"Enviar mensagem em #" + currentChannel.name} />
                <div className="chat-composer-footer"><span>{chatDraft.length}/2000 · atualiza automaticamente</span><button type="submit" className="primary-button" disabled={chatBusy || !chatDraft.trim()}>{chatBusy ? "Enviando..." : "Enviar"} ↑</button></div>
              </form>
            </>}
          </div>
        </div> : <div className="community-discovery">
          <div className="community-hero"><div><span className="eyebrow">NEXEL / COMUNIDADES</span><h2>Encontre seu lugar.</h2><p>Crie um espaço ou entre em uma comunidade pública para conversar em canais.</p></div><button className="primary-button" onClick={() => setCommunityOpen(true)}>＋ Criar comunidade</button></div>
          {communitiesLoading && <div className="reply-state">Carregando comunidades...</div>}
          <h3>Suas comunidades</h3>
          {myServers.length === 0 && !communitiesLoading && <div className="empty community-empty"><b>Você ainda não participa de nenhuma.</b><p>Crie a sua ou entre em uma comunidade pública.</p></div>}
          <div className="server-card-grid">{myServers.map(server => <article className="server-card" key={server.id}><span className="server-card-mark">{initialsFor(server.name).slice(0,2)}</span><h4>{server.name}</h4><p>{server.description || "Um espaço para compartilhar ideias."}</p><button className="ghost-button" onClick={() => openServer(server)}>Abrir comunidade</button></article>)}</div>
          <h3>Comunidades públicas</h3>
          {publicServers.length === 0 && !communitiesLoading && <div className="empty community-empty"><b>Nenhuma comunidade pública nova por enquanto.</b><p>Quando alguém criar um espaço público, ele aparecerá aqui.</p></div>}
          <div className="server-card-grid">{publicServers.map(server => <article className="server-card" key={server.id}><span className="server-card-mark green-mark">{initialsFor(server.name).slice(0,2)}</span><h4>{server.name}</h4><p>{server.description || "Um espaço público para trocar ideias."}</p><button className="primary-button" onClick={() => joinCommunity(server)} disabled={actionBusy === "join-" + server.id}>{actionBusy === "join-" + server.id ? "Entrando..." : "Entrar na comunidade"}</button></article>)}</div>
        </div>}
      </section> : page === "Mensagens" || page === "Notificações" ? <section className="feature-placeholder"><div className="placeholder-symbol">{page === "Mensagens" ? "▤" : "◉"}</div><h2>{page === "Mensagens" ? "Mensagens diretas estão no roteiro" : "Notificações estão no roteiro"}</h2><p>Os canais de texto das comunidades já usam o banco. Conversas privadas e notificações terão implementação e regras de privacidade próprias.</p><button className="primary-button" onClick={() => setPage("Início")}>Voltar ao feed</button></section> : <>
        {showComposer
          ? <section className="composer"><Avatar initials={initials} /><div className="composer-body"><textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="Compartilhe uma ideia, uma descoberta ou algo que te inspira..." autoFocus aria-label="Texto da publicação" /><div className="composer-footer"><span>{draft.length}/500</span><div className="composer-buttons"><button className="ghost-button" onClick={() => { setShowComposer(false); setDraft(""); }}>Cancelar</button><button className="primary-button" onClick={publish} disabled={actionBusy === "publish"}>{actionBusy === "publish" ? "Publicando..." : "Publicar"} <span>↑</span></button></div></div></div></section>
          : <button className="composer-prompt" onClick={() => setShowComposer(true)}><Avatar initials={initials} /><span><b>Vamos conversar?</b><small>Compartilhe algo que te inspira...</small></span><span className="prompt-plus">＋</span></button>}

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
        <div className="feed-tabs"><div>{["Para você", "Recentes"].map(value => <button key={value} className={tab === value ? "chosen" : ""} onClick={() => setTab(value)}>{value}</button>)}</div><span>{loadingFeed ? "Atualizando..." : visiblePosts.length + " publicações"} <button className="refresh-button" onClick={refreshFeed} aria-label="Atualizar feed" title="Atualizar feed">↻</button></span></div>

        <section className="feed" aria-label="Feed de publicações">
          {!isSupabaseConfigured && <div className="empty"><b>Conexão do banco pendente</b><p>Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para carregar publicações.</p></div>}
          {isSupabaseConfigured && page === "Salvos" && !user && <div className="empty"><b>Entre para ver seus salvos.</b><p>Suas publicações favoritas ficam guardadas na sua conta.</p><button className="primary-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>Entrar</button></div>}
          {isSupabaseConfigured && loadingFeed && posts.length === 0 && <div className="empty"><b>Carregando o feed...</b><p>Buscando publicações do NexEl.</p></div>}
          {isSupabaseConfigured && !loadingFeed && visiblePosts.length === 0 && !(page === "Salvos" && !user) && <div className="empty"><b>{page === "Salvos" ? "Você ainda não salvou publicações." : "Ainda não há publicações por aqui."}</b><p>{page === "Salvos" ? "Use o ícone de marcador em qualquer publicação." : "Seja uma das primeiras pessoas a compartilhar uma ideia."}</p></div>}
          {visiblePosts.map(post => <article className="post" key={post.id}>
            <Avatar initials={post.initials} />
            <div className="post-content">
              <div className="post-meta"><b>{post.name}</b><span>{post.handle}</span><i>·</i><span>{post.time}</span><button className="more-button" aria-label="Salvar publicação" title={post.saved ? "Remover dos salvos" : "Salvar"} onClick={() => togglePostRelation("social_post_bookmarks", post, post.saved, "save")}>•••</button></div>
              <p>{post.body}</p><button className="topic-pill" onClick={() => setQuery(post.tag)}># {post.tag}</button>
              <div className="post-actions">
                <button onClick={() => openReplies(post)} aria-label="Ver respostas"><Icon>↶</Icon><span>{post.replies}</span></button>
                <button className={post.reposted ? "action-on" : ""} onClick={() => togglePostRelation("social_post_reposts", post, post.reposted, "repost")} aria-label="Repostar" disabled={Boolean(actionBusy)}><Icon>↻</Icon><span>{post.reposts}</span></button>
                <button className={post.liked ? "like-on" : ""} onClick={() => togglePostRelation("social_post_likes", post, post.liked, "like")} aria-label="Curtir" disabled={Boolean(actionBusy)}><Icon>♡</Icon><span>{post.likes}</span></button>
                <button className={post.saved ? "action-on" : ""} onClick={() => togglePostRelation("social_post_bookmarks", post, post.saved, "save")} aria-label={post.saved ? "Remover dos salvos" : "Salvar"} disabled={Boolean(actionBusy)}><Icon>◇</Icon></button>
                <button onClick={() => sharePost(post)} aria-label="Compartilhar"><Icon>↗</Icon></button>
              </div>
            </div>
          </article>)}
        </section>
      </>}
      <footer className="footer">Sobre <span>·</span> Privacidade <span>·</span> Ajuda <span>·</span> © 2026 NexEl</footer>
    </main>

    <aside className="right-column">
      <div className="right-card trends"><div className="right-title"><b>Em alta agora</b><button onClick={() => setPage("Explorar")}>Ver tudo</button></div>{trends.map(([category, title, change]) => <button className="trend" key={title} onClick={() => { setQuery(title.replace("#", "")); setPage("Explorar"); }}><small>{category} · Tendência</small><b>{title}</b><span>{change}</span></button>)}</div>
      <div className="right-card"><div className="right-title"><b>Pessoas para conhecer</b><button onClick={refreshFeed}>Atualizar</button></div>{suggestions.length === 0 && <p className="suggestion-empty">Novas pessoas aparecerão aqui quando houver publicações.</p>}{suggestions.map(person => <div className="person" key={person.id}><Avatar initials={person.initials} /><div><b>{person.name}</b><small>{person.handle}</small></div><button className={following.includes(person.id) ? "follow following" : "follow"} onClick={() => toggleFollow(person)} disabled={actionBusy === "follow" + person.id}>{following.includes(person.id) ? "Seguindo" : "Seguir"}</button></div>)}</div>
      <div className="status-card"><span className={"status-dot " + (isSupabaseConfigured ? "" : "offline")} /> <b>{isSupabaseConfigured ? "Banco conectado" : "Banco não configurado"}</b><p>{isSupabaseConfigured ? "Conta, perfil, publicações, curtidas, reposts, salvos e seguir usam o Supabase. Mensagens e chamadas ainda estão no roteiro." : "Esta versão precisa das variáveis de conexão do Supabase para carregar os recursos reais."}</p></div>
    </aside>
    <nav className="mobile-nav">{nav.map(([label, icon]) => <button key={label} className={page === label ? "active" : ""} onClick={() => selectPage(label)}><Icon>{icon}</Icon><small>{label === "Notificações" ? "Alertas" : label === "Mensagens" ? "DMs" : label}</small></button>)}</nav>

    {authOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Fechar">×</button>
        <div className="modal-brand">N<span>.</span></div>
        <span className="eyebrow">NEXEL / SUA CONTA</span>
        <h2 id="auth-title">{authMode === "signup" ? "Crie seu espaço." : "Que bom te ver."}</h2>
        <p className="modal-description">{authMode === "signup" ? "Crie uma conta para publicar e conversar com a comunidade." : "Entre para publicar, curtir, salvar e seguir pessoas."}</p>
        <div className="auth-switch"><button className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setAuthFeedback(""); }}>Entrar</button><button className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setAuthFeedback(""); }}>Criar conta</button></div>
        <form onSubmit={submitAuth} className="modal-form">
          {authMode === "signup" && <label>Como quer ser chamado?<input value={authName} onChange={event => setAuthName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" placeholder="Seu nome" /></label>}
          <label>E-mail<input type="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required autoComplete="email" placeholder="voce@email.com" /></label>
          <label>Senha<input type="password" value={authPassword} onChange={event => setAuthPassword(event.target.value)} required minLength={6} autoComplete={authMode === "signup" ? "new-password" : "current-password"} placeholder="Pelo menos 6 caracteres" /></label>
          {authFeedback && <div className="modal-feedback" role="status">{authFeedback}</div>}
          <button className="primary-button modal-submit" type="submit" disabled={authBusy}>{authBusy ? "Aguarde..." : authMode === "signup" ? "Criar conta grátis" : "Entrar no NexEl"}</button>
        </form>
        <small className="privacy-note">Sua senha é validada pelo Supabase Auth; ela não é armazenada no perfil do NexEl.</small>
      </section>
    </div>}

    {profileOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button className="modal-close" onClick={() => setProfileOpen(false)} aria-label="Fechar">×</button>
        <span className="eyebrow">NEXEL / PERFIL</span>
        <h2 id="profile-title">Seu perfil</h2>
        <p className="modal-description">Atualize as informações que outras pessoas veem no feed.</p>
        <form onSubmit={saveProfile} className="modal-form">
          <label>Nome de exibição<input value={profileName} onChange={event => setProfileName(event.target.value)} required maxLength={80} /></label>
          <label>Nome de usuário<input value={profileUsername} onChange={event => setProfileUsername(event.target.value)} required minLength={3} maxLength={32} /></label>
          <label>Bio<textarea value={profileBio} onChange={event => setProfileBio(event.target.value)} maxLength={160} rows={3} placeholder="Conte algo sobre você..." /></label>
          <span className="bio-counter">{profileBio.length}/160</span>
          <button className="primary-button modal-submit" type="submit" disabled={profileBusy}>{profileBusy ? "Salvando..." : "Salvar perfil"}</button>
          <button className="ghost-button modal-logout" type="button" onClick={signOut}>Sair da conta</button>
        </form>
      </section>
    </div>}

    {communityOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setCommunityOpen(false); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="community-title">
        <button className="modal-close" onClick={() => setCommunityOpen(false)} aria-label="Fechar">×</button>
        <span className="eyebrow">NEXEL / NOVA COMUNIDADE</span>
        <h2 id="community-title">Crie seu espaço.</h2>
        <p className="modal-description">Sua comunidade começa com um canal de texto geral e um canal de voz.</p>
        <form className="modal-form" onSubmit={createCommunity}>
          <label>Nome da comunidade<input value={newServerName} onChange={event => setNewServerName(event.target.value)} required minLength={2} maxLength={48} placeholder="Ex.: Dev & Sistemas" /></label>
          <label>Descrição<textarea value={newServerDesc} onChange={event => setNewServerDesc(event.target.value)} maxLength={180} rows={3} placeholder="Sobre o que é esse espaço?" /></label>
          <small className="privacy-note">A comunidade será pública e poderá ser encontrada por outras pessoas conectadas ao NexEl.</small>
          <button className="primary-button modal-submit" type="submit" disabled={newServerBusy}>{newServerBusy ? "Criando..." : "Criar comunidade"}</button>
        </form>
      </section>
    </div>}

    {replyPost && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setReplyPost(null); }}>
      <section className="modal-card reply-modal" role="dialog" aria-modal="true" aria-labelledby="replies-title">
        <button className="modal-close" onClick={() => setReplyPost(null)} aria-label="Fechar">×</button>
        <span className="eyebrow">NEXEL / CONVERSA</span>
        <h2 id="replies-title">Respostas</h2>
        <article className="reply-original">
          <div className="reply-original-meta"><b>{replyPost.name}</b><span>{replyPost.handle}</span><span>{replyPost.time}</span></div>
          <p>{replyPost.body}</p>
        </article>
        <div className="reply-list">
          {replyLoading && <div className="reply-state">Carregando respostas...</div>}
          {!replyLoading && replyRows.length === 0 && <div className="reply-state">Ainda não há respostas. Comece a conversa.</div>}
          {replyRows.map(reply => <article className="reply-item" key={reply.id}>
            <Avatar initials={reply.initials} />
            <div className="reply-item-content">
              <div className="reply-original-meta"><b>{reply.name}</b><span>{reply.handle}</span><span>{reply.time}</span></div>
              <p>{reply.body}</p>
            </div>
          </article>)}
        </div>
        <form className="reply-form" onSubmit={submitReply}>
          <label htmlFor="reply-draft">Sua resposta</label>
          <textarea id="reply-draft" value={replyDraft} onChange={event => setReplyDraft(event.target.value)} maxLength={300} rows={3} placeholder={user ? "Continue a conversa..." : "Entre para responder..."} />
          <div className="reply-form-footer"><span>{replyDraft.length}/300</span><button className="primary-button" type="submit" disabled={replyBusy || replyLoading}>{replyBusy ? "Enviando..." : "Responder"} ↑</button></div>
        </form>
      </section>
    </div>}
  </div>;
}
