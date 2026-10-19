import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../education.css";

const TOPICS = [
  ["Lógica", "Lógica"],
  ["JavaScript", "JavaScript"],
  ["Python", "Python"],
  ["HTML/CSS", "HTML/CSS"],
  ["Backend", "Backend e APIs"],
  ["Banco de dados", "Banco de dados"],
  ["C#", "C#"],
  ["Kotlin", "Kotlin"],
  ["Carreira", "Carreira dev"]
];

const LANGUAGES = [
  ["geral", "Geral"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["csharp", "C#"],
  ["kotlin", "Kotlin"],
  ["sql", "SQL"],
  ["html-css", "HTML/CSS"]
];

function ago(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "agora";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " h";
  return new Date(value).toLocaleDateString("pt-BR");
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0,2).map(value => value[0] || "").join("").toUpperCase() || "NX";
}

function friendlyError(error) {
  const message = error?.message || "Não foi possível concluir esta ação.";
  if (/row-level security|violates row-level security/i.test(message)) return "O banco bloqueou esta ação por segurança.";
  if (/duplicate key|unique constraint/i.test(message)) return "Este registro já existe.";
  return message;
}

export default function HelpForum({ user, profile }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("Todas");
  const [sortMode, setSortMode] = useState("recentes");
  const [composeOpen, setComposeOpen] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionTopic, setQuestionTopic] = useState("Lógica");
  const [questionLanguage, setQuestionLanguage] = useState("geral");
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [postingAnswer, setPostingAnswer] = useState(false);
  const [voteBusy, setVoteBusy] = useState("");

  const loadQuestions = useCallback(async () => {
    if (!supabase || !user?.id) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: rows, error } = await supabase.from("help_questions")
        .select("id, author_id, title, body, topic, programming_language, created_at, updated_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const raw = rows || [];
      const ids = raw.map(row => row.id);
      const userIds = [...new Set(raw.map(row => row.author_id))];
      if (!ids.length) {
        setQuestions([]);
        return;
      }
      const [answersResult, votesResult, profilesResult] = await Promise.all([
        supabase.from("help_answers").select("id, question_id, is_accepted").in("question_id", ids),
        supabase.from("help_question_votes").select("question_id, user_id, vote").in("question_id", ids),
        supabase.from("profiles").select("id, username, display_name").in("id", userIds)
      ]);
      if (answersResult.error) throw answersResult.error;
      if (votesResult.error) throw votesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const answersByQuestion = new Map();
      for (const answer of answersResult.data || []) {
        const item = answersByQuestion.get(answer.question_id) || { count: 0, accepted: false };
        item.count += 1;
        item.accepted = item.accepted || Boolean(answer.is_accepted);
        answersByQuestion.set(answer.question_id, item);
      }
      const votesByQuestion = new Map();
      for (const vote of votesResult.data || []) {
        const item = votesByQuestion.get(vote.question_id) || { score: 0, ownVote: 0 };
        item.score += vote.vote;
        if (vote.user_id === user.id) item.ownVote = vote.vote;
        votesByQuestion.set(vote.question_id, item);
      }
      const profileById = new Map((profilesResult.data || []).map(person => [person.id, person]));
      setQuestions(raw.map(row => {
        const person = profileById.get(row.author_id);
        const vote = votesByQuestion.get(row.id) || { score: 0, ownVote: 0 };
        const reply = answersByQuestion.get(row.id) || { count: 0, accepted: false };
        return {
          ...row,
          authorName: person?.display_name || person?.username || "Pessoa dev",
          authorHandle: person?.username ? "@" + person.username : "",
          authorInitials: initials(person?.display_name || person?.username || "NX"),
          answerCount: reply.count,
          hasAcceptedAnswer: reply.accepted,
          score: vote.score,
          ownVote: vote.ownVote
        };
      }));
    } catch (error) {
      setNotice("Não consegui carregar o mural de ajuda: " + friendlyError(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const visibleQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = questions.filter(question =>
      (topicFilter === "Todas" || question.topic === topicFilter) &&
      (!term || (question.title + " " + question.body + " " + question.topic + " " + question.programming_language + " " + question.authorName).toLowerCase().includes(term))
    );
    if (sortMode === "votos") return filtered.sort((a,b) => b.score - a.score || new Date(b.created_at) - new Date(a.created_at));
    if (sortMode === "sem-resposta") return filtered.sort((a,b) => Number(a.answerCount > 0) - Number(b.answerCount > 0) || new Date(b.created_at) - new Date(a.created_at));
    return filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }, [questions, search, topicFilter, sortMode]);

  async function submitQuestion(event) {
    event.preventDefault();
    if (!supabase || postingQuestion) return;
    const title = questionTitle.trim();
    const body = questionBody.trim();
    if (title.length < 8 || body.length < 10) {
      setNotice("Use um título de pelo menos 8 caracteres e descreva o problema com pelo menos 10.");
      return;
    }
    setPostingQuestion(true);
    setNotice("");
    setSuccess("");
    try {
      const { error } = await supabase.from("help_questions").insert({
        author_id: user.id,
        title,
        body,
        topic: questionTopic,
        programming_language: questionLanguage
      });
      if (error) throw error;
      setQuestionTitle("");
      setQuestionBody("");
      setComposeOpen(false);
      setSuccess("Dúvida publicada. A comunidade já pode ajudar.");
      await loadQuestions();
    } catch (error) {
      setNotice("Não consegui publicar sua dúvida: " + friendlyError(error));
    } finally {
      setPostingQuestion(false);
    }
  }

  async function openQuestion(question) {
    setSelectedQuestion(question);
    setAnswerDraft("");
    setAnswers([]);
    setAnswersLoading(true);
    try {
      const { data: rows, error } = await supabase.from("help_answers")
        .select("id, question_id, author_id, body, is_accepted, created_at, updated_at")
        .eq("question_id", question.id).order("created_at", { ascending: true });
      if (error) throw error;
      const raw = rows || [];
      const userIds = [...new Set(raw.map(row => row.author_id))];
      const { data: profiles, error: profileError } = userIds.length
        ? await supabase.from("profiles").select("id, username, display_name").in("id", userIds)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const byId = new Map((profiles || []).map(person => [person.id, person]));
      setAnswers(raw.map(row => {
        const person = byId.get(row.author_id);
        const name = person?.display_name || person?.username || "Pessoa dev";
        return { ...row, authorName: name, authorHandle: person?.username ? "@" + person.username : "", authorInitials: initials(name) };
      }));
    } catch (error) {
      setNotice("Não consegui carregar as respostas: " + friendlyError(error));
    } finally {
      setAnswersLoading(false);
    }
  }

  async function submitAnswer(event) {
    event.preventDefault();
    const body = answerDraft.trim();
    if (!supabase || !selectedQuestion || postingAnswer) return;
    if (body.length < 2 || body.length > 3000) {
      setNotice("Sua resposta precisa ter entre 2 e 3.000 caracteres.");
      return;
    }
    setPostingAnswer(true);
    setNotice("");
    setSuccess("");
    try {
      const { error } = await supabase.from("help_answers").insert({
        question_id: selectedQuestion.id,
        author_id: user.id,
        body,
        is_accepted: false
      });
      if (error) throw error;
      setAnswerDraft("");
      setSuccess("Resposta enviada. Valeu por fortalecer a comunidade!");
      await Promise.all([openQuestion(selectedQuestion), loadQuestions()]);
    } catch (error) {
      setNotice("Não consegui enviar sua resposta: " + friendlyError(error));
    } finally {
      setPostingAnswer(false);
    }
  }

  async function toggleVote(question, direction) {
    if (!supabase || voteBusy) return;
    setVoteBusy(question.id);
    setNotice("");
    setSuccess("");
    try {
      if (question.ownVote === direction) {
        const { error } = await supabase.from("help_question_votes").delete()
          .eq("question_id", question.id).eq("user_id", user.id);
        if (error) throw error;
      } else if (question.ownVote) {
        const { error } = await supabase.from("help_question_votes").update({ vote: direction, updated_at: new Date().toISOString() })
          .eq("question_id", question.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("help_question_votes").insert({ question_id: question.id, user_id: user.id, vote: direction });
        if (error) throw error;
      }
      await loadQuestions();
    } catch (error) {
      setNotice("Não consegui registrar seu voto: " + friendlyError(error));
    } finally {
      setVoteBusy("");
    }
  }

  async function acceptAnswer(answer) {
    if (!supabase || !selectedQuestion || selectedQuestion.author_id !== user.id) return;
    setVoteBusy(answer.id);
    setNotice("");
    setSuccess("");
    try {
      if (answer.is_accepted) {
        const { error } = await supabase.from("help_answers")
          .update({ is_accepted: false, updated_at: new Date().toISOString() })
          .eq("id", answer.id);
        if (error) throw error;
      } else {
        const existing = answers.find(item => item.is_accepted);
        if (existing) {
          const { error: clearError } = await supabase.from("help_answers")
            .update({ is_accepted: false, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (clearError) throw clearError;
        }
        const { error } = await supabase.from("help_answers")
          .update({ is_accepted: true, updated_at: new Date().toISOString() })
          .eq("id", answer.id);
        if (error) throw error;
      }
      setSuccess(answer.is_accepted ? "Resposta desmarcada como solução." : "Resposta marcada como solução.");
      await Promise.all([openQuestion(selectedQuestion), loadQuestions()]);
    } catch (error) {
      setNotice("Não consegui marcar a solução: " + friendlyError(error));
    } finally {
      setVoteBusy("");
    }
  }

  return <section className="help-page">
    <header className="help-hero"><div><span className="eyebrow">NEXEL / COMUNIDADE DEV</span><h2>Ninguém precisa <span>travar sozinho.</span></h2><p>Compartilhe o erro, mostre o que tentou e aprenda junto. Boas respostas ajudam todo mundo que chegar depois.</p></div><div className="help-hero-mark"><b>?</b><small>HELP / OPEN</small></div></header>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
    {success && <div className="learn-success" role="status"><span>✓</span><p>{success}</p><button onClick={() => setSuccess("")} aria-label="Fechar aviso">×</button></div>}

    <div className="help-toolbar"><label className="help-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar erro, linguagem ou assunto..." aria-label="Buscar dúvidas" /></label><button className="primary-button" onClick={() => setComposeOpen(value => !value)}>{composeOpen ? "Cancelar" : "＋ Fazer pergunta"}</button></div>

    {composeOpen && <form className="help-compose" onSubmit={submitQuestion}>
      <div className="help-compose-head"><div><span className="eyebrow">NOVA DISCUSSÃO</span><h3>Qual é a sua dúvida?</h3><p>Inclua o erro e diga o que você já tentou. Não publique senhas, tokens ou dados pessoais.</p></div><span className="help-compose-avatar">{initials(profile?.display_name || user?.email || "NX")}</span></div>
      <label>Título da pergunta<input value={questionTitle} onChange={event => setQuestionTitle(event.target.value)} minLength={8} maxLength={160} required placeholder="Ex.: Por que meu fetch retorna erro 404?" /></label>
      <label>Detalhes<textarea value={questionBody} onChange={event => setQuestionBody(event.target.value)} minLength={10} maxLength={5000} required rows={5} placeholder={"Mostre o que você esperava, o que aconteceu e um trecho pequeno de código sem segredos..."} /></label>
      <div className="help-compose-grid"><label>Assunto<select value={questionTopic} onChange={event => setQuestionTopic(event.target.value)}>{TOPICS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Linguagem<select value={questionLanguage} onChange={event => setQuestionLanguage(event.target.value)}>{LANGUAGES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="help-compose-footer"><span>{questionBody.length}/5000 · Perguntas e respostas ficam visíveis para pessoas conectadas.</span><button className="primary-button" type="submit" disabled={postingQuestion}>{postingQuestion ? "Publicando..." : "Publicar dúvida"} ↗</button></div>
    </form>}

    <div className="help-layout">
      <section className="help-question-list">
        <div className="help-list-header"><div><span className="eyebrow">TROCA DE CONHECIMENTO</span><h3>Discussões da comunidade</h3></div><label className="help-sort"><span>Ordenar</span><select value={sortMode} onChange={event => setSortMode(event.target.value)}><option value="recentes">Mais recentes</option><option value="votos">Mais votadas</option><option value="sem-resposta">Sem resposta</option></select></label></div>
        <div className="help-topic-filter"><button className={topicFilter === "Todas" ? "selected" : ""} onClick={() => setTopicFilter("Todas")}>Todas</button>{TOPICS.map(([value]) => <button key={value} className={topicFilter === value ? "selected" : ""} onClick={() => setTopicFilter(value)}>{value}</button>)}</div>
        {loading ? <div className="learn-loading"><span className="learn-spinner" /> Buscando dúvidas...</div>
        : visibleQuestions.length === 0 ? <div className="learn-empty help-empty"><div className="learn-empty-mark">?</div><h4>Seja a primeira pessoa a puxar esse assunto.</h4><p>Faça uma pergunta clara. Outra pessoa pode estar aprendendo a mesma coisa neste momento.</p><button className="learn-secondary-button" onClick={() => setComposeOpen(true)}>Fazer uma pergunta ↗</button></div>
        : visibleQuestions.map(question => <article className={"help-question-card " + (selectedQuestion?.id === question.id ? "opened" : "")} key={question.id}>
          <div className="help-vote-column"><button className={question.ownVote === 1 ? "voted" : ""} disabled={voteBusy === question.id || question.author_id === user.id} onClick={() => toggleVote(question,1)} aria-label="Voto positivo" title={question.author_id === user.id ? "Você não pode votar na própria pergunta" : "Votar positivamente"}>▲</button><b>{question.score}</b><button className={question.ownVote === -1 ? "voted" : ""} disabled={voteBusy === question.id || question.author_id === user.id} onClick={() => toggleVote(question,-1)} aria-label="Voto negativo" title="Voto negativo">▼</button></div>
          <div className="help-question-main"><div className="help-question-meta"><span>{question.topic}</span><span>{question.programming_language}</span><time>{ago(question.created_at)}</time>{question.hasAcceptedAnswer && <span className="help-solved-badge">✓ Resolvida</span>}</div><button className="help-question-title" onClick={() => openQuestion(question)}>{question.title}</button><p className="help-question-excerpt">{question.body}</p><div className="help-question-footer"><span className="help-author-avatar">{question.authorInitials}</span><span>por <b>{question.authorName}</b> {question.authorHandle}</span><button onClick={() => openQuestion(question)}>{question.answerCount} {question.answerCount === 1 ? "resposta" : "respostas"} ↗</button></div></div>
        </article>)}
      </section>

      <aside className="help-sidebar"><div className="help-rules-card"><span className="eyebrow">COMBINADOS DA CASA</span><h3>Ajude a ajuda a funcionar.</h3><ul><li>Explique o contexto e o resultado esperado.</li><li>Formate o código e remova senhas, tokens e informações pessoais.</li><li>Responda com respeito; todo mundo já começou do zero.</li><li>Quando uma resposta resolver seu problema, marque-a como solução.</li></ul></div><div className="help-stats-card"><div><span>Perguntas na comunidade</span><b>{questions.length}</b></div><div><span>Respostas publicadas</span><b>{questions.reduce((total,q) => total + q.answerCount,0)}</b></div><div><span>Discussões com solução</span><b>{questions.filter(q => q.hasAcceptedAnswer).length}</b></div></div></aside>
    </div>

    {selectedQuestion && <div className="learn-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedQuestion(null); }}>
      <section className="help-thread-modal" role="dialog" aria-modal="true" aria-labelledby="help-thread-title">
        <button className="learn-modal-close" onClick={() => setSelectedQuestion(null)} aria-label="Fechar discussão">×</button>
        <span className="eyebrow">NEXEL / DISCUSSÃO</span><div className="help-thread-tags"><span>{selectedQuestion.topic}</span><span>{selectedQuestion.programming_language}</span><time>{new Date(selectedQuestion.created_at).toLocaleString("pt-BR")}</time></div>
        <h3 id="help-thread-title">{selectedQuestion.title}</h3><div className="help-thread-author">Pergunta de <b>{selectedQuestion.authorName}</b> {selectedQuestion.authorHandle}</div><p className="help-thread-body">{selectedQuestion.body}</p>
        <div className="help-answers-header"><h4>Respostas</h4><span>{answers.length}</span></div>
        <div className="help-answer-list">
          {answersLoading && <div className="reply-state">Carregando respostas...</div>}
          {!answersLoading && answers.length === 0 && <div className="reply-state">Ainda não tem resposta. Você pode ser quem destrava essa dúvida.</div>}
          {answers.map(answer => <article className={"help-answer-card " + (answer.is_accepted ? "accepted" : "")} key={answer.id}><div className="help-answer-author"><span className="help-author-avatar">{answer.authorInitials}</span><span><b>{answer.authorName}</b><small>{answer.authorHandle} · {ago(answer.created_at)}</small></span>{answer.is_accepted && <span className="help-solved-badge">✓ Solução</span>}</div><p>{answer.body}</p>{selectedQuestion.author_id === user.id && <button className={answer.is_accepted ? "help-unaccept-button" : "help-accept-button"} disabled={Boolean(voteBusy)} onClick={() => acceptAnswer(answer)}>{voteBusy === answer.id ? "Salvando..." : answer.is_accepted ? "Desmarcar solução" : "Marcar como solução"}</button>}</article>)}
        </div>
        <form className="help-answer-form" onSubmit={submitAnswer}><label htmlFor="help-answer-draft">Sua contribuição</label><textarea id="help-answer-draft" value={answerDraft} onChange={event => setAnswerDraft(event.target.value)} minLength={2} maxLength={3000} rows={4} placeholder="Explique o caminho, compartilhe um exemplo e ajude a pessoa a entender o motivo..." required /><div className="help-answer-form-footer"><span>{answerDraft.length}/3000</span><button className="primary-button" type="submit" disabled={postingAnswer}>{postingAnswer ? "Enviando..." : "Enviar resposta"} ↗</button></div></form>
      </section>
    </div>}
  </section>;
}
