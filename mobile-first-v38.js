/* Champion Team V38 - camada mobile-first sem alterar as regras legadas */
(() => {
  "use strict";

  const cfg = window.CHAMPION_SUPABASE_CONFIG;
  if (!cfg || !window.supabase) return;

  document.body.classList.add("v38-mobile-ui");
  window.CHAMPION_APP_VERSION = "39.0";
  const versionBadge = document.getElementById("appVersionBadge");
  if (versionBadge) versionBadge.textContent = "V39.0";

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
  let counterProducts = [];
  let counterStudents = [];
  let counterCart = [];
  let toastTimer = null;
  let moneyObserver = null;
  let moneyScanTimer = null;
  let valuesUnlocked = false;
  const VALUES_PASSWORD_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";
  document.body.classList.toggle("v38-values-unlocked", valuesUnlocked);
  document.body.classList.toggle("v38-values-locked", !valuesUnlocked);

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function hashValue(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function updateValuesButton() {
    const button = document.getElementById("v38ValuesToggle");
    if (!button) return;
    button.innerHTML = valuesUnlocked ? '<span>◉</span> OCULTAR VALORES' : '<span>◌</span> MOSTRAR VALORES';
    button.setAttribute("aria-pressed", String(valuesUnlocked));
  }

  function scanMoneyValues(root = document.body) {
    if (!root?.querySelectorAll) return;
    [root, ...root.querySelectorAll("*")].forEach(element => {
      if (!(element instanceof HTMLElement) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return;
      if (element.tagName === "OPTION") {
        if (!element.dataset.v38MoneyOriginal && /R\$\s*[\d.]+(?:,\d{2})?/i.test(element.textContent || "")) element.dataset.v38MoneyOriginal = element.textContent;
        if (element.dataset.v38MoneyOriginal) { const target = valuesUnlocked ? element.dataset.v38MoneyOriginal : element.dataset.v38MoneyOriginal.replace(/R\$\s*[\d.]+(?:,\d{2})?/gi, "R$ •••••"); if (element.textContent !== target) element.textContent = target; }
        return;
      }
      if (element.childElementCount === 0 && /R\$\s*[\d.]+(?:,\d{2})?/i.test(element.textContent || "")) element.classList.add("v38-money-private");
    });
  }

  function setValuesUnlocked(unlocked) {
    valuesUnlocked = unlocked;
    document.body.classList.toggle("v38-values-unlocked", unlocked);
    document.body.classList.toggle("v38-values-locked", !unlocked);
    scanMoneyValues(); updateValuesButton();
  }

  function openValuesDialog() {
    if (valuesUnlocked) { setValuesUnlocked(false); toast("Valores financeiros ocultados."); return; }
    document.getElementById("v38ValuesDialog")?.remove();
    const modal = document.createElement("div"); modal.id = "v38ValuesDialog"; modal.className = "v38-values-backdrop";
    modal.innerHTML = `<section class="v38-values-dialog" role="dialog" aria-modal="true" aria-labelledby="v38ValuesTitle"><button type="button" class="v38-values-close" data-v38-values-close aria-label="Fechar">×</button><div class="v38-values-icon">◉</div><span>PRIVACIDADE FINANCEIRA</span><h3 id="v38ValuesTitle">Mostrar valores?</h3><p>Digite a senha de visualização para consultar preços e informações financeiras.</p><form id="v38ValuesForm"><label for="v38ValuesPassword">Senha de acesso</label><div class="v38-values-password"><input id="v38ValuesPassword" type="password" inputmode="numeric" autocomplete="off" maxlength="12" required><button type="button" id="v38ValuesPasswordToggle">MOSTRAR</button></div><small id="v38ValuesError" role="alert"></small><button type="submit">LIBERAR VISUALIZAÇÃO</button></form></section>`;
    document.body.appendChild(modal);
    const close = () => { modal.classList.remove("is-open"); setTimeout(() => modal.remove(), 180); };
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-v38-values-close]") || event.target === modal) close();
      if (event.target.closest("#v38ValuesPasswordToggle")) { const input = modal.querySelector("#v38ValuesPassword"); const show = input.type === "password"; input.type = show ? "text" : "password"; event.target.textContent = show ? "OCULTAR" : "MOSTRAR"; }
    });
    modal.querySelector("#v38ValuesForm").addEventListener("submit", async event => {
      event.preventDefault(); const input = modal.querySelector("#v38ValuesPassword"); const error = modal.querySelector("#v38ValuesError"); const submit = event.submitter;
      submit.disabled = true; submit.textContent = "VERIFICANDO...";
      const valid = await hashValue(input.value) === VALUES_PASSWORD_HASH;
      if (!valid) { submit.disabled = false; submit.textContent = "LIBERAR VISUALIZAÇÃO"; error.textContent = "Senha incorreta. Tente novamente."; input.select(); return; }
      setValuesUnlocked(true); close(); toast("Valores financeiros liberados.");
    });
    requestAnimationFrame(() => { modal.classList.add("is-open"); modal.querySelector("#v38ValuesPassword")?.focus(); });
  }

  function setupMoneyPrivacy() {
    if (!document.getElementById("v38ValuesToggle")) {
      const button = document.createElement("button"); button.id = "v38ValuesToggle"; button.className = "v38-values-toggle"; button.type = "button"; button.addEventListener("click", openValuesDialog);
      const actions = document.querySelector(".topbar-actions") || document.querySelector(".topbar"); actions?.prepend(button); updateValuesButton();
    }
    scanMoneyValues();
    if (!moneyObserver) {
      moneyObserver = new MutationObserver(() => { clearTimeout(moneyScanTimer); moneyScanTimer = setTimeout(() => scanMoneyValues(), 30); });
      moneyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

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

  function confirmDeleteNotification() {
    return new Promise((resolve) => {
      document.getElementById("v38ConfirmDialog")?.remove();
      const dialog = document.createElement("div");
      dialog.id = "v38ConfirmDialog";
      dialog.className = "v38-confirm-backdrop";
      dialog.innerHTML = `<section class="v38-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="v38ConfirmTitle" aria-describedby="v38ConfirmText">
        <button class="v38-confirm-close" type="button" data-v38-confirm="cancel" aria-label="Fechar">×</button>
        <div class="v38-confirm-icon" aria-hidden="true">🗑️</div>
        <span class="v38-confirm-kicker">CONFIRMAR EXCLUSÃO</span>
        <h3 id="v38ConfirmTitle">Excluir notificação agora?</h3>
        <p id="v38ConfirmText">Ela será removida imediatamente para todos os destinatários e não poderá ser recuperada.</p>
        <div class="v38-confirm-actions">
          <button class="v38-confirm-keep" type="button" data-v38-confirm="cancel">MANTER NOTIFICAÇÃO</button>
          <button class="v38-confirm-delete" type="button" data-v38-confirm="delete">EXCLUIR AGORA</button>
        </div>
      </section>`;
      document.body.appendChild(dialog);
      const finish = (answer) => {
        document.removeEventListener("keydown", onKeydown);
        dialog.classList.add("is-closing");
        window.setTimeout(() => dialog.remove(), 170);
        resolve(answer);
      };
      const onKeydown = (event) => { if (event.key === "Escape") finish(false); };
      document.addEventListener("keydown", onKeydown);
      dialog.addEventListener("click", (event) => {
        const action = event.target.closest("[data-v38-confirm]")?.dataset.v38Confirm;
        if (action) finish(action === "delete");
        else if (event.target === dialog) finish(false);
      });
      requestAnimationFrame(() => {
        dialog.classList.add("is-open");
        dialog.querySelector(".v38-confirm-keep")?.focus();
      });
    });
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
      <div class="v38-notification-body"><span class="v38-notification-kind">${escapeHtml(item.type || "Geral")}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${relativeTime(item.created_at)} · expira em 24h</small><button class="v38-delete-notification" type="button" data-v38-delete-id="${item.id}" aria-label="Excluir esta notificação agora">EXCLUIR AGORA</button></div>
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
      return `<article class="v38-notification-card" style="grid-template-columns:46px minmax(0,1fr)"><div class="v38-notification-icon">${iconFor(item.type)}</div><div class="v38-notification-body"><span class="v38-notification-kind">${escapeHtml(item.type || "Geral")}</span>${item.priority === "high" ? '<span class="v38-priority">ALTA</span>' : ""}<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${audienceLabel(item.audience)} · ${relativeTime(item.created_at)} · expira em 24h</small><div class="v38-delivery"><span style="width:${percent}%"></span></div><small>${group.length} entregue(s) · ${read} lida(s)</small><button class="v38-delete-notification" type="button" data-v38-delete-batch="${item.batch_id || item.id}" aria-label="Excluir este envio agora">EXCLUIR AGORA</button></div></article>`;
    }).join("") : emptyState("Os envios aparecerão aqui.");
  }

  async function refreshNotifications() {
    if (!currentProfile && !(await loadIdentity())) return;
    let query = client.from("notifications").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(300);
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

  async function deleteNotification(id, batchId, button) {
    if (!id && !batchId) return;
    if (roleMode() === "admin" && !(await confirmDeleteNotification())) return;
    if (button) { button.disabled = true; button.textContent = "EXCLUINDO..."; }
    const { data, error } = await client.rpc("delete_champion_notification", {
      p_notification_id: id || null,
      p_batch_id: batchId || null
    });
    if (error) {
      if (button) { button.disabled = false; button.textContent = "EXCLUIR AGORA"; }
      toast(error.message || "Não foi possível excluir a notificação.", "error");
      return;
    }
    await refreshNotifications();
    toast(`${Number(data) || 1} notificação(ões) excluída(s).`);
  }

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-v38-delete-id],[data-v38-delete-batch]");
    if (deleteButton) {
      event.preventDefault(); event.stopPropagation();
      deleteNotification(deleteButton.dataset.v38DeleteId, deleteButton.dataset.v38DeleteBatch, deleteButton);
      return;
    }
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

  function ensureBusinessDashboard() {
    const dashboard = document.getElementById("dashboard");
    const hero = dashboard?.querySelector(".hero");
    if (!dashboard || !hero || document.getElementById("v38BusinessDashboard")) return;
    const section = document.createElement("section");
    section.id = "v38BusinessDashboard";
    section.className = "v38-business-dashboard";
    section.innerHTML = `<div class="v38-business-head"><div><span>VISÃO DO NEGÓCIO</span><h3>Saúde financeira da academia</h3><p>Receitas, mensalidades, loja e estoque em uma visão executiva.</p></div><button type="button" id="v38RefreshBusiness">ATUALIZAR DADOS</button></div>
      <div class="v38-business-metrics">
        <article class="primary"><span>FATURAMENTO TOTAL</span><strong id="v38RevenueTotal">R$ 0,00</strong><small>Mensalidades + loja</small></article>
        <article><span>FATURAMENTO DO MÊS</span><strong id="v38RevenueMonth">R$ 0,00</strong><small>Recebido no mês atual</small></article>
        <article><span>MENSALIDADES RECEBIDAS</span><strong id="v38MembershipRevenue">R$ 0,00</strong><small>Histórico confirmado</small></article>
        <article><span>FATURAMENTO DA LOJA</span><strong id="v38StoreRevenue">R$ 0,00</strong><small id="v38StoreSales">0 vendas confirmadas</small></article>
        <article class="warning"><span>VALORES A RECEBER</span><strong id="v38Receivables">R$ 0,00</strong><small id="v38OverdueSummary">Sem atrasos</small></article>
        <article><span>TICKET MÉDIO DA LOJA</span><strong id="v38AverageTicket">R$ 0,00</strong><small>Valor médio por venda</small></article>
      </div>
      <div class="v38-business-bottom"><div><div class="v38-section-title"><strong>Origem do faturamento da loja</strong><small>Online e atendimento no balcão</small></div><div class="v38-revenue-split"><div><span>ONLINE</span><strong id="v38OnlineRevenue">R$ 0,00</strong></div><div><span>BALCÃO</span><strong id="v38CounterRevenue">R$ 0,00</strong></div></div></div><div class="v38-quick-actions"><button type="button" data-v38-go="loja">🛒 NOVA VENDA</button><button type="button" data-v38-go="billingCrm">💳 VER COBRANÇAS</button><button type="button" data-v38-go="alunos">👥 GERENCIAR ALUNOS</button></div></div>`;
    hero.insertAdjacentElement("afterend", section);
  }

  function ensureStoreBusinessTools() {
    const store = document.getElementById("loja");
    const hero = store?.querySelector(".module-hero");
    if (!store || !hero || document.getElementById("v38StoreBusinessBar")) return;
    const bar = document.createElement("section");
    bar.id = "v38StoreBusinessBar";
    bar.className = "v38-store-business-bar";
    bar.innerHTML = `<div><span>VALOR DE VENDA DO ESTOQUE</span><strong id="v38InventoryValue">R$ 0,00</strong><small id="v38InventoryUnits">0 unidades disponíveis</small></div><div><span>FATURAMENTO DA LOJA</span><strong id="v38StoreRevenueShop">R$ 0,00</strong><small>Vendas confirmadas</small></div><button type="button" id="v38OpenCounterSale">＋ VENDER NO BALCÃO</button>`;
    hero.insertAdjacentElement("afterend", bar);
  }

  async function loadBusinessMetrics() {
    if (roleMode() !== "admin" || !currentAcademyId) return;
    const button = document.getElementById("v38RefreshBusiness");
    if (button) { button.disabled = true; button.textContent = "ATUALIZANDO..."; }
    const { data, error } = await client.rpc("get_champion_business_dashboard", { p_academy_id: currentAcademyId });
    if (button) { button.disabled = false; button.textContent = "ATUALIZAR DADOS"; }
    if (error) return toast("Não foi possível carregar os indicadores.", "error");
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set("v38RevenueTotal", money(data.total_revenue)); set("v38RevenueMonth", money(data.month_revenue));
    set("v38MembershipRevenue", money(data.membership_revenue)); set("v38StoreRevenue", money(data.store_revenue));
    set("v38StoreRevenueShop", money(data.store_revenue)); set("v38Receivables", money(data.receivables));
    set("v38AverageTicket", money(data.average_ticket)); set("v38OnlineRevenue", money(data.online_revenue));
    set("v38CounterRevenue", money(data.counter_revenue)); set("v38InventoryValue", money(data.inventory_value));
    set("v38InventoryUnits", `${Number(data.inventory_units || 0)} unidades disponíveis`);
    set("v38StoreSales", `${Number(data.store_sales_count || 0)} vendas confirmadas`);
    set("v38OverdueSummary", Number(data.overdue_count || 0) ? `${data.overdue_count} mensalidade(s) em atraso · ${money(data.overdue_amount)}` : "Sem mensalidades em atraso");
  }

  function counterPrice(product) { return Number(product.promotional_price || 0) > 0 ? Number(product.promotional_price) : Number(product.price || 0); }
  function renderCounterCart() {
    const list = document.getElementById("v38CounterCart");
    const total = counterCart.reduce((sum, item) => sum + counterPrice(counterProducts.find(p => p.id === item.product_id)) * item.quantity, 0);
    if (list) list.innerHTML = counterCart.length ? counterCart.map(item => { const product = counterProducts.find(p => p.id === item.product_id); return `<div class="v38-counter-item"><div><strong>${escapeHtml(product?.name || "Produto")}</strong><small>${item.quantity} × ${money(counterPrice(product))}</small></div><button type="button" data-v38-remove-counter="${item.product_id}" aria-label="Remover produto">×</button></div>`; }).join("") : `<div class="v38-counter-empty">Adicione os produtos desta venda.</div>`;
    const output = document.getElementById("v38CounterTotal"); if (output) output.textContent = money(total);
  }

  async function openCounterSale() {
    const [products, students] = await Promise.all([
      client.from("products").select("id,name,price,promotional_price,stock,active").eq("academy_id", currentAcademyId).eq("active", true).gt("stock", 0).order("name"),
      client.from("students").select("id,full_name,cpf,status").eq("academy_id", currentAcademyId).eq("status", "active").order("full_name")
    ]);
    if (products.error || students.error) return toast("Não foi possível abrir a venda presencial.", "error");
    counterProducts = products.data || []; counterStudents = students.data || []; counterCart = [];
    document.getElementById("v38CounterSaleModal")?.remove();
    const modal = document.createElement("div"); modal.id = "v38CounterSaleModal"; modal.className = "v38-counter-backdrop";
    modal.innerHTML = `<section class="v38-counter-modal" role="dialog" aria-modal="true" aria-labelledby="v38CounterTitle"><header><div><span>VENDA PRESENCIAL</span><h3 id="v38CounterTitle">Venda no balcão</h3><p>Registre o pagamento e baixe o estoque na mesma hora.</p></div><button type="button" data-v38-close-counter aria-label="Fechar">×</button></header><div class="v38-counter-grid"><div class="v38-counter-fields"><label>Aluno cadastrado <select id="v38CounterStudent"><option value="">Cliente avulso</option>${counterStudents.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)}${s.cpf ? ` · ${escapeHtml(s.cpf)}` : ""}</option>`).join("")}</select></label><div class="v38-counter-two"><label>Nome do cliente <input id="v38CounterName" placeholder="Obrigatório para cliente avulso"></label><label>Telefone <input id="v38CounterPhone" inputmode="tel" placeholder="Opcional"></label></div><label>Produto <div class="v38-counter-add"><select id="v38CounterProduct"><option value="">Selecione um produto</option>${counterProducts.map(p => `<option value="${p.id}">${escapeHtml(p.name)} · ${money(counterPrice(p))} · ${p.stock} un.</option>`).join("")}</select><input id="v38CounterQty" type="number" min="1" value="1" aria-label="Quantidade"><button type="button" id="v38AddCounterItem">ADICIONAR</button></div></label><div id="v38CounterFeedback" class="v38-counter-feedback" role="status" aria-live="polite"></div><label>Forma de pagamento <select id="v38CounterPayment"><option>Dinheiro</option><option>Pix</option><option>Cartao de debito</option><option>Cartao de credito</option></select></label></div><aside><span>RESUMO DA VENDA</span><div id="v38CounterCart"></div><div class="v38-counter-total"><small>TOTAL</small><strong id="v38CounterTotal">R$ 0,00</strong></div><button type="button" id="v38FinishCounterSale">CONFIRMAR VENDA</button></aside></div></section>`;
    document.body.appendChild(modal); renderCounterCart();
    const feedback = (message, error = false) => { const box = modal.querySelector("#v38CounterFeedback"); if (!box) return; box.textContent = message; box.classList.toggle("error", error); box.classList.add("show"); };
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-v38-close-counter]") || event.target === modal) return closeCounterSale();
      if (event.target.closest("#v38AddCounterItem")) {
        const id = modal.querySelector("#v38CounterProduct")?.value;
        const qty = Number(modal.querySelector("#v38CounterQty")?.value || 0);
        const product = counterProducts.find(p => String(p.id) === String(id));
        if (!product || qty < 1) return feedback("Selecione um produto e uma quantidade válida.", true);
        const existing = counterCart.find(item => String(item.product_id) === String(id));
        const finalQty = qty + (existing?.quantity || 0);
        if (finalQty > Number(product.stock || 0)) return feedback(`Há somente ${product.stock} unidade(s) disponível(is).`, true);
        if (existing) existing.quantity = finalQty; else counterCart.push({ product_id: id, quantity: qty });
        renderCounterCart(); feedback(`${qty}x ${product.name} adicionado ao resumo.`);
        modal.querySelector("#v38CounterProduct").value = ""; modal.querySelector("#v38CounterQty").value = "1";
      }
      const remove = event.target.closest("[data-v38-remove-counter]")?.dataset.v38RemoveCounter;
      if (remove) { counterCart = counterCart.filter(item => String(item.product_id) !== String(remove)); renderCounterCart(); feedback("Produto removido da venda."); }
      const finish = event.target.closest("#v38FinishCounterSale"); if (finish) finishCounterSale(finish);
    });
    requestAnimationFrame(() => modal.classList.add("is-open"));
  }

  function closeCounterSale() { const modal = document.getElementById("v38CounterSaleModal"); if (!modal) return; modal.classList.remove("is-open"); setTimeout(() => modal.remove(), 180); }

  async function finishCounterSale(button) {
    if (!counterCart.length) return toast("Adicione pelo menos um produto.", "error");
    const studentId = document.getElementById("v38CounterStudent")?.value || null;
    const customerName = document.getElementById("v38CounterName")?.value.trim() || null;
    if (!studentId && !customerName) return toast("Informe o nome do cliente avulso.", "error");
    button.disabled = true; button.textContent = "REGISTRANDO...";
    const { data, error } = await client.rpc("create_champion_counter_sale", { p_academy_id: currentAcademyId, p_student_id: studentId, p_customer_name: customerName, p_customer_phone: document.getElementById("v38CounterPhone")?.value.trim() || null, p_payment_method: document.getElementById("v38CounterPayment")?.value, p_items: counterCart });
    if (error) { button.disabled = false; button.textContent = "CONFIRMAR VENDA"; return toast(error.message || "Falha ao registrar a venda.", "error"); }
    closeCounterSale(); toast(`Venda ${data.code} registrada: ${money(data.total)}.`); await window.supabaseRefreshCurrentUserV30?.(); await loadBusinessMetrics();
  }

  function setupBusinessExperience() {
    if (roleMode() !== "admin") return;
    ensureBusinessDashboard(); ensureStoreBusinessTools(); loadBusinessMetrics();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("#v38RefreshBusiness")) loadBusinessMetrics();
    if (event.target.closest("#v38OpenCounterSale")) openCounterSale();
    const go = event.target.closest("[data-v38-go]")?.dataset.v38Go;
    if (go) document.querySelector(`.menu button[data-view="${go}"]`)?.click();
  });

  async function setup() {
    const ready = await loadIdentity().catch(() => false);
    renderBottomNav();
    if (!ready) return;
    setupMoneyPrivacy();
    configureNotificationForm();
    setupBusinessExperience();
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
