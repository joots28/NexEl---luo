import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../education.css";

const TOPICS = [
  ["logica", "Lógica de programação"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["web", "HTML, CSS e web"],
  ["backend", "Backend e APIs"],
  ["mobile", "Aplicativos mobile"],
  ["dados", "Dados e automação"],
  ["sql", "SQL e bancos de dados"],
  ["csharp", "C#"],
  ["kotlin", "Kotlin"],
  ["carreira", "Carreira dev"]
];

const LANGUAGES = [
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["csharp", "C#"],
  ["kotlin", "Kotlin"],
  ["sql", "SQL"],
  ["html-css", "HTML/CSS"],
  ["geral", "Não tenho preferência"]
];

const LEVELS = [
  ["iniciante", "Estou começando"],
  ["intermediario", "Já sei o básico"],
  ["avancado", "Quero me aprofundar"]
];

const GOALS = [
  ["fundamentos", "Aprender os fundamentos"],
  ["web", "Construir sites e sistemas web"],
  ["backend", "Criar APIs e trabalhar no backend"],
  ["mobile", "Desenvolver aplicativos"],
  ["dados", "Trabalhar com dados e automação"],
  ["carreira", "Preparar-me para a carreira dev"]
];

const CHALLENGES = [
  {
    slug: "if-maioridade",
    title: "Decisão com if/else",
    level: "iniciante",
    category: "Lógica",
    prompt: "Qual mensagem aparece no console?",
    code: "let idade = 16;\\nif (idade >= 18) {\\n  console.log('Pode entrar');\\n} else {\\n  console.log('Precisa esperar');\\n}",
    options: ["Pode entrar", "Precisa esperar", "As duas mensagens", "Nenhuma mensagem"],
    answer: 1,
    explanation: "Como 16 é menor que 18, a condição é falsa e o bloco else é executado."
  },
  {
    slug: "loop-contador",
    title: "Contador de repetição",
    level: "iniciante",
    category: "Laços",
    prompt: "Quantas vezes o laço executa?",
    code: "for (let i = 1; i <= 3; i++) {\\n  console.log(i);\\n}",
    options: ["2 vezes", "3 vezes", "4 vezes", "Infinitamente"],
    answer: 1,
    explanation: "O contador vale 1, 2 e 3. Quando passa a 4, a condição i <= 3 deixa de ser verdadeira."
  },
  {
    slug: "operador-and",
    title: "Pensamento lógico",
    level: "iniciante",
    category: "Operadores",
    prompt: "Qual é o resultado de true && false?",
    code: "const acesso = true && false;",
    options: ["true", "false", "null", "Erro de sintaxe"],
    answer: 1,
    explanation: "O operador && só resulta em true quando os dois lados são verdadeiros."
  },
  {
    slug: "array-indice",
    title: "Índices de arrays",
    level: "intermediario",
    category: "JavaScript",
    prompt: "O que aparece no console?",
    code: "const linguagens = ['JS', 'Python', 'C#'];\\nconsole.log(linguagens[1]);",
    options: ["JS", "Python", "C#", "1"],
    answer: 1,
    explanation: "Em JavaScript, o primeiro item fica no índice 0; por isso o índice 1 aponta para Python."
  },
  {
    slug: "variavel-atualiza",
    title: "Acompanhe o valor",
    level: "intermediario",
    category: "Variáveis",
    prompt: "Qual valor de total é exibido?",
    code: "let total = 4;\\ntotal = total + 3;\\ntotal += 2;\\nconsole.log(total);",
    options: ["5", "7", "9", "11"],
    answer: 2,
    explanation: "O valor começa em 4, recebe mais 3 e depois mais 2. Resultado: 9."
  },
  {
    slug: "condicao-composta",
    title: "Duas condições",
    level: "avancado",
    category: "Lógica",
    prompt: "Qual é o resultado da expressão?",
    code: "const resultado = (8 > 5) && (2 === '2');",
    options: ["true", "false", "undefined", "Erro"],
    answer: 1,
    explanation: "A primeira condição é verdadeira, mas 2 === '2' é falso porque os tipos são diferentes. Com &&, o resultado fica false."
  }
];

function friendlyError(error) {
  const message = error?.message || "Não foi possível concluir a operação.";
  if (/row-level security|violates row-level security/i.test(message)) return "O banco bloqueou esta ação por segurança. Confirme se sua conta tem a permissão necessária.";
  if (/duplicate key|unique constraint/i.test(message)) return "Já existe uma solicitação pendente para esta conta.";
  if (/file size|too large|exceeded/i.test(message)) return "Esse arquivo ultrapassa o limite de 50 MB.";
  return message;
}

function ago(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "agora";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " h";
  return new Date(value).toLocaleDateString("pt-BR");
}

function statusCopy(status) {
  return ({
    pending: ["Em análise", "status-pending"],
    approved: ["Professor verificado", "status-approved"],
    rejected: ["Precisa de ajustes", "status-rejected"],
    pending_review: ["Vídeo em revisão", "status-pending"],
    published: ["Publicado", "status-approved"]
  })[status] || [status, ""];
}

function scoreVideo(video, learner) {
  const interests = new Set([...(learner?.interest_tags || []), ...(learner?.preferred_languages || [])]);
  const tags = [...(video.tags || []), video.topic, video.programming_language].filter(Boolean);
  const topicScore = tags.reduce((score, tag) => score + (interests.has(String(tag).toLowerCase()) ? 4 : 0), 0);
  const levelScore = video.level === learner?.current_level ? 3 : video.level === "iniciante" ? 1 : 0;
  const goalScore = learner?.learning_goal && tags.some(tag => String(tag).toLowerCase().includes(learner.learning_goal)) ? 2 : 0;
  return topicScore + levelScore + goalScore;
}

export default function LearningHub({ user }) {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const [learner, setLearner] = useState(null);
  const [topicChoices, setTopicChoices] = useState(["logica", "javascript", "web"]);
  const [levelChoice, setLevelChoice] = useState("iniciante");
  const [languageChoices, setLanguageChoices] = useState(["javascript"]);
  const [goalChoice, setGoalChoice] = useState("fundamentos");
  const [ownRequest, setOwnRequest] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRequests, setAdminRequests] = useState([]);
  const [videos, setVideos] = useState([]);
  const [moderating, setModerating] = useState("");
  const [activeTab, setActiveTab] = useState("recomendados");
  const [institution, setInstitution] = useState("");
  const [professionalEmail, setProfessionalEmail] = useState("");
  const [professionalUrl, setProfessionalUrl] = useState("");
  const [expertise, setExpertise] = useState("");
  const [submittingTeacher, setSubmittingTeacher] = useState(false);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoTopic, setVideoTopic] = useState("logica");
  const [videoLevel, setVideoLevel] = useState("iniciante");
  const [videoLanguage, setVideoLanguage] = useState("javascript");
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeFeedback, setChallengeFeedback] = useState(null);
  const [savingAttempt, setSavingAttempt] = useState(false);

  const loadData = useCallback(async () => {
    if (!supabase || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const [learnerResult, requestResult, adminResult, videosResult] = await Promise.all([
        supabase.from("learning_profiles")
          .select("user_id, interest_tags, current_level, preferred_languages, learning_goal, questionnaire_completed")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("teacher_verification_requests")
          .select("id, user_id, institution, professional_email, professional_profile_url, expertise, status, review_note, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("learning_videos")
          .select("id, teacher_id, title, description, topic, level, programming_language, tags, storage_path, status, moderation_note, created_at")
          .order("created_at", { ascending: false }).limit(60)
      ]);
      if (learnerResult.error) throw learnerResult.error;
      if (requestResult.error) throw requestResult.error;
      if (adminResult.error) throw adminResult.error;
      if (videosResult.error) throw videosResult.error;

      const savedLearner = learnerResult.data || null;
      setLearner(savedLearner);
      if (savedLearner) {
        setTopicChoices(savedLearner.interest_tags || []);
        setLevelChoice(savedLearner.current_level || "iniciante");
        setLanguageChoices(savedLearner.preferred_languages || []);
        setGoalChoice(savedLearner.learning_goal || "fundamentos");
      }
      setOwnRequest(requestResult.data || null);
      const admin = Boolean(adminResult.data?.user_id);
      setIsAdmin(admin);

      if (admin) {
        const { data, error } = await supabase.from("teacher_verification_requests")
          .select("id, user_id, institution, professional_email, professional_profile_url, expertise, status, created_at")
          .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
        if (error) throw error;
        setAdminRequests(data || []);
      } else {
        setAdminRequests([]);
      }

      const rawVideos = videosResult.data || [];
      const teacherIds = [...new Set(rawVideos.map(video => video.teacher_id))];
      const [profilesResult, urls] = await Promise.all([
        teacherIds.length
          ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", teacherIds)
          : Promise.resolve({ data: [], error: null }),
        Promise.all(rawVideos.map(async video => {
          const { data, error } = await supabase.storage.from("learning-videos").createSignedUrl(video.storage_path, 3600);
          return [video.id, error ? "" : (data?.signedUrl || "")];
        }))
      ]);
      if (profilesResult.error) throw profilesResult.error;
      const profileById = new Map((profilesResult.data || []).map(person => [person.id, person]));
      const urlById = new Map(urls);
      setVideos(rawVideos.map(video => ({
        ...video,
        teacherName: profileById.get(video.teacher_id)?.display_name || profileById.get(video.teacher_id)?.username || "Professor NexEl",
        teacherHandle: profileById.get(video.teacher_id)?.username ? "@" + profileById.get(video.teacher_id).username : "",
        signedUrl: urlById.get(video.id) || ""
      })));
    } catch (error) {
      setNotice("Não consegui carregar a área de aprendizagem: " + friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const publishedVideos = useMemo(() => {
    const available = videos.filter(video => video.status === "published");
    return available.sort((a, b) => scoreVideo(b, learner) - scoreVideo(a, learner));
  }, [videos, learner]);

  const myVideos = useMemo(() => videos.filter(video => video.teacher_id === user?.id), [videos, user?.id]);
  const pendingVideos = useMemo(() => videos.filter(video => video.status === "pending_review"), [videos]);

  function toggleChoice(value, values, setter) {
    setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  }

  async function saveQuestionnaire(event) {
    event.preventDefault();
    if (!supabase || savingProfile) return;
    if (topicChoices.length === 0) {
      setNotice("Escolha pelo menos um assunto para personalizar suas recomendações.");
      return;
    }
    setSavingProfile(true);
    setNotice("");
    setSuccess("");
    const row = {
      user_id: user.id,
      interest_tags: topicChoices,
      current_level: levelChoice,
      preferred_languages: languageChoices,
      learning_goal: goalChoice,
      questionnaire_completed: true,
      updated_at: new Date().toISOString()
    };
    try {
      const { data, error } = await supabase.from("learning_profiles").upsert(row).select().single();
      if (error) throw error;
      setLearner(data);
      setSuccess("Perfil de aprendizagem salvo! As aulas são reordenadas de acordo com suas escolhas.");
    } catch (error) {
      setNotice("Não consegui salvar seu perfil: " + friendlyError(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function applyAsTeacher(event) {
    event.preventDefault();
    if (!supabase || submittingTeacher) return;
    if (!professionalEmail.trim() && !professionalUrl.trim()) {
      setNotice("Informe um e-mail profissional ou um perfil profissional público para ajudar na verificação.");
      return;
    }
    setSubmittingTeacher(true);
    setNotice("");
    setSuccess("");
    try {
      const { error } = await supabase.from("teacher_verification_requests").insert({
        user_id: user.id,
        institution: institution.trim(),
        professional_email: professionalEmail.trim() || null,
        professional_profile_url: professionalUrl.trim() || null,
        expertise: expertise.trim(),
        status: "pending"
      });
      if (error) throw error;
      setInstitution("");
      setProfessionalEmail("");
      setProfessionalUrl("");
      setExpertise("");
      setSuccess("Solicitação enviada. Enquanto ela estiver em análise, sua conta não poderá publicar vídeos.");
      await loadData();
    } catch (error) {
      setNotice("Não consegui enviar a solicitação: " + friendlyError(error));
    } finally {
      setSubmittingTeacher(false);
    }
  }

  async function reviewTeacher(request, status) {
    if (!supabase || !isAdmin || moderating) return;
    setModerating(request.id);
    setNotice("");
    setSuccess("");
    try {
      const { error } = await supabase.from("teacher_verification_requests")
        .update({
          status,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
          review_note: status === "approved" ? "Verificação aprovada pela equipe NexEl." : "Precisamos de mais informações para confirmar o vínculo docente."
        })
        .eq("id", request.id);
      if (error) throw error;
      setSuccess(status === "approved" ? "Professor verificado." : "Solicitação recusada; a pessoa poderá enviar uma nova solicitação.");
      await loadData();
    } catch (error) {
      setNotice("Não consegui revisar a solicitação: " + friendlyError(error));
    } finally {
      setModerating("");
    }
  }

  async function uploadLesson(event) {
    event.preventDefault();
    if (!supabase || !user?.id || uploadingVideo) return;
    if (ownRequest?.status !== "approved") {
      setNotice("Somente professores verificados podem enviar vídeos.");
      return;
    }
    if (!videoFile) {
      setNotice("Selecione um vídeo primeiro.");
      return;
    }
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(videoFile.type)) {
      setNotice("Use um arquivo MP4, WebM ou MOV.");
      return;
    }
    if (videoFile.size > 50 * 1024 * 1024) {
      setNotice("O vídeo deve ter no máximo 50 MB nesta versão gratuita.");
      return;
    }

    setUploadingVideo(true);
    setNotice("");
    setSuccess("");
    const cleanedName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "aula.mp4";
    const storagePath = user.id + "/" + crypto.randomUUID() + "-" + cleanedName;
    try {
      const { error: storageError } = await supabase.storage.from("learning-videos")
        .upload(storagePath, videoFile, { contentType: videoFile.type, upsert: false });
      if (storageError) throw storageError;

      const { error: rowError } = await supabase.from("learning_videos").insert({
        teacher_id: user.id,
        title: videoTitle.trim(),
        description: videoDescription.trim(),
        topic: videoTopic,
        level: videoLevel,
        programming_language: videoLanguage,
        tags: [videoTopic, videoLanguage].map(value => value.toLowerCase()),
        storage_path: storagePath,
        status: "pending_review"
      });
      if (rowError) {
        await supabase.storage.from("learning-videos").remove([storagePath]);
        throw rowError;
      }

      setVideoTitle("");
      setVideoDescription("");
      setVideoFile(null);
      const input = document.getElementById("learning-video-file");
      if (input) input.value = "";
      setSuccess("Vídeo enviado para revisão. Ele só ficará disponível para a comunidade depois de aprovado.");
      await loadData();
    } catch (error) {
      setNotice("Não consegui enviar o vídeo: " + friendlyError(error));
    } finally {
      setUploadingVideo(false);
    }
  }

  async function reviewVideo(video, status) {
    if (!supabase || !isAdmin || moderating) return;
    setModerating(video.id);
    setNotice("");
    setSuccess("");
    try {
      const { error } = await supabase.from("learning_videos").update({
        status,
        reviewer_id: user.id,
        reviewed_at: new Date().toISOString(),
        moderation_note: status === "published" ? null : "O vídeo precisa de ajustes antes de ser publicado."
      }).eq("id", video.id);
      if (error) throw error;
      setSuccess(status === "published" ? "Vídeo publicado na área de aprendizagem." : "Vídeo marcado para ajustes.");
      await loadData();
    } catch (error) {
      setNotice("Não consegui revisar o vídeo: " + friendlyError(error));
    } finally {
      setModerating("");
    }
  }

  function openChallenge(challenge) {
    setActiveChallenge(challenge);
    setChallengeAnswer("");
    setChallengeFeedback(null);
  }

  async function submitChallenge() {
    if (!activeChallenge || challengeAnswer === "" || savingAttempt) return;
    const isCorrect = Number(challengeAnswer) === activeChallenge.answer;
    setChallengeFeedback({ isCorrect, explanation: activeChallenge.explanation });
    setSavingAttempt(true);
    try {
      if (supabase && user?.id) {
        const { error } = await supabase.from("learning_challenge_attempts").insert({
          user_id: user.id,
          challenge_slug: activeChallenge.slug,
          selected_answer: activeChallenge.options[Number(challengeAnswer)],
          is_correct: isCorrect
        });
        if (error) throw error;
      }
    } catch (error) {
      setNotice("Resposta avaliada, mas não consegui salvar o histórico: " + friendlyError(error));
    } finally {
      setSavingAttempt(false);
    }
  }

  if (loading) {
    return <section className="learning-page"><div className="learn-loading"><span className="learn-spinner" /> Montando sua trilha de aprendizagem...</div></section>;
  }

  return <section className="learning-page">
    <header className="learn-hero">
      <div>
        <span className="eyebrow">NEXEL / DEV ACADEMY</span>
        <h2>Aprender também é <span>construir.</span></h2>
        <p>Vídeos de professores verificados, desafios de lógica e uma trilha ajustada ao seu momento na programação.</p>
      </div>
      <div className="learn-hero-mark"><span>NX</span><small>LEARN / 01</small></div>
    </header>

    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
    {success && <div className="learn-success" role="status"><span>✓</span><p>{success}</p><button onClick={() => setSuccess("")} aria-label="Fechar aviso">×</button></div>}

    <nav className="learn-tabs" aria-label="Seções de aprendizagem">
      <button className={activeTab === "recomendados" ? "active" : ""} onClick={() => setActiveTab("recomendados")}>✦ Para você</button>
      <button className={activeTab === "desafios" ? "active" : ""} onClick={() => setActiveTab("desafios")}>⌘ Desafios</button>
      <button className={activeTab === "professor" ? "active" : ""} onClick={() => setActiveTab("professor")}>▣ Área do professor</button>
      {isAdmin && <button className={activeTab === "revisao" ? "active" : ""} onClick={() => setActiveTab("revisao")}>✓ Revisão da equipe</button>}
    </nav>

    {activeTab === "recomendados" && <>
      <section className="learn-section">
        <div className="learn-section-heading"><div><span className="eyebrow">RECOMENDAÇÃO PERSONALIZADA</span><h3>Monte sua trilha</h3></div><span className="learn-section-number">01 / PERFIL</span></div>
        <form className="learner-quiz" onSubmit={saveQuestionnaire}>
          <div className="learner-quiz-intro"><span className="learner-quiz-icon">✦</span><div><b>{learner?.questionnaire_completed ? "Seu perfil de aprendizagem" : "Descubra por onde começar"}</b><p>Responda de acordo com seus objetivos; não existe resposta errada.</p></div></div>
          <fieldset className="learn-fieldset"><legend>1. Quais assuntos despertam sua curiosidade?</legend><div className="learn-choice-grid">{TOPICS.map(([value, label]) => <label className="learn-check" key={value}><input type="checkbox" checked={topicChoices.includes(value)} onChange={() => toggleChoice(value, topicChoices, setTopicChoices)} /><span>{label}</span></label>)}</div></fieldset>
          <fieldset className="learn-fieldset"><legend>2. Como você se sente com programação hoje?</legend><div className="learn-radio-grid">{LEVELS.map(([value, label]) => <label className={"learn-radio " + (levelChoice === value ? "selected" : "")} key={value}><input type="radio" name="learner-level" value={value} checked={levelChoice === value} onChange={() => setLevelChoice(value)} /><span>{label}</span></label>)}</div></fieldset>
          <div className="learn-two-columns">
            <label className="learn-select-label">3. Qual é seu objetivo?<select value={goalChoice} onChange={event => setGoalChoice(event.target.value)}>{GOALS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <fieldset className="learn-fieldset"><legend>4. Linguagens de interesse</legend><div className="learn-language-row">{LANGUAGES.map(([value,label]) => <label className="learn-mini-check" key={value}><input type="checkbox" checked={languageChoices.includes(value)} onChange={() => toggleChoice(value, languageChoices, setLanguageChoices)} /><span>{label}</span></label>)}</div></fieldset>
          </div>
          <div className="learn-form-footer"><small>Você pode mudar suas escolhas quando quiser.</small><button className="primary-button" type="submit" disabled={savingProfile}>{savingProfile ? "Salvando..." : "Personalizar recomendações"} ↗</button></div>
        </form>
      </section>

      <section className="learn-section">
        <div className="learn-section-heading"><div><span className="eyebrow">CONTEÚDO CURADO</span><h3>Vídeos para o seu próximo passo</h3><p>Somente vídeos de professores verificados e aprovados pela equipe NexEl aparecem na biblioteca.</p></div><span className="learn-section-number">{publishedVideos.length.toString().padStart(2,"0")} / AULAS</span></div>
        {publishedVideos.length === 0 ? <div className="learn-empty"><div className="learn-empty-mark">▶</div><h4>A primeira aula está por vir.</h4><p>A biblioteca fica pronta para recomendar conteúdo assim que um professor verificado publicar uma aula aprovada. Enquanto isso, experimente os desafios de lógica.</p><button className="learn-secondary-button" onClick={() => setActiveTab("desafios")}>Resolver um desafio ↗</button></div>
        : <div className="learn-video-grid">{publishedVideos.map((video,index) => <article className="learn-video-card" key={video.id}>
          <div className="learn-video-player">
            {video.signedUrl ? <video controls preload="metadata" src={video.signedUrl} aria-label={video.title} /> : <div className="learn-video-unavailable">Vídeo indisponível no momento</div>}
            <span className="learn-video-number">{String(index+1).padStart(2,"0")}</span>
          </div>
          <div className="learn-video-copy"><div className="learn-video-tags"><span>{video.topic}</span><span>{video.level}</span></div><h4>{video.title}</h4><p>{video.description || "Uma aula preparada pela comunidade docente do NexEl."}</p><div className="learn-video-byline"><span className="learn-teacher-avatar">{(video.teacherName || "P").slice(0,1).toUpperCase()}</span><span><b>{video.teacherName}</b><small>Professor verificado {video.teacherHandle}</small></span><span className="verified-mini">✓</span></div></div>
        </article>)}</div>}
      </section>

      {myVideos.length > 0 && <section className="learn-section"><div className="learn-section-heading"><div><span className="eyebrow">PAINEL DO PROFESSOR</span><h3>Seus envios</h3></div></div><div className="learn-submission-list">{myVideos.map(video => { const status = statusCopy(video.status); return <article key={video.id}><div><b>{video.title}</b><small>{video.topic} · enviado em {ago(video.created_at)}</small></div><span className={"learn-status " + status[1]}>{status[0]}</span></article>; })}</div></section>}
    </>}

    {activeTab === "desafios" && <section className="learn-section">
      <div className="learn-section-heading"><div><span className="eyebrow">LABORATÓRIO DE RACIOCÍNIO</span><h3>Pequenos desafios, grandes ideias</h3><p>Treine sua lógica no navegador. Cada resposta traz uma explicação, não só um certo ou errado.</p></div><span className="learn-section-number">02 / PRÁTICA</span></div>
      <div className="challenge-grid">{CHALLENGES.filter(challenge => challenge.level === (learner?.current_level || levelChoice) || (learner?.current_level || levelChoice) === "iniciante" || challenge.level === "iniciante").map(challenge => <article className="challenge-card" key={challenge.slug}><div className="challenge-card-top"><span className="challenge-symbol">⌘</span><span className="challenge-difficulty">{challenge.level}</span></div><small>{challenge.category}</small><h4>{challenge.title}</h4><p>{challenge.prompt}</p><pre><code>{challenge.code.replace(/\\n/g,"\n")}</code></pre><button className="learn-secondary-button" onClick={() => openChallenge(challenge)}>Começar desafio ↗</button></article>)}</div>
    </section>}

    {activeTab === "professor" && <section className="learn-section">
      <div className="learn-section-heading"><div><span className="eyebrow">CONTEÚDO DE QUALIDADE</span><h3>Área do professor</h3><p>Professores passam por uma verificação antes de enviar conteúdo. Os vídeos entram na biblioteca após uma revisão adicional.</p></div><span className="learn-section-number">03 / DOCÊNCIA</span></div>
      {ownRequest?.status === "approved" ? <div className="teacher-verified-banner"><span className="teacher-check">✓</span><div><b>Seu perfil docente está verificado.</b><p>Você pode enviar vídeos educacionais. A equipe ainda revisará cada publicação antes de liberá-la.</p></div><span className="learn-status status-approved">Verificado</span></div>
      : ownRequest?.status === "pending" ? <div className="learn-empty teacher-pending"><div className="learn-empty-mark">◷</div><h4>Solicitação em análise.</h4><p>Cadastro recebido em {new Date(ownRequest.created_at).toLocaleDateString("pt-BR")}. A publicação de vídeos só será liberada depois da aprovação.</p><span className="learn-status status-pending">Em análise</span></div>
      : <div className="teacher-application">
        <div className="teacher-application-intro"><div className="teacher-app-icon">✓</div><div><h4>Solicite o selo de professor</h4><p>Informe o vínculo docente e um meio profissional para a equipe conferir. Não envie documentos pessoais sensíveis; use referências profissionais públicas sempre que possível.</p></div></div>
        {ownRequest?.status === "rejected" && <div className="teacher-rejection-note"><b>Precisamos de mais informações.</b><span>{ownRequest.review_note || "Revise os dados abaixo e envie uma nova solicitação."}</span></div>}
        <form className="teacher-form" onSubmit={applyAsTeacher}>
          <label>Instituição de ensino<input value={institution} onChange={event => setInstitution(event.target.value)} required minLength={2} maxLength={120} placeholder="Escola, faculdade ou instituição" /></label>
          <label>Área que ensina<input value={expertise} onChange={event => setExpertise(event.target.value)} required minLength={2} maxLength={180} placeholder="Ex.: lógica, desenvolvimento web, banco de dados" /></label>
          <label>E-mail profissional <span>(opcional se informar o perfil abaixo)</span><input type="email" value={professionalEmail} onChange={event => setProfessionalEmail(event.target.value)} maxLength={254} placeholder="voce@instituicao.edu.br" /></label>
          <label>Perfil profissional ou página institucional <span>(opcional se informar o e-mail)</span><input type="url" value={professionalUrl} onChange={event => setProfessionalUrl(event.target.value)} maxLength={500} placeholder="https://..." /></label>
          <div className="teacher-privacy-note">A aprovação é manual. Um e-mail ou link, sozinho, não concede o selo; a equipe precisa analisar a solicitação. Não armazenamos cópias de documentos pessoais nesta etapa.</div>
          <button className="primary-button" type="submit" disabled={submittingTeacher}>{submittingTeacher ? "Enviando solicitação..." : "Solicitar verificação docente"} ↗</button>
        </form>
      </div>}

      {ownRequest?.status === "approved" && <div className="teacher-upload-panel"><div className="learn-section-heading"><div><span className="eyebrow">PUBLICAÇÃO DOCENTE</span><h3>Enviar uma aula em vídeo</h3><p>MP4, WebM ou MOV, até 50 MB. O arquivo fica privado enquanto aguarda revisão.</p></div><span className="learn-section-number">MAX. 50 MB</span></div>
        <form className="teacher-form" onSubmit={uploadLesson}>
          <label>Título da aula<input value={videoTitle} onChange={event => setVideoTitle(event.target.value)} required minLength={4} maxLength={120} placeholder="Ex.: Condicionais em JavaScript na prática" /></label>
          <label>Resumo da aula<textarea value={videoDescription} onChange={event => setVideoDescription(event.target.value)} maxLength={700} rows={3} placeholder="O que a pessoa vai aprender?" /></label>
          <div className="learn-two-columns">
            <label>Assunto<select value={videoTopic} onChange={event => setVideoTopic(event.target.value)}>{TOPICS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Nível<select value={videoLevel} onChange={event => setVideoLevel(event.target.value)}>{LEVELS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <label>Linguagem principal<select value={videoLanguage} onChange={event => setVideoLanguage(event.target.value)}>{LANGUAGES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="learn-file-picker">Arquivo de vídeo<input id="learning-video-file" type="file" accept="video/mp4,video/webm,video/quicktime" required onChange={event => setVideoFile(event.target.files?.[0] || null)} /><small>{videoFile ? videoFile.name + " · " + (videoFile.size / (1024*1024)).toFixed(1) + " MB" : "Selecione MP4, WebM ou MOV. Máximo de 50 MB."}</small></label>
          <div className="teacher-privacy-note">Ao enviar, você confirma que tem direito de compartilhar este conteúdo. A publicação fica pendente até uma pessoa administradora aprovar.</div>
          <button className="primary-button" type="submit" disabled={uploadingVideo}>{uploadingVideo ? "Enviando vídeo..." : "Enviar para revisão"} ↑</button>
        </form>
      </div>}
    </section>}

    {activeTab === "revisao" && isAdmin && <section className="learn-section">
      <div className="learn-section-heading"><div><span className="eyebrow">FERRAMENTAS INTERNAS</span><h3>Fila de revisão</h3><p>Confira vínculo docente e conteúdo antes de disponibilizar uma aula à comunidade.</p></div><button className="learn-secondary-button" onClick={loadData}>Atualizar ↻</button></div>
      <div className="admin-review-block"><h4>Solicitações de professores <span>{adminRequests.length}</span></h4>
        {adminRequests.length === 0 ? <div className="learn-empty compact"><p>Nenhuma solicitação aguardando revisão.</p></div> : adminRequests.map(request => <article className="admin-review-card" key={request.id}><div className="admin-review-main"><span className="admin-review-symbol">✦</span><div><b>{request.institution}</b><p>{request.expertise}</p><small>{request.professional_email || "Sem e-mail profissional"}{request.professional_profile_url ? " · " + request.professional_profile_url : ""}</small><small>Enviado em {new Date(request.created_at).toLocaleDateString("pt-BR")}</small></div></div><div className="admin-review-actions"><button className="primary-button" disabled={Boolean(moderating)} onClick={() => reviewTeacher(request,"approved")}>{moderating === request.id ? "Salvando..." : "Aprovar"}</button><button className="learn-danger-button" disabled={Boolean(moderating)} onClick={() => reviewTeacher(request,"rejected")}>Recusar</button></div></article>)}
      </div>
      <div className="admin-review-block"><h4>Vídeos aguardando aprovação <span>{pendingVideos.length}</span></h4>
        {pendingVideos.length === 0 ? <div className="learn-empty compact"><p>Nenhum vídeo na fila de revisão.</p></div> : pendingVideos.map(video => <article className="admin-review-card" key={video.id}><div className="admin-review-main"><span className="admin-review-symbol">▶</span><div><b>{video.title}</b><p>{video.description || "Sem resumo."}</p><small>{video.teacherName} · {video.topic} · {video.level} · {video.programming_language}</small>{video.signedUrl && <video className="admin-preview-video" controls preload="metadata" src={video.signedUrl} />}</div></div><div className="admin-review-actions"><button className="primary-button" disabled={Boolean(moderating)} onClick={() => reviewVideo(video,"published")}>{moderating === video.id ? "Salvando..." : "Publicar"}</button><button className="learn-danger-button" disabled={Boolean(moderating)} onClick={() => reviewVideo(video,"rejected")}>Pedir ajustes</button></div></article>)}
      </div>
    </section>}

    {activeChallenge && <div className="learn-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setActiveChallenge(null); }}>
      <section className="learn-challenge-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-title">
        <button className="learn-modal-close" onClick={() => setActiveChallenge(null)} aria-label="Fechar desafio">×</button>
        <span className="eyebrow">NEXEL / DESAFIO PRÁTICO</span><h3 id="challenge-title">{activeChallenge.title}</h3><p>{activeChallenge.prompt}</p>
        <pre><code>{activeChallenge.code.replace(/\\n/g,"\n")}</code></pre>
        <fieldset className="learn-challenge-options"><legend>Escolha uma resposta</legend>{activeChallenge.options.map((option,index) => <label className={challengeFeedback && index === activeChallenge.answer ? "correct" : ""} key={option}><input type="radio" name="challenge-answer" value={index} disabled={Boolean(challengeFeedback)} checked={challengeAnswer === String(index)} onChange={() => setChallengeAnswer(String(index))} /><span>{option}</span></label>)}</fieldset>
        {challengeFeedback && <div className={"challenge-explanation " + (challengeFeedback.isCorrect ? "is-correct" : "is-wrong")}><b>{challengeFeedback.isCorrect ? "Mandou bem! Resposta correta." : "Ainda não. Vamos entender o porquê."}</b><p>{challengeFeedback.explanation}</p></div>}
        <div className="learn-challenge-footer"><small>Seu resultado é salvo no seu perfil de aprendizagem.</small>{challengeFeedback ? <button className="primary-button" onClick={() => setActiveChallenge(null)}>Concluir</button> : <button className="primary-button" disabled={challengeAnswer === "" || savingAttempt} onClick={submitChallenge}>{savingAttempt ? "Salvando..." : "Conferir resposta"} ↗</button>}</div>
      </section>
    </div>}
  </section>;
}
