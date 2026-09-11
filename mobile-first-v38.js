/* Champion Team V38 - camada mobile-first sem alterar as regras legadas */
(() => {
  "use strict";

  const cfg = window.CHAMPION_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;

  document.body.classList.add("v38-mobile-ui");
  window.CHAMPION_APP_VERSION = "38.3";
  const versionBadge = document.getElementById("appVersionBadge");
  if (versionBadge) versionBadge.textContent = "V38.3";

  const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "champion-team-v27-auth"
    }
  });

  let currentProfile = null;
  let currentAcademyId = null;
  let notificationChannel = null;
  let rawNotifications = [];
  let toastTimer = null;

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  function toast(message, type = "success") {
    let box = document.getElementById("v38Toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "v38Toast";
      box.className = "v38-toast";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.className = `v38-toast ${type}`;
    box.innerHTML = `<span>${type === "error" ? "!" : "✓"}</span>${escapeHtml(message)}`;
    requestAnimationFrame(() => box.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 3200);
  }

  function iconFor(type) {
    const value = String(type || "").toLowerCase();
    if (value.includes("mensal")) return "💳";
    if (value.includes("promo")) return "🎁";
    if (value.includes("treino")) return "🥋";
    return "💬";
  }

  function relativeTime(value) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `há ${days} dia${days > 1 ? "s" : ""}` : new Date(value).toLocaleDateString("pt-BR");
  }

  function roleMode() {
    if (currentProfile?.role === "student") return "student";
    if (currentProfile?.role === "teacher") return "teacher";
    if (["owner", "master_admin"].includes(currentProfile?.role)) return "admin";
    const legacy = document.body.dataset.role;
    return legacy === "aluno" ? "student" : legacy === "professor" ? "teacher" : legacy === "gestor" ? "admin" : "";
  }

  async function loadIdentity() {
    const { data: { user } } = await client.auth.getUser();
    if (!user) return false;
    const { data: profile, error } = await client.from("profiles").select("id,role,academy_id,full_name,active").eq("id", user.id).single();
    if (error || !profile?.active) return false;
    currentProfile = profile;
    currentAcademyId = profile.academy_id;
    if (!currentAcademyId) {
      const { data: academy } = await client.from("academies").select("id").eq("slug", cfg.academySlug).single();
      currentAcademyId = academy?.id || null;
    }
    return Boolean(currentAcademyId);
  }

  function emptyState(text = "Você não tem novas notificações.") {
    return `<div class="v38-empty"><span>✓</span><strong>Tudo em dia!</strong><p>${escapeHtml(text)}</p></div>`;
  }

  function recipientCard(item) {
    return `<article class="v38-notification-card ${item.priority === "high" ? "v38-high" : ""}" data-v38-read="${item.id}" tabindex="0" role="button" aria-label="Marcar ${escapeHtml(item.title)} como lida">
      <div class="v38-notification-icon">${iconFor(item.type)}</div>
      <div class="v38-notification-body"><span class="v38-notification-kind">${escapeHtml(item.type || "Geral")}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${relativeTime(item.created_at)} · toque para dispensar</small></div>
      <span class="v38-unread-dot"></span>
    </article>`;
  }

  function groupNotifications(items) {
    const groups = new Map();
    items.forEach((item) => {
      const key = item.batch_id || item.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.values()].sort((a, b) => new Date(b[0].created_at) - new Date(a[0].created_at));
  }

  function audienceLabel(value) {
    return value === "students" ? "Todos os alunos" : value === "teachers" ? "Todos os professores" : value === "individual" ? "Envio individual" : "Histórico legado";
  }

  function renderNotifications() {
    const mode = roleMode();
    const unread = rawNotifications.filter((item) => !item.read_at);
    const badgeCount = unread.length;
    [document.getElementById("menuNotificationBadge"), document.getElementById("topNotificationBadge")].forEach((badge) => {
      if (!badge) return;
      badge.textContent = String(badgeCount);
      badge.classList.toggle("show", badgeCount > 0);
    });
    const metric = document.getElementById("totalNotificacoesNaoLidas");
    if (metric) metric.textContent = String(badgeCount);

    if (mode === "student") {
      const list = document.getElementById("studentNotificationsList");
      if (list) list.innerHTML = unread.length ? unread.map(recipientCard).join("") : emptyState();
      const summary = document.getElementById("studentUnreadNotifications");
      if (summary) summary.textContent = String(badgeCount);
      return;
    }

    const list = document.getElementById("listaNotificacoes");
    if (!list) return;
    if (mode === "teacher") {
      const compose = document.getElementById("formNotificacao")?.closest(".panel");
      if (compose) compose.style.display = "none";
      list.innerHTML = unread.length ? unread.map(recipientCard).join("") : emptyState();
      return;
    }

    const groups = groupNotifications(rawNotifications);
    list.innerHTML = groups.length ? groups.map((group) => {
      const item = group[0];
      const read = group.filter((entry) => entry.read_at).length;
      const percent = group.length ? Math.round(read / group.length * 100) : 0;
      return `<article class="v38-notification-card" style="grid-template-columns:46px minmax(0,1fr)"><div class="v38-notification-icon">${iconFor(item.type)}</div><div class="v38-notification-body"><span class="v38-notification-kind">${escapeHtml(item.type || "Geral")}</span>${item.priority === "high" ? '<span class="v38-priority">ALTA</span>' : ""}<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${audienceLabel(item.audience)} · ${relativeTime(item.created_at)}</small><div class="v38-delivery"><span style="width:${percent}%"></span></div><small>${group.length} entregue(s) · ${read} lida(s)</small></div></article>`;
    }).join("") : emptyState("Os envios aparecerão aqui.");
  }

  async function refreshNotifications() {
    if (!currentProfile && !(await loadIdentity())) return;
    let query = client.from("notifications").select("*").order("created_at", { ascending: false }).limit(300);
    if (roleMode() !== "admin") query = query.eq("recipient_profile_id", currentProfile.id);
    else query = query.eq("academy_id", currentAcademyId);
    const { data, error } = await query;
    if (error) { console.error("V38 notifications", error); return; }
    rawNotifications = data || [];
    if (roleMode() === "student") {
      const allowed = new Set(["mensalidade", "promocao", "promoção", "geral"]);
      rawNotifications = rawNotifications.filter(item => allowed.has(String(item.type || "").toLowerCase()));
    }
    renderNotifications();
  }

  async function markRead(id, card) {
    if (!id || card?.classList.contains("is-leaving")) return;
    card?.classList.add("is-leaving");
    const { error } = await client.rpc("mark_champion_notification_read", { p_notification_id: id });
    if (error) {
      card?.classList.remove("is-leaving");
      toast("Não foi possível marcar como lida.", "error");
      return;
    }
    setTimeout(refreshNotifications, 190);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-v38-read]");
    if (card) markRead(card.dataset.v38Read, card);
  });
  document.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-v38-read]");
    if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); markRead(card.dataset.v38Read, card); }
  });

  function openStudentNotifications() {
    const areaButton = document.querySelector('.menu button[data-view="areaAluno"]');
    const section = document.getElementById("studentNotificationsSection");
    areaButton?.click();
    document.getElementById("appSidebar")?.classList.remove("mobile-open");
    document.getElementById("mobileMenuBackdrop")?.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
    const menuButton = document.getElementById("mobileMenuButton");
    menuButton?.classList.remove("active");
    menuButton?.setAttribute("aria-expanded", "false");
    window.setTimeout(() => {
      if (!section) return;
      const offset = window.innerWidth <= 860 ? 76 : 18;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      section.classList.remove("student-section-pulse");
      void section.offsetWidth;
      section.classList.add("student-section-pulse");
      window.setTimeout(() => section.classList.remove("student-section-pulse"), 900);
    }, 80);
  }

  document.addEventListener("click", (event) => {
    if (roleMode() !== "student") return;
    const trigger = event.target.closest("#topNotificationButton,#mobileNotificationButton,.menu button[data-view='notificacoes']");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openStudentNotifications();
  }, true);

  async function prepareRecipients() {
    const select = document.getElementById("notificacaoAluno");
    if (!select || roleMode() !== "admin") return;
    const [students, teachers] = await Promise.all([
      client.from("students").select("profile_id,full_name,status").eq("academy_id", currentAcademyId).eq("status", "active"),
      client.from("teachers").select("profile_id,full_name,active").eq("academy_id", currentAcademyId).eq("active", true)
    ]);
    select.innerHTML = '<option value="">Escolha uma pessoa</option>' +
      (students.data || []).filter(x => x.profile_id).map(x => `<option value="${x.profile_id}" data-kind="student">👤 ${escapeHtml(x.full_name)} — Aluno</option>`).join("") +
      (teachers.data || []).filter(x => x.profile_id).map(x => `<option value="${x.profile_id}" data-kind="teacher">🥋 ${escapeHtml(x.full_name)} — Professor</option>`).join("");
  }

  async function generatePaymentAlerts() {
    const button = document.getElementById("gerarAlertasMensalidade");
    if (button) { button.disabled = true; button.textContent = "GERANDO..."; }
    try {
      const [{ data: memberships, error: membershipError }, { data: students, error: studentError }] = await Promise.all([
        client.from("memberships").select("student_id,next_due_date,status").eq("academy_id", currentAcademyId).eq("status", "active"),
        client.from("students").select("id,profile_id").eq("academy_id", currentAcademyId).eq("status", "active")
      ]);
      if (membershipError || studentError) throw membershipError || studentError;
      const profiles = new Map((students || []).map(item => [item.id, item.profile_id]));
      let delivered = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (const membership of memberships || []) {
        if (!membership.next_due_date || !profiles.get(membership.student_id)) continue;
        const due = new Date(`${membership.next_due_date}T00:00:00`);
        const days = Math.ceil((due - today) / 86400000);
        if (days > 7) continue;
        const overdue = days < 0;
        const { error } = await client.rpc("send_champion_notification", {
          p_academy_id: currentAcademyId, p_audience: "individual",
          p_recipient_profile_id: profiles.get(membership.student_id), p_type: "mensalidade",
          p_title: overdue ? "Mensalidade vencida" : "Mensalidade próxima",
          p_message: overdue ? `Sua mensalidade venceu em ${due.toLocaleDateString("pt-BR")}.` : `Sua mensalidade vence em ${due.toLocaleDateString("pt-BR")}.`,
          p_priority: overdue ? "high" : "normal"
        });
        if (!error) delivered += 1;
      }
      await refreshNotifications();
      toast(delivered ? `${delivered} alerta(s) de mensalidade enviado(s)!` : "Nenhum alerta necessário agora.");
    } catch (error) { toast(error.message || "Falha ao gerar alertas.", "error"); }
    finally { if (button) { button.disabled = false; button.textContent = "GERAR ALERTAS DE MENSALIDADE"; } }
  }

  function configureNotificationForm() {
    const form = document.getElementById("formNotificacao");
    const audience = document.getElementById("notificacaoPublico");
    const recipient = document.getElementById("notificacaoAluno");
    const type = document.getElementById("notificacaoTipo");
    if (!form || !audience || !recipient || !type || form.dataset.v38Ready) return;
    form.dataset.v38Ready = "true";
    audience.innerHTML = '<option value="students">Todos os alunos</option><option value="teachers">Todos os professores</option><option value="individual">Pessoa específica</option>';
    const field = recipient.closest(".field");
    const update = () => {
      const kind = recipient.selectedOptions[0]?.dataset.kind;
      const studentTarget = audience.value === "students" || (audience.value === "individual" && kind === "student");
      if (field) field.style.display = audience.value === "individual" ? "block" : "none";
      type.innerHTML = studentTarget ? "<option>Geral</option><option>Promoção</option><option>Mensalidade</option>" : "<option>Geral</option><option>Promoção</option><option>Treino</option>";
    };
    audience.addEventListener("change", update);
    recipient.addEventListener("change", update);
    update();

    form.addEventListener("submit", async (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (audience.value === "individual" && !recipient.value) return toast("Escolha uma pessoa para receber.", "error");
      const button = event.submitter || form.querySelector('button[type="submit"],button:not([type])');
      if (button) { button.disabled = true; button.textContent = "ENVIANDO..."; }
      const args = {
        p_academy_id: currentAcademyId,
        p_audience: audience.value,
        p_recipient_profile_id: audience.value === "individual" ? recipient.value : null,
        p_type: type.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        p_title: document.getElementById("notificacaoTitulo")?.value.trim() || "",
        p_message: document.getElementById("notificacaoMensagem")?.value.trim() || "",
        p_priority: document.getElementById("notificacaoPrioridade")?.value === "Alta" ? "high" : "normal"
      };
      const { data, error } = await client.rpc("send_champion_notification", args);
      if (button) { button.disabled = false; button.textContent = "ENVIAR"; }
      if (error) return toast(error.message || "Falha no envio.", "error");
      form.reset(); update(); await refreshNotifications();
      toast(`Enviado para ${data?.[0]?.delivered_count || 0} destinatário(s)!`);
    }, true);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#gerarAlertasMensalidade")) {
      event.preventDefault(); event.stopImmediatePropagation(); generatePaymentAlerts();
    }
  }, true);

  function navItems() {
    const mode = roleMode();
    if (mode === "student") return [
      ["⌂", "Início", "studentProfileSection"], ["💳", "Mensalidade", "studentPaymentSection"],
      ["🛍️", "Loja", "studentStoreSection"], ["🔔", "Avisos", "studentNotificationsSection"]
    ];
    if (mode === "teacher") return [["🥋", "Treinos", "treinos"], ["🔔", "Avisos", "notificacoes"], ["☰", "Menu", "more"], ["↗", "Sair", "logout"]];
    return [["⌂", "Início", "dashboard"], ["👥", "Alunos", "alunos"], ["🛍️", "Loja", "loja"], ["☰", "Menu", "more"]];
  }

  function renderBottomNav() {
    document.getElementById("v38BottomNav")?.remove();
  }

  async function setup() {
    const ready = await loadIdentity().catch(() => false);
    renderBottomNav();
    if (!ready) return;
    configureNotificationForm();
    await prepareRecipients();
    await refreshNotifications();
    if (typeof window.renderizarNotificacoes === "function") window.renderizarNotificacoes = renderNotifications;
    if (typeof window.renderizarNotificacoesAreaAluno === "function") window.renderizarNotificacoesAreaAluno = renderNotifications;
    if (notificationChannel) client.removeChannel(notificationChannel);
    notificationChannel = client.channel(`v38-notifications-${currentProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => refreshNotifications())
      .subscribe();
  }

  const roleObserver = new MutationObserver(() => { renderBottomNav(); setup(); });
  roleObserver.observe(document.body, { attributes: true, attributeFilter: ["data-role"] });
  window.addEventListener("champion-auth-restored", setup);
  document.addEventListener("champion-login-success", setup);
  setTimeout(setup, 350);
  setTimeout(setup, 1800);
})();
