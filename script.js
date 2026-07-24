const STORAGE_KEYS = {
      alunos: "fitcontrol_alunos",
      planos: "fitcontrol_planos",
      matriculas: "fitcontrol_matriculas",
      checkins: "fitcontrol_checkins"
    };

    let alunos = carregar(STORAGE_KEYS.alunos);
    let planos = carregar(STORAGE_KEYS.planos);
    let matriculas = carregar(STORAGE_KEYS.matriculas);
    let checkins = carregar(STORAGE_KEYS.checkins);

    function carregar(chave) {
      try {
        return JSON.parse(localStorage.getItem(chave)) || [];
      } catch {
        return [];
      }
    }

    function salvar(chave, dados) {
      const lista = Array.isArray(dados) ? dados : [];
      const agora = Date.now();

      localStorage.setItem(chave, JSON.stringify(lista));
      localStorage.setItem(`champion_sync_meta_${chave}`, String(agora));

      // LocalStorage funciona somente como cache offline.
      // O Firestore é a base compartilhada entre todos os aparelhos.
      if (typeof window.firebaseCloudSave === "function") {
        window.firebaseCloudSave(chave, lista, agora).catch((erro) => {
          console.error("Falha ao sincronizar com Firebase:", erro);
          window.atualizarStatusFirebase?.(
            "offline",
            "Alteração salva neste aparelho. Aguardando reconexão..."
          );
        });
      }
    }

    function gerarId() {
      return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString() + Math.random().toString(16).slice(2);
    }

    function normalizarCpf(valor) {
      return String(valor || "").replace(/\D/g, "");
    }

    function formatarMoeda(valor) {
      return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    function formatarData(dataIso) {
      if (!dataIso) return "-";
      return new Date(dataIso + "T00:00:00").toLocaleDateString("pt-BR");
    }

    function hojeIso() {
      const agora = new Date();
      const ano = agora.getFullYear();
      const mes = String(agora.getMonth() + 1).padStart(2, "0");
      const dia = String(agora.getDate()).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }

    function adicionarMeses(dataIso, quantidade) {
      const data = new Date(dataIso + "T00:00:00");
      data.setMonth(data.getMonth() + Number(quantidade));
      return data.toISOString().slice(0, 10);
    }

    function mostrarAlerta(mensagem, tipo = "success") {
      const alerta = document.getElementById("alert");
      alerta.textContent = mensagem;
      alerta.className = `alert ${tipo} show`;

      clearTimeout(window.alertTimer);
      window.alertTimer = setTimeout(() => {
        alerta.classList.remove("show");
      }, 3500);
    }



/* =========================================================
   PONTE FIREBASE
   Recebe dados em tempo real do Firestore e atualiza as
   variáveis já utilizadas pelo sistema, sem quebrar o modo local.
========================================================= */
const FIREBASE_STORAGE_VARIABLES = {
  fitcontrol_alunos: "alunos",
  fitcontrol_planos: "planos",
  fitcontrol_matriculas: "matriculas",
  fitcontrol_checkins: "checkins",
  fitcontrol_professores: "professores",
  fitcontrol_fichas_treino: "fichasTreino",
  fitcontrol_videos_jiujitsu: "videosTreino",
  fitcontrol_produtos_loja: "produtosLoja",
  fitcontrol_pedidos_loja: "pedidosLoja",
  fitcontrol_notificacoes: "notificacoes",
  champion_team_graduacoes: "graduacoes",
  champion_team_regras_graduacao: "regrasGraduacao",
  champion_team_historico_graduacao: "historicoGraduacoes",
  champion_team_exames_graduacao: "examesGraduacao"
};

window.CHAMPION_FIREBASE_KEYS = Object.keys(FIREBASE_STORAGE_VARIABLES);
window.CHAMPION_FIREBASE_READY = false;
let resolverFirebasePronto;

window.CHAMPION_FIREBASE_READY_PROMISE = new Promise((resolve) => {
  resolverFirebasePronto = resolve;
});

window.marcarFirebasePronto = function() {
  if (window.CHAMPION_FIREBASE_READY) return;
  window.CHAMPION_FIREBASE_READY = true;
  resolverFirebasePronto?.(true);
  window.dispatchEvent(new CustomEvent("champion-firebase-ready"));
};

window.aguardarFirebasePronto = function(timeoutMs = 20000) {
  if (window.CHAMPION_FIREBASE_READY) return Promise.resolve(true);

  return Promise.race([
    window.CHAMPION_FIREBASE_READY_PROMISE,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Tempo limite ao carregar o Firebase.")),
        timeoutMs
      );
    })
  ]);
};


window.atualizarStatusFirebase = function(tipo, mensagem) {
  const caixa = document.getElementById("firebaseStatus");
  const texto = document.getElementById("firebaseStatusText");
  if (!caixa || !texto) return;

  caixa.classList.remove(
    "firebase-connecting",
    "firebase-online",
    "firebase-offline",
    "firebase-syncing"
  );
  caixa.classList.add(`firebase-${tipo}`);
  texto.textContent = mensagem;
};

window.obterDadosLocaisFirebase = function(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || [];
  } catch (erro) {
    console.warn("Não foi possível ler a base local:", chave, erro);
    return [];
  }
};

window.aplicarDadosFirebase = function(chave, dadosRecebidos) {
  const dados = Array.isArray(dadosRecebidos) ? dadosRecebidos : [];

  // Atualiza o cache local para permitir uso mesmo sem internet.
  localStorage.setItem(chave, JSON.stringify(dados));

  // As variáveis foram declaradas com let no arquivo principal.
  // O switch permite atualizá-las dentro do mesmo escopo global.
  switch (chave) {
    case "fitcontrol_alunos":
      alunos = dados;
      break;
    case "fitcontrol_planos":
      planos = dados;
      break;
    case "fitcontrol_matriculas":
      matriculas = dados;
      break;
    case "fitcontrol_checkins":
      checkins = dados;
      break;
    case "fitcontrol_professores":
      professores = dados;
      break;
    case "fitcontrol_fichas_treino":
      fichasTreino = dados;
      break;
    case "fitcontrol_videos_jiujitsu":
      videosTreino = dados;
      break;
    case "fitcontrol_produtos_loja":
      produtosLoja = dados;
      break;
    case "fitcontrol_pedidos_loja":
      pedidosLoja = dados;
      break;
    case "fitcontrol_notificacoes":
      notificacoes = dados;
      break;
    case "champion_team_graduacoes":
      graduacoes = dados;
      break;
    case "champion_team_regras_graduacao":
      regrasGraduacao = dados;
      break;
    case "champion_team_historico_graduacao":
      historicoGraduacoes = dados;
      break;
    case "champion_team_exames_graduacao":
      examesGraduacao = dados;
      break;
    default:
      return;
  }

  // Recalcula todas as telas depois de receber alterações de outro aparelho.
  if (typeof atualizarTudo === "function") {
    atualizarTudo();
  }
};

window.addEventListener("online", () => {
  window.atualizarStatusFirebase?.("syncing", "Internet restabelecida. Sincronizando...");
  window.firebaseReconectar?.();
});

window.addEventListener("offline", () => {
  window.atualizarStatusFirebase?.(
    "offline",
    "Sem internet. O sistema continua funcionando neste aparelho."
  );
});


    const textosPaginas = {
      dashboard: ["Visão Geral", "Resumo atual da academia"],
      alunos: ["Alunos", "Cadastro e gestão dos alunos"],
      planos: ["Planos", "Planos comerciais da academia"],
      matriculas: ["Matrículas", "Vínculos entre alunos e planos"],
      checkin: ["Check-in", "Controle de entrada dos alunos"],
      graduacoes: ["Gestão de Graduações", "Faixas, graus, histórico e exames"]
    };

    document.querySelectorAll(".menu button").forEach((botao) => {
      botao.addEventListener("click", () => {
        document.querySelectorAll(".menu button").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));

        botao.classList.add("active");
        const view = botao.dataset.view;
        document.getElementById(view).classList.add("active");
        document.getElementById("pageTitle").textContent = textosPaginas[view][0];
        document.getElementById("pageSubtitle").textContent = textosPaginas[view][1];

        atualizarTudo();
      });
    });

    document.getElementById("formAluno").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = document.getElementById("alunoId").value;
      const cpf = normalizarCpf(document.getElementById("alunoCpf").value);

      if (cpf.length < 11) {
        mostrarAlerta("Informe um CPF válido com 11 números.", "error");
        return;
      }

      const duplicado = alunos.find((aluno) => aluno.cpf === cpf && aluno.id !== id);
      if (duplicado) {
        mostrarAlerta("Já existe um aluno cadastrado com este CPF.", "error");
        return;
      }

      const dados = {
        id: id || gerarId(),
        nome: document.getElementById("alunoNome").value.trim(),
        cpf,
        telefone: document.getElementById("alunoTelefone").value.trim(),
        email: document.getElementById("alunoEmail").value.trim(),
        nascimento: document.getElementById("alunoNascimento").value,
        status: document.getElementById("alunoStatus").value,
        senha: document.getElementById("alunoSenha")?.value.trim() || cpf.slice(-4)
      };

      if (id) {
        alunos = alunos.map((aluno) => aluno.id === id ? dados : aluno);
        mostrarAlerta("Aluno atualizado com sucesso.");
      } else {
        alunos.push(dados);
        mostrarAlerta("Aluno cadastrado com sucesso.");
      }

      salvar(STORAGE_KEYS.alunos, alunos);
      limparFormularioAluno();
      atualizarTudo();
    });

    function editarAluno(id) {
      const aluno = alunos.find((item) => item.id === id);
      if (!aluno) return;

      document.getElementById("alunoId").value = aluno.id;
      document.getElementById("alunoNome").value = aluno.nome;
      document.getElementById("alunoCpf").value = aluno.cpf;
      document.getElementById("alunoTelefone").value = aluno.telefone;
      document.getElementById("alunoEmail").value = aluno.email;
      document.getElementById("alunoNascimento").value = aluno.nascimento;
      document.getElementById("alunoStatus").value = aluno.status;

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function excluirAluno(id) {
      if (matriculas.some((matricula) => matricula.alunoId === id)) {
        mostrarAlerta("Remova primeiro a matrícula vinculada a este aluno.", "error");
        return;
      }

      if (!confirm("Deseja realmente excluir este aluno?")) return;

      alunos = alunos.filter((aluno) => aluno.id !== id);
      salvar(STORAGE_KEYS.alunos, alunos);
      atualizarTudo();
      mostrarAlerta("Aluno removido.");
    }

    function limparFormularioAluno() {
      document.getElementById("formAluno").reset();
      document.getElementById("alunoId").value = "";
      document.getElementById("alunoStatus").value = "Ativo";
    }

    document.getElementById("cancelarAluno").addEventListener("click", limparFormularioAluno);
    document.getElementById("buscarAluno").addEventListener("input", renderizarAlunos);
    document.getElementById("filtrarStatusAluno").addEventListener("change", renderizarAlunos);

    function renderizarAlunos() {
      const busca = document.getElementById("buscarAluno").value.toLowerCase().trim();
      const status = document.getElementById("filtrarStatusAluno").value;

      const filtrados = alunos.filter((aluno) => {
        const combinaBusca =
          aluno.nome.toLowerCase().includes(busca) ||
          aluno.cpf.includes(normalizarCpf(busca));

        const combinaStatus = !status || aluno.status === status;
        return combinaBusca && combinaStatus;
      });

      const tbody = document.getElementById("tabelaAlunos");

      if (!filtrados.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum aluno encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = filtrados.map((aluno) => `
        <tr>
          <td>${aluno.nome}</td>
          <td>${aluno.cpf}</td>
          <td>${aluno.telefone || "-"}</td>
          <td><span class="status ${aluno.status.toLowerCase()}">${aluno.status}</span></td>
          <td>
            <button class="btn btn-secondary" onclick="editarAluno('${aluno.id}')">Editar</button>
            <button class="btn btn-danger" onclick="excluirAluno('${aluno.id}')">Excluir</button>
          </td>
        </tr>
      `).join("");
    }

    document.getElementById("formPlano").addEventListener("submit", (event) => {
      event.preventDefault();

      const id = document.getElementById("planoId").value;

      const dados = {
        id: id || gerarId(),
        nome: document.getElementById("planoNome").value.trim(),
        valor: Number(document.getElementById("planoValor").value),
        duracao: Number(document.getElementById("planoDuracao").value),
        status: document.getElementById("planoStatus").value
      };

      if (id) {
        planos = planos.map((plano) => plano.id === id ? dados : plano);
        mostrarAlerta("Plano atualizado com sucesso.");
      } else {
        planos.push(dados);
        mostrarAlerta("Plano cadastrado com sucesso.");
      }

      salvar(STORAGE_KEYS.planos, planos);
      limparFormularioPlano();
      atualizarTudo();
    });

    function editarPlano(id) {
      const plano = planos.find((item) => item.id === id);
      if (!plano) return;

      document.getElementById("planoId").value = plano.id;
      document.getElementById("planoNome").value = plano.nome;
      document.getElementById("planoValor").value = plano.valor;
      document.getElementById("planoDuracao").value = plano.duracao;
      document.getElementById("planoStatus").value = plano.status;

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function excluirPlano(id) {
      if (matriculas.some((matricula) => matricula.planoId === id)) {
        mostrarAlerta("Este plano possui matrícula vinculada.", "error");
        return;
      }

      if (!confirm("Deseja realmente excluir este plano?")) return;

      planos = planos.filter((plano) => plano.id !== id);
      salvar(STORAGE_KEYS.planos, planos);
      atualizarTudo();
      mostrarAlerta("Plano removido.");
    }

    function limparFormularioPlano() {
      document.getElementById("formPlano").reset();
      document.getElementById("planoId").value = "";
      document.getElementById("planoDuracao").value = 1;
      document.getElementById("planoStatus").value = "Ativo";
    }

    document.getElementById("cancelarPlano").addEventListener("click", limparFormularioPlano);

    function renderizarPlanos() {
      const tbody = document.getElementById("tabelaPlanos");

      if (!planos.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Nenhum plano cadastrado.</td></tr>';
        return;
      }

      tbody.innerHTML = planos.map((plano) => `
        <tr>
          <td>${plano.nome}</td>
          <td>${formatarMoeda(plano.valor)}</td>
          <td>${plano.duracao} mês(es)</td>
          <td><span class="status ${plano.status.toLowerCase()}">${plano.status}</span></td>
          <td>
            <button class="btn btn-secondary" onclick="editarPlano('${plano.id}')">Editar</button>
            <button class="btn btn-danger" onclick="excluirPlano('${plano.id}')">Excluir</button>
          </td>
        </tr>
      `).join("");
    }

    document.getElementById("formMatricula").addEventListener("submit", (event) => {
      event.preventDefault();

      const alunoId = document.getElementById("matriculaAluno").value;
      const planoId = document.getElementById("matriculaPlano").value;
      const inicio = document.getElementById("matriculaInicio").value;

      const aluno = alunos.find((item) => item.id === alunoId);
      const plano = planos.find((item) => item.id === planoId);

      if (!aluno || !plano) {
        mostrarAlerta("Selecione um aluno e um plano válidos.", "error");
        return;
      }

      const existente = matriculas.find((matricula) =>
        matricula.alunoId === alunoId && matricula.status === "Ativo"
      );

      if (existente) {
        mostrarAlerta("Este aluno já possui uma matrícula ativa.", "error");
        return;
      }

      const matricula = {
        id: gerarId(),
        alunoId,
        planoId,
        inicio,
        vencimento: adicionarMeses(inicio, plano.duracao),
        pagamento: document.getElementById("matriculaPagamento").value,
        status: "Ativo"
      };

      matriculas.push(matricula);
      salvar(STORAGE_KEYS.matriculas, matriculas);

      document.getElementById("formMatricula").reset();
      document.getElementById("matriculaInicio").value = hojeIso();

      atualizarTudo();
      mostrarAlerta("Matrícula criada com sucesso.");
    });

    function cancelarMatricula(id) {
      if (!confirm("Deseja cancelar esta matrícula?")) return;

      matriculas = matriculas.map((matricula) =>
        matricula.id === id ? { ...matricula, status: "Cancelada" } : matricula
      );

      salvar(STORAGE_KEYS.matriculas, matriculas);
      atualizarTudo();
      mostrarAlerta("Matrícula cancelada.");
    }

    function atualizarStatusMatriculas() {
      const hoje = hojeIso();

      matriculas = matriculas.map((matricula) => {
        if (matricula.status === "Cancelada") return matricula;

        return {
          ...matricula,
          status: matricula.vencimento < hoje ? "Vencido" : "Ativo"
        };
      });

      salvar(STORAGE_KEYS.matriculas, matriculas);
    }

    function renderizarSelectsMatricula() {
      const selectAluno = document.getElementById("matriculaAluno");
      const selectPlano = document.getElementById("matriculaPlano");

      const alunosAtivos = alunos.filter((aluno) => aluno.status === "Ativo");
      const planosAtivos = planos.filter((plano) => plano.status === "Ativo");

      selectAluno.innerHTML =
        '<option value="">Selecione o aluno</option>' +
        alunosAtivos.map((aluno) => `<option value="${aluno.id}">${aluno.nome}</option>`).join("");

      selectPlano.innerHTML =
        '<option value="">Selecione o plano</option>' +
        planosAtivos.map((plano) => `<option value="${plano.id}">${plano.nome} - ${formatarMoeda(plano.valor)}</option>`).join("");
    }

    function renderizarMatriculas() {
      const tbody = document.getElementById("tabelaMatriculas");

      if (!matriculas.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma matrícula cadastrada.</td></tr>';
        return;
      }

      tbody.innerHTML = matriculas.map((matricula) => {
        const aluno = alunos.find((item) => item.id === matricula.alunoId);
        const plano = planos.find((item) => item.id === matricula.planoId);

        return `
          <tr>
            <td>${aluno?.nome || "Aluno removido"}</td>
            <td>${plano?.nome || "Plano removido"}</td>
            <td>${formatarData(matricula.inicio)}</td>
            <td>${formatarData(matricula.vencimento)}</td>
            <td><span class="status ${matricula.status.toLowerCase()}">${matricula.status}</span></td>
            <td>
              ${matricula.status === "Ativo"
                ? `<button class="btn btn-danger" onclick="cancelarMatricula('${matricula.id}')">Cancelar</button>`
                : "-"}
            </td>
          </tr>
        `;
      }).join("");
    }

    document.getElementById("btnCheckin").addEventListener("click", () => {
      const cpf = normalizarCpf(document.getElementById("checkinCpf").value);
      const resultado = document.getElementById("checkResult");

      const aluno = alunos.find((item) => item.cpf === cpf);

      if (!aluno) {
        exibirResultadoCheckin("Aluno não encontrado.", false);
        return;
      }

      if (aluno.status !== "Ativo") {
        exibirResultadoCheckin("Entrada bloqueada: aluno inativo.", false);
        return;
      }

      const matricula = matriculas.find((item) =>
        item.alunoId === aluno.id && item.status === "Ativo"
      );

      if (!matricula) {
        exibirResultadoCheckin("Entrada bloqueada: aluno sem matrícula ativa.", false);
        return;
      }

      const agora = new Date();
      const jaFezHoje = checkins.some((item) =>
        item.alunoId === aluno.id && item.data === hojeIso()
      );

      if (jaFezHoje) {
        exibirResultadoCheckin("Este aluno já realizou check-in hoje.", false);
        return;
      }

      checkins.unshift({
        id: gerarId(),
        alunoId: aluno.id,
        data: hojeIso(),
        horario: agora.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        })
      });

      salvar(STORAGE_KEYS.checkins, checkins);
      document.getElementById("checkinCpf").value = "";

      exibirResultadoCheckin(`Entrada liberada para ${aluno.nome}.`, true);
      atualizarTudo();
    });

    function exibirResultadoCheckin(mensagem, sucesso) {
      const resultado = document.getElementById("checkResult");
      resultado.textContent = mensagem;
      resultado.className = `check-result show ${sucesso ? "success" : "error"}`;
    }

    function renderizarCheckins() {
      const tbody = document.getElementById("tabelaCheckins");
      const ultimos = document.getElementById("ultimosCheckins");

      if (!checkins.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Nenhum check-in registrado.</td></tr>';
        ultimos.innerHTML = '<tr><td colspan="4" class="empty">Nenhum check-in registrado.</td></tr>';
        return;
      }

      tbody.innerHTML = checkins.map((checkin) => {
        const aluno = alunos.find((item) => item.id === checkin.alunoId);

        return `
          <tr>
            <td>${aluno?.nome || "Aluno não encontrado"}</td>
            <td>${aluno?.cpf || "-"}</td>
            <td>${formatarData(checkin.data)}</td>
            <td>${checkin.horario}</td>
          </tr>
        `;
      }).join("");

      ultimos.innerHTML = checkins.slice(0, 5).map((checkin) => {
        const aluno = alunos.find((item) => item.id === checkin.alunoId);

        return `
          <tr>
            <td>${aluno?.nome || "Aluno não encontrado"}</td>
            <td>${formatarData(checkin.data)}</td>
            <td>${checkin.horario}</td>
            <td><span class="status ativo">Liberado</span></td>
          </tr>
        `;
      }).join("");
    }

    function atualizarDashboard() {
      const hoje = hojeIso();
      const ativos = matriculas.filter((matricula) => matricula.status === "Ativo");

      document.getElementById("totalAlunos").textContent = alunos.length;
      document.getElementById("alunosAtivos").textContent = ativos.length;
      document.getElementById("totalPlanos").textContent = planos.length;
      document.getElementById("checkinsHoje").textContent =
        checkins.filter((checkin) => checkin.data === hoje).length;
    }

    function atualizarTudo() {
      atualizarStatusMatriculas();
      renderizarAlunos();
      renderizarPlanos();
      renderizarSelectsMatricula();
      renderizarMatriculas();
      renderizarCheckins();
      atualizarDashboard();
    }

    document.getElementById("matriculaInicio").value = hojeIso();

    if (!planos.length) {
      planos = [
        {
          id: gerarId(),
          nome: "Plano Mensal",
          valor: 99.90,
          duracao: 1,
          status: "Ativo"
        },
        {
          id: gerarId(),
          nome: "Plano Trimestral",
          valor: 269.90,
          duracao: 3,
          status: "Ativo"
        }
      ];

      salvar(STORAGE_KEYS.planos, planos);
    }

    atualizarTudo();

    window.editarAluno = editarAluno;
    window.excluirAluno = excluirAluno;
    window.editarPlano = editarPlano;
    window.excluirPlano = excluirPlano;
    window.cancelarMatricula = cancelarMatricula;


document.querySelectorAll("[data-go-view]").forEach((botao) => {
  botao.addEventListener("click", () => {
    const destino = botao.dataset.goView;
    const menuDestino = document.querySelector(`.menu button[data-view="${destino}"]`);
    if (menuDestino) menuDestino.click();
  });
});


const LOGIN_KEY = "fitcontrol_login_ativo";
function abrirSistema(){document.getElementById("loginScreen").classList.add("hidden");document.getElementById("appShell").classList.remove("app-locked");atualizarGraficosDashboard()}
function fecharSistema(){localStorage.removeItem(LOGIN_KEY);sessionStorage.removeItem(LOGIN_KEY);localStorage.removeItem("fitcontrol_tipo_usuario");localStorage.removeItem("fitcontrol_aluno_usuario_id");sessionStorage.removeItem("fitcontrol_aluno_usuario_id");sessionStorage.removeItem("fitcontrol_aluno_logado");alunoLogadoId="";document.body.classList.remove("student-mode");document.getElementById("studentDashboard")?.classList.add("hidden");document.getElementById("studentAccessScreen")?.classList.remove("hidden");document.getElementById("loginScreen").classList.remove("hidden");document.getElementById("appShell").classList.add("app-locked");document.getElementById("loginEmail").value="admin@fitcontrol.com";document.getElementById("loginSenha").value="123456";document.getElementById("loginError").textContent=""}
document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const identificador = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const lembrar = document.getElementById("lembrarLogin").checked;
  const erro = document.getElementById("loginError");
  const botao = event.submitter;

  erro.textContent = "";
  if (botao) {
    botao.disabled = true;
    botao.dataset.textoOriginal = botao.textContent;
    botao.textContent = "Carregando dados...";
  }

  try {
    if (typeof window.aguardarFirebasePronto === "function") {
      await window.aguardarFirebasePronto(20000);
    }

    const adminValido =
      identificador.toLowerCase() === "admin@fitcontrol.com" &&
      senha === "123456";

    if (adminValido) {
      localStorage.setItem("fitcontrol_tipo_usuario", "admin");
      localStorage.removeItem("fitcontrol_aluno_usuario_id");
      sessionStorage.removeItem("fitcontrol_aluno_usuario_id");

      if (lembrar) localStorage.setItem(LOGIN_KEY, "true");
      else sessionStorage.setItem(LOGIN_KEY, "true");

      abrirSistemaComoAdministrador();
      mostrarAlerta("Acesso administrativo realizado.");
      return;
    }

    const cpf = normalizarCpf(identificador);
    const aluno = alunos.find(
      (item) => normalizarCpf(item.cpf) === cpf
    );

    if (!aluno) {
      erro.textContent =
        "CPF não encontrado na base compartilhada da academia.";
      return;
    }

    if (aluno.status !== "Ativo") {
      erro.textContent =
        "Seu cadastro está inativo. Procure a recepção.";
      return;
    }

    const senhaAluno = String(
      aluno.senha || normalizarCpf(aluno.cpf).slice(-4)
    );

    if (senha !== senhaAluno) {
      erro.textContent = "Senha do aluno inválida.";
      return;
    }

    localStorage.setItem("fitcontrol_tipo_usuario", "aluno");

    if (lembrar) {
      localStorage.setItem("fitcontrol_aluno_usuario_id", aluno.id);
      localStorage.setItem(LOGIN_KEY, "true");
    } else {
      sessionStorage.setItem("fitcontrol_aluno_usuario_id", aluno.id);
      sessionStorage.setItem(LOGIN_KEY, "true");
    }

    abrirSistemaComoAluno(aluno);
    mostrarAlerta(`Bem-vindo, ${aluno.nome}.`);
  } catch (erroFirebase) {
    console.error(erroFirebase);
    erro.textContent =
      "Não foi possível carregar os dados online. Verifique a internet e tente novamente.";
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent =
        botao.dataset.textoOriginal || "Entrar";
    }
  }
});

document.getElementById("togglePassword").addEventListener("click",()=>{const input=document.getElementById("loginSenha");const botao=document.getElementById("togglePassword");const mostrando=input.type==="text";input.type=mostrando?"password":"text";botao.textContent=mostrando?"Mostrar":"Ocultar"});
document.getElementById("logoutButton").addEventListener("click",fecharSistema);
function ultimosSeteDias(){const dias=[];for(let i=6;i>=0;i--){const data=new Date();data.setDate(data.getDate()-i);const iso=[data.getFullYear(),String(data.getMonth()+1).padStart(2,"0"),String(data.getDate()).padStart(2,"0")].join("-");dias.push({iso,label:data.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")})}return dias}
function atualizarGraficoCheckins(){const container=document.getElementById("checkinChart");if(!container)return;const dados=ultimosSeteDias().map(dia=>({...dia,total:checkins.filter(item=>item.data===dia.iso).length}));const maior=Math.max(...dados.map(item=>item.total),1);container.innerHTML=dados.map(item=>{const altura=item.total===0?3:Math.max(10,item.total/maior*100);return `<div class="bar-item" title="${item.total} check-in(s)"><span class="bar-value">${item.total}</span><div class="bar-track"><div class="bar-fill" style="height:${altura}%"></div></div><span class="bar-label">${item.label}</span></div>`}).join("")}
function atualizarGraficoAlunos(){const ativos=alunos.filter(aluno=>aluno.status==="Ativo").length;const inativos=alunos.filter(aluno=>aluno.status==="Inativo").length;const total=ativos+inativos;const grausAtivos=total?ativos/total*360:0;const donut=document.getElementById("studentsDonut");if(!donut)return;donut.style.background=total?`conic-gradient(var(--primary) 0deg ${grausAtivos}deg,var(--red) ${grausAtivos}deg 360deg)`:"conic-gradient(#2a3036 0deg 360deg)";document.getElementById("donutTotal").textContent=total;document.getElementById("legendActive").textContent=ativos;document.getElementById("legendInactive").textContent=inativos}
function atualizarGraficosDashboard(){atualizarGraficoCheckins();atualizarGraficoAlunos()}
const atualizarTudoBase=atualizarTudo;atualizarTudo=function(){atualizarTudoBase();atualizarGraficosDashboard()};

function atualizarPerfilCabecalho(nome,funcao,avatar){const n=document.getElementById("currentUserName"),f=document.getElementById("currentUserRole"),a=document.getElementById("currentUserAvatar");if(n)n.textContent=nome;if(f)f.textContent=funcao;if(a)a.textContent=avatar}
function abrirSistemaComoAdministrador(){document.body.classList.remove("student-mode");atualizarPerfilCabecalho("Administrador","Gestor da academia","AD");abrirSistema();document.querySelector('.menu button[data-view="dashboard"]')?.click()}
function abrirSistemaComoAluno(aluno){document.body.classList.add("student-mode");atualizarPerfilCabecalho(aluno.nome,"Aluno da academia",obterIniciaisAluno(aluno.nome));alunoLogadoId=aluno.id;sessionStorage.setItem("fitcontrol_aluno_logado",aluno.id);document.getElementById("studentAccessScreen")?.classList.add("hidden");document.getElementById("studentDashboard")?.classList.remove("hidden");abrirSistema();document.querySelector('.menu button[data-view="areaAluno"]')?.click();renderizarAreaAluno()}
function restaurarSessaoPorPerfil(){const ativa=localStorage.getItem(LOGIN_KEY)==="true"||sessionStorage.getItem(LOGIN_KEY)==="true";if(!ativa)return;const tipo=localStorage.getItem("fitcontrol_tipo_usuario");const id=localStorage.getItem("fitcontrol_aluno_usuario_id")||sessionStorage.getItem("fitcontrol_aluno_usuario_id");if(tipo==="aluno"&&id){const aluno=alunos.find(a=>String(a.id)===String(id));if(aluno&&aluno.status==="Ativo"){abrirSistemaComoAluno(aluno);return}}abrirSistemaComoAdministrador()}

async function restaurarSessaoDepoisDoFirebase() {
  try {
    if (typeof window.aguardarFirebasePronto === "function") {
      await window.aguardarFirebasePronto(20000);
    }
  } catch (erro) {
    console.warn("Usando cache local para restaurar a sessão.", erro);
  }
  restaurarSessaoPorPerfil();
}

setTimeout(restaurarSessaoDepoisDoFirebase, 0);


// ==========================================================
// BUSCADOR INTELIGENTE DE ALUNOS NA ÁREA DE PLANOS
// ==========================================================
let alunoSelecionadoParaPlanoId = "";
let indiceSugestaoAlunoPlano = -1;

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function removerAcentos(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarPesquisaAluno(valor) {
  return removerAcentos(String(valor || "").trim().toLowerCase());
}

function formatarCpfVisual(cpf) {
  const numeros = normalizarCpf(cpf);

  if (numeros.length !== 11) {
    return cpf || "-";
  }

  return numeros.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );
}

function obterIniciaisAluno(nome) {
  const partes = String(nome || "Aluno")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!partes.length) return "AL";

  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return (
    partes[0].charAt(0) +
    partes[partes.length - 1].charAt(0)
  ).toUpperCase();
}

function localizarAlunosParaPlano(termo) {
  const texto = normalizarPesquisaAluno(termo);
  const numeros = normalizarCpf(termo);

  if (!texto && !numeros) {
    return [];
  }

  return alunos
    .map((aluno) => {
      const nomeNormalizado = normalizarPesquisaAluno(aluno.nome);
      const cpfNormalizado = normalizarCpf(aluno.cpf);

      let relevancia = 0;

      if (nomeNormalizado === texto) relevancia += 100;
      if (nomeNormalizado.startsWith(texto)) relevancia += 80;
      if (nomeNormalizado.includes(texto)) relevancia += 50;

      const palavras = nomeNormalizado.split(/\s+/);
      if (palavras.some((palavra) => palavra.startsWith(texto))) {
        relevancia += 65;
      }

      if (numeros) {
        if (cpfNormalizado === numeros) relevancia += 110;
        if (cpfNormalizado.startsWith(numeros)) relevancia += 85;
        if (cpfNormalizado.includes(numeros)) relevancia += 55;
      }

      return { aluno, relevancia };
    })
    .filter((resultado) => resultado.relevancia > 0)
    .sort((a, b) => {
      if (b.relevancia !== a.relevancia) {
        return b.relevancia - a.relevancia;
      }

      return a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR");
    })
    .slice(0, 8)
    .map((resultado) => resultado.aluno);
}

function fecharSugestoesAlunoPlano() {
  const sugestoes = document.getElementById("sugestoesAlunoPlano");

  if (!sugestoes) return;

  sugestoes.classList.remove("show");
  indiceSugestaoAlunoPlano = -1;
}

function renderizarSugestoesAlunoPlano() {
  const input = document.getElementById("buscarAlunoPlano");
  const sugestoes = document.getElementById("sugestoesAlunoPlano");
  const limpar = document.getElementById("limparBuscaAlunoPlano");

  if (!input || !sugestoes || !limpar) return;

  const termo = input.value.trim();
  limpar.classList.toggle("visible", termo.length > 0);

  if (!termo) {
    sugestoes.innerHTML = "";
    fecharSugestoesAlunoPlano();
    return;
  }

  const encontrados = localizarAlunosParaPlano(termo);

  if (!encontrados.length) {
    sugestoes.innerHTML = `
      <div class="student-no-result">
        <strong>Nenhum aluno encontrado</strong>
        Confira o nome ou CPF informado.
      </div>
    `;
    sugestoes.classList.add("show");
    return;
  }

  sugestoes.innerHTML = encontrados.map((aluno, indice) => `
    <button
      class="student-suggestion"
      type="button"
      data-aluno-plano-id="${escaparHtml(aluno.id)}"
      data-suggestion-index="${indice}"
    >
      <span class="suggestion-avatar">
        ${escaparHtml(obterIniciaisAluno(aluno.nome))}
      </span>

      <span class="suggestion-main">
        <strong>${escaparHtml(aluno.nome)}</strong>
        <small>
          CPF: ${escaparHtml(formatarCpfVisual(aluno.cpf))}
          ${aluno.telefone ? ` • ${escaparHtml(aluno.telefone)}` : ""}
        </small>
      </span>

      <span class="suggestion-status">
        ${escaparHtml(aluno.status)}
      </span>
    </button>
  `).join("");

  sugestoes.classList.add("show");

  sugestoes
    .querySelectorAll("[data-aluno-plano-id]")
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        selecionarAlunoParaPlano(botao.dataset.alunoPlanoId);
      });
    });
}

function selecionarAlunoParaPlano(alunoId) {
  const aluno = alunos.find((item) => item.id === alunoId);

  if (!aluno) {
    mostrarAlerta("O aluno selecionado não foi encontrado.", "error");
    return;
  }

  alunoSelecionadoParaPlanoId = aluno.id;

  const input = document.getElementById("buscarAlunoPlano");
  const card = document.getElementById("alunoPlanoSelecionado");
  const avatar = document.getElementById("alunoPlanoAvatar");
  const nome = document.getElementById("alunoPlanoNome");
  const detalhes = document.getElementById("alunoPlanoDetalhes");
  const status = document.getElementById("alunoPlanoStatus");
  const botaoMatricular = document.getElementById(
    "matricularAlunoSelecionado"
  );

  input.value = aluno.nome;
  avatar.textContent = obterIniciaisAluno(aluno.nome);
  nome.textContent = aluno.nome;
  detalhes.textContent =
    `CPF: ${formatarCpfVisual(aluno.cpf)}` +
    (aluno.telefone ? ` • Telefone: ${aluno.telefone}` : "");

  status.textContent = aluno.status;
  status.className = `status ${aluno.status.toLowerCase()}`;

  botaoMatricular.disabled = aluno.status !== "Ativo";
  botaoMatricular.textContent =
    aluno.status === "Ativo"
      ? "Escolher plano"
      : "Aluno inativo";

  card.classList.add("show");
  document
    .getElementById("limparBuscaAlunoPlano")
    .classList.add("visible");

  fecharSugestoesAlunoPlano();
}

function limparBuscaAlunoParaPlano() {
  alunoSelecionadoParaPlanoId = "";
  indiceSugestaoAlunoPlano = -1;

  const input = document.getElementById("buscarAlunoPlano");
  const sugestoes = document.getElementById("sugestoesAlunoPlano");
  const limpar = document.getElementById("limparBuscaAlunoPlano");
  const card = document.getElementById("alunoPlanoSelecionado");
  const botao = document.getElementById("matricularAlunoSelecionado");

  if (input) {
    input.value = "";
    input.focus();
  }

  if (sugestoes) {
    sugestoes.innerHTML = "";
    sugestoes.classList.remove("show");
  }

  if (limpar) limpar.classList.remove("visible");
  if (card) card.classList.remove("show");
  if (botao) botao.disabled = true;
}

function navegarSugestoesAlunoPlano(event) {
  const sugestoes = document.getElementById("sugestoesAlunoPlano");

  if (!sugestoes || !sugestoes.classList.contains("show")) {
    return;
  }

  const itens = [
    ...sugestoes.querySelectorAll(".student-suggestion")
  ];

  if (!itens.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    indiceSugestaoAlunoPlano =
      (indiceSugestaoAlunoPlano + 1) % itens.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    indiceSugestaoAlunoPlano =
      (indiceSugestaoAlunoPlano - 1 + itens.length) % itens.length;
  } else if (event.key === "Enter" && indiceSugestaoAlunoPlano >= 0) {
    event.preventDefault();
    itens[indiceSugestaoAlunoPlano].click();
    return;
  } else if (event.key === "Escape") {
    fecharSugestoesAlunoPlano();
    return;
  } else {
    return;
  }

  itens.forEach((item, indice) => {
    item.classList.toggle(
      "active",
      indice === indiceSugestaoAlunoPlano
    );
  });

  itens[indiceSugestaoAlunoPlano].scrollIntoView({
    block: "nearest"
  });
}

function abrirMatriculaDoAlunoSelecionado() {
  const aluno = alunos.find(
    (item) => item.id === alunoSelecionadoParaPlanoId
  );

  if (!aluno) {
    mostrarAlerta("Selecione um aluno antes de continuar.", "error");
    return;
  }

  if (aluno.status !== "Ativo") {
    mostrarAlerta(
      "Este aluno está inativo e não pode receber uma nova matrícula.",
      "error"
    );
    return;
  }

  const menuMatriculas = document.querySelector(
    '.menu button[data-view="matriculas"]'
  );

  if (menuMatriculas) {
    menuMatriculas.click();
  }

  renderizarSelectsMatricula();

  const selectAluno = document.getElementById("matriculaAluno");

  if (selectAluno) {
    selectAluno.value = aluno.id;
  }

  setTimeout(() => {
    const form = document.getElementById("formMatricula");

    if (form) {
      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, 80);

  mostrarAlerta(
    `${aluno.nome} foi selecionado. Agora escolha o plano.`
  );
}

const buscarAlunoPlanoInput =
  document.getElementById("buscarAlunoPlano");

if (buscarAlunoPlanoInput) {
  buscarAlunoPlanoInput.addEventListener(
    "input",
    renderizarSugestoesAlunoPlano
  );

  buscarAlunoPlanoInput.addEventListener(
    "keydown",
    navegarSugestoesAlunoPlano
  );

  buscarAlunoPlanoInput.addEventListener("focus", () => {
    if (buscarAlunoPlanoInput.value.trim()) {
      renderizarSugestoesAlunoPlano();
    }
  });
}

document
  .getElementById("limparBuscaAlunoPlano")
  ?.addEventListener("click", limparBuscaAlunoParaPlano);

document
  .getElementById("matricularAlunoSelecionado")
  ?.addEventListener("click", abrirMatriculaDoAlunoSelecionado);

document.addEventListener("click", (event) => {
  const busca = document.querySelector(".student-smart-search");

  if (busca && !busca.contains(event.target)) {
    fecharSugestoesAlunoPlano();
  }
});


// ==========================================================
// MÓDULO DE PROFESSORES E FICHAS DE TREINO
// ==========================================================
const PROFESSORES_STORAGE_KEY = "fitcontrol_professores";
const FICHAS_STORAGE_KEY = "fitcontrol_fichas_treino";

let professores = carregar(PROFESSORES_STORAGE_KEY);
let fichasTreino = carregar(FICHAS_STORAGE_KEY);

textosPaginas.professores = [
  "Professores",
  "Equipe técnica e profissionais da academia"
];

textosPaginas.treinos = [
  "Fichas de treino",
  "Planejamento individual de exercícios"
];

function salvarProfessores() {
  salvar(PROFESSORES_STORAGE_KEY, professores);
}

function salvarFichasTreino() {
  salvar(FICHAS_STORAGE_KEY, fichasTreino);
}

function somarDiasData(dataIso, dias) {
  const data = new Date(`${dataIso}T00:00:00`);
  data.setDate(data.getDate() + Number(dias));

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarStatusClasse(status) {
  return String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

// --------------------------
// PROFESSORES
// --------------------------
document.getElementById("formProfessor")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = document.getElementById("professorId").value;
  const cref = document.getElementById("professorCref").value.trim().toUpperCase();

  const duplicado = professores.find(
    (professor) =>
      professor.cref.toUpperCase() === cref &&
      professor.id !== id
  );

  if (duplicado) {
    mostrarAlerta("Já existe um professor cadastrado com este CREF.", "error");
    return;
  }

  const dados = {
    id: id || gerarId(),
    nome: document.getElementById("professorNome").value.trim(),
    cref,
    especialidade: document.getElementById("professorEspecialidade").value,
    status: document.getElementById("professorStatus").value,
    telefone: document.getElementById("professorTelefone").value.trim(),
    email: document.getElementById("professorEmail").value.trim(),
    turno: document.getElementById("professorTurno").value,
    admissao: document.getElementById("professorAdmissao").value
  };

  if (id) {
    professores = professores.map((professor) =>
      professor.id === id ? dados : professor
    );

    mostrarAlerta("Professor atualizado com sucesso.");
  } else {
    professores.push(dados);
    mostrarAlerta("Professor cadastrado com sucesso.");
  }

  salvarProfessores();
  limparFormularioProfessor();
  atualizarModulosTreino();
});

function limparFormularioProfessor() {
  document.getElementById("formProfessor")?.reset();
  document.getElementById("professorId").value = "";
  document.getElementById("professorStatus").value = "Ativo";
  document.getElementById("professorTurno").value = "Manhã";
}

function editarProfessor(id) {
  const professor = professores.find((item) => item.id === id);
  if (!professor) return;

  document.getElementById("professorId").value = professor.id;
  document.getElementById("professorNome").value = professor.nome;
  document.getElementById("professorCref").value = professor.cref;
  document.getElementById("professorEspecialidade").value = professor.especialidade;
  document.getElementById("professorStatus").value = professor.status;
  document.getElementById("professorTelefone").value = professor.telefone || "";
  document.getElementById("professorEmail").value = professor.email || "";
  document.getElementById("professorTurno").value = professor.turno || "Manhã";
  document.getElementById("professorAdmissao").value = professor.admissao || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function excluirProfessor(id) {
  const possuiFicha = fichasTreino.some(
    (ficha) => ficha.professorId === id
  );

  if (possuiFicha) {
    mostrarAlerta(
      "Este professor possui ficha de treino vinculada. Inative o cadastro ou altere a ficha primeiro.",
      "error"
    );
    return;
  }

  if (!confirm("Deseja realmente excluir este professor?")) return;

  professores = professores.filter((professor) => professor.id !== id);
  salvarProfessores();
  atualizarModulosTreino();
  mostrarAlerta("Professor removido.");
}

function renderizarProfessores() {
  const tbody = document.getElementById("tabelaProfessores");
  if (!tbody) return;

  const busca = normalizarPesquisaAluno(
    document.getElementById("buscarProfessor")?.value
  );

  const statusFiltro =
    document.getElementById("filtrarStatusProfessor")?.value || "";

  const filtrados = professores
    .filter((professor) => {
      const texto = normalizarPesquisaAluno(
        `${professor.nome} ${professor.cref} ${professor.especialidade}`
      );

      const combinaBusca = !busca || texto.includes(busca);
      const combinaStatus =
        !statusFiltro || professor.status === statusFiltro;

      return combinaBusca && combinaStatus;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (!filtrados.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          Nenhum professor encontrado.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtrados.map((professor) => `
      <tr>
        <td>
          <strong>${escaparHtml(professor.nome)}</strong>
          <br>
          <small>${escaparHtml(professor.email || professor.telefone || "-")}</small>
        </td>
        <td>${escaparHtml(professor.cref)}</td>
        <td>${escaparHtml(professor.especialidade)}</td>
        <td>${escaparHtml(professor.turno || "-")}</td>
        <td>
          <span class="status ${formatarStatusClasse(professor.status)}">
            ${escaparHtml(professor.status)}
          </span>
        </td>
        <td>
          <button
            class="btn btn-secondary"
            type="button"
            onclick="editarProfessor('${professor.id}')"
          >
            Editar
          </button>

          <button
            class="btn btn-danger"
            type="button"
            onclick="excluirProfessor('${professor.id}')"
          >
            Excluir
          </button>
        </td>
      </tr>
    `).join("");
  }

  const totalAtivos = professores.filter(
    (professor) => professor.status === "Ativo"
  ).length;

  const totalElemento = document.getElementById("totalProfessoresModulo");
  if (totalElemento) totalElemento.textContent = totalAtivos;
}

document
  .getElementById("cancelarProfessor")
  ?.addEventListener("click", limparFormularioProfessor);

document
  .getElementById("buscarProfessor")
  ?.addEventListener("input", renderizarProfessores);

document
  .getElementById("filtrarStatusProfessor")
  ?.addEventListener("change", renderizarProfessores);

// --------------------------
// SELECTS DA FICHA
// --------------------------
function renderizarSelectsFichaTreino() {
  const selectAluno = document.getElementById("fichaAluno");
  const selectProfessor = document.getElementById("fichaProfessor");

  if (!selectAluno || !selectProfessor) return;

  const valorAlunoAtual = selectAluno.value;
  const valorProfessorAtual = selectProfessor.value;

  selectAluno.innerHTML =
    '<option value="">Selecione o aluno</option>' +
    alunos
      .filter((aluno) => aluno.status === "Ativo")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(
        (aluno) =>
          `<option value="${aluno.id}">${escaparHtml(aluno.nome)} — ${formatarCpfVisual(aluno.cpf)}</option>`
      )
      .join("");

  selectProfessor.innerHTML =
    '<option value="">Selecione o professor</option>' +
    professores
      .filter((professor) => professor.status === "Ativo")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(
        (professor) =>
          `<option value="${professor.id}">${escaparHtml(professor.nome)} — ${escaparHtml(professor.especialidade)}</option>`
      )
      .join("");

  if ([...selectAluno.options].some((option) => option.value === valorAlunoAtual)) {
    selectAluno.value = valorAlunoAtual;
  }

  if (
    [...selectProfessor.options].some(
      (option) => option.value === valorProfessorAtual
    )
  ) {
    selectProfessor.value = valorProfessorAtual;
  }
}

// --------------------------
// EXERCÍCIOS DINÂMICOS
// --------------------------
function criarLinhaExercicio(exercicio = {}) {
  const linha = document.createElement("div");
  linha.className = "exercise-row";

  linha.innerHTML = `
    <div class="field">
      <label>Exercício</label>
      <input
        class="exercise-name"
        required
        placeholder="Ex.: Supino reto"
        value="${escaparHtml(exercicio.nome || "")}"
      />
    </div>

    <div class="field">
      <label>Grupo muscular</label>
      <select class="exercise-muscle" required>
        <option value="">Selecione</option>
        ${[
          "Peito",
          "Costas",
          "Ombros",
          "Bíceps",
          "Tríceps",
          "Pernas",
          "Glúteos",
          "Abdômen",
          "Cardiorrespiratório",
          "Corpo inteiro"
        ]
          .map(
            (grupo) =>
              `<option value="${grupo}" ${
                exercicio.grupo === grupo ? "selected" : ""
              }>${grupo}</option>`
          )
          .join("")}
      </select>
    </div>

    <div class="field">
      <label>Séries</label>
      <input
        class="exercise-sets"
        type="number"
        min="1"
        required
        value="${escaparHtml(exercicio.series || 3)}"
      />
    </div>

    <div class="field">
      <label>Repetições</label>
      <input
        class="exercise-reps"
        required
        placeholder="Ex.: 10-12"
        value="${escaparHtml(exercicio.repeticoes || "10-12")}"
      />
    </div>

    <div class="field">
      <label>Carga</label>
      <input
        class="exercise-load"
        placeholder="Ex.: 20 kg"
        value="${escaparHtml(exercicio.carga || "")}"
      />
    </div>

    <div class="field">
      <label>Descanso</label>
      <input
        class="exercise-rest"
        placeholder="Ex.: 60s"
        value="${escaparHtml(exercicio.descanso || "60s")}"
      />
    </div>

    <button
      class="remove-exercise"
      type="button"
      title="Remover exercício"
      aria-label="Remover exercício"
    >
      ×
    </button>
  `;

  linha
    .querySelector(".remove-exercise")
    .addEventListener("click", () => {
      const lista = document.getElementById("listaExercicios");

      if (lista.children.length <= 1) {
        mostrarAlerta(
          "A ficha precisa possuir pelo menos um exercício.",
          "error"
        );
        return;
      }

      linha.remove();
      numerarExercicios();
    });

  document.getElementById("listaExercicios").appendChild(linha);
  numerarExercicios();
}

function numerarExercicios() {
  document
    .querySelectorAll("#listaExercicios .exercise-row")
    .forEach((linha, indice) => {
      linha.dataset.exerciseNumber = String(indice + 1);
    });
}

function obterExerciciosFormulario() {
  return [
    ...document.querySelectorAll("#listaExercicios .exercise-row")
  ].map((linha) => ({
    nome: linha.querySelector(".exercise-name").value.trim(),
    grupo: linha.querySelector(".exercise-muscle").value,
    series: Number(linha.querySelector(".exercise-sets").value),
    repeticoes: linha.querySelector(".exercise-reps").value.trim(),
    carga: linha.querySelector(".exercise-load").value.trim(),
    descanso: linha.querySelector(".exercise-rest").value.trim()
  }));
}

document
  .getElementById("adicionarExercicio")
  ?.addEventListener("click", () => criarLinhaExercicio());

// --------------------------
// FICHA DE TREINO
// --------------------------
function atualizarStatusFichas() {
  const hoje = hojeIso();
  let alterou = false;

  fichasTreino = fichasTreino.map((ficha) => {
    if (
      ficha.status !== "Finalizada" &&
      ficha.validade &&
      ficha.validade < hoje &&
      ficha.status !== "Vencida"
    ) {
      alterou = true;
      return { ...ficha, status: "Vencida" };
    }

    return ficha;
  });

  if (alterou) salvarFichasTreino();
}

document
  .getElementById("formFichaTreino")
  ?.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = document.getElementById("fichaTreinoId").value;
    const alunoId = document.getElementById("fichaAluno").value;
    const professorId = document.getElementById("fichaProfessor").value;
    const inicio = document.getElementById("fichaInicio").value;
    const validade = document.getElementById("fichaValidade").value;

    if (validade < inicio) {
      mostrarAlerta(
        "A validade da ficha não pode ser anterior à data de início.",
        "error"
      );
      return;
    }

    const exercicios = obterExerciciosFormulario();

    if (!exercicios.length || exercicios.some((item) => !item.nome || !item.grupo)) {
      mostrarAlerta(
        "Preencha corretamente todos os exercícios da ficha.",
        "error"
      );
      return;
    }

    const dados = {
      id: id || gerarId(),
      alunoId,
      professorId,
      objetivo: document.getElementById("fichaObjetivo").value,
      nivel: document.getElementById("fichaNivel").value,
      inicio,
      validade,
      diasSemana: Number(
        document.getElementById("fichaDiasSemana").value
      ),
      status: document.getElementById("fichaStatus").value,
      observacoes: document
        .getElementById("fichaObservacoes")
        .value.trim(),
      exercicios,
      atualizadoEm: new Date().toISOString()
    };

    if (id) {
      fichasTreino = fichasTreino.map((ficha) =>
        ficha.id === id ? dados : ficha
      );

      mostrarAlerta("Ficha de treino atualizada com sucesso.");
    } else {
      fichasTreino.unshift(dados);
      mostrarAlerta("Ficha de treino criada com sucesso.");
    }

    salvarFichasTreino();
    limparFormularioFichaTreino();
    atualizarModulosTreino();
  });

function limparFormularioFichaTreino() {
  document.getElementById("formFichaTreino")?.reset();
  document.getElementById("fichaTreinoId").value = "";
  document.getElementById("fichaInicio").value = hojeIso();
  document.getElementById("fichaValidade").value =
    somarDiasData(hojeIso(), 60);
  document.getElementById("fichaNivel").value = "Iniciante";
  document.getElementById("fichaDiasSemana").value = "3";
  document.getElementById("fichaStatus").value = "Ativa";

  const lista = document.getElementById("listaExercicios");
  if (lista) lista.innerHTML = "";

  criarLinhaExercicio();
}

function editarFichaTreino(id) {
  const ficha = fichasTreino.find((item) => item.id === id);
  if (!ficha) return;

  document
    .querySelector('.menu button[data-view="treinos"]')
    ?.click();

  renderizarSelectsFichaTreino();

  document.getElementById("fichaTreinoId").value = ficha.id;
  document.getElementById("fichaAluno").value = ficha.alunoId;
  document.getElementById("fichaProfessor").value = ficha.professorId;
  document.getElementById("fichaObjetivo").value = ficha.objetivo;
  document.getElementById("fichaNivel").value = ficha.nivel;
  document.getElementById("fichaInicio").value = ficha.inicio;
  document.getElementById("fichaValidade").value = ficha.validade;
  document.getElementById("fichaDiasSemana").value =
    String(ficha.diasSemana);
  document.getElementById("fichaStatus").value =
    ficha.status === "Vencida" ? "Ativa" : ficha.status;
  document.getElementById("fichaObservacoes").value =
    ficha.observacoes || "";

  const lista = document.getElementById("listaExercicios");
  lista.innerHTML = "";
  ficha.exercicios.forEach((exercicio) =>
    criarLinhaExercicio(exercicio)
  );

  document
    .getElementById("formFichaTreino")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function excluirFichaTreino(id) {
  const ficha = fichasTreino.find(
    (item) => String(item.id) === String(id)
  );

  if (!ficha) {
    mostrarAlerta(
      "A ficha de treino não foi encontrada ou já foi excluída.",
      "error"
    );
    atualizarModulosTreino();
    return;
  }

  const aluno = alunos.find(
    (item) => String(item.id) === String(ficha.alunoId)
  );

  const nomeAluno = aluno?.nome || "este aluno";

  const confirmou = window.confirm(
    `Deseja realmente excluir a ficha de treino de ${nomeAluno}?`
  );

  if (!confirmou) return;

  fichasTreino = fichasTreino.filter(
    (item) => String(item.id) !== String(id)
  );

  salvarFichasTreino();
  fecharModalFichaTreino();
  limparFormularioFichaTreino();
  atualizarModulosTreino();

  mostrarAlerta(
    `Ficha de treino de ${nomeAluno} excluída com sucesso.`
  );
}

function renderizarFichasTreino() {
  atualizarStatusFichas();

  const container = document.getElementById("listaFichasTreino");
  if (!container) return;

  const busca = normalizarPesquisaAluno(
    document.getElementById("buscarFichaTreino")?.value
  );

  const filtroStatus =
    document.getElementById("filtrarStatusFicha")?.value || "";

  const filtradas = fichasTreino.filter((ficha) => {
    const aluno = alunos.find((item) => item.id === ficha.alunoId);
    const professor = professores.find(
      (item) => item.id === ficha.professorId
    );

    const texto = normalizarPesquisaAluno(
      `${aluno?.nome || ""} ${professor?.nome || ""} ${ficha.objetivo}`
    );

    const combinaBusca = !busca || texto.includes(busca);
    const combinaStatus =
      !filtroStatus || ficha.status === filtroStatus;

    return combinaBusca && combinaStatus;
  });

  if (!filtradas.length) {
    container.innerHTML = `
      <div class="empty" style="grid-column: 1 / -1;">
        Nenhuma ficha de treino encontrada.
      </div>
    `;
  } else {
    container.innerHTML = filtradas.map((ficha) => {
      const aluno = alunos.find((item) => item.id === ficha.alunoId);
      const professor = professores.find(
        (item) => item.id === ficha.professorId
      );

      return `
        <article class="workout-card">
          <div class="workout-card-header">
            <div class="workout-student">
              <div class="workout-avatar">
                ${escaparHtml(obterIniciaisAluno(aluno?.nome))}
              </div>

              <div>
                <strong>${escaparHtml(aluno?.nome || "Aluno não encontrado")}</strong>
                <small>
                  Professor: ${escaparHtml(professor?.nome || "Não encontrado")}
                </small>
              </div>
            </div>

            <span class="status ${formatarStatusClasse(ficha.status)}">
              ${escaparHtml(ficha.status)}
            </span>
          </div>

          <span class="workout-objective">
            ${escaparHtml(ficha.objetivo)}
          </span>

          <div class="workout-info-grid">
            <div>
              <small>Nível</small>
              <strong>${escaparHtml(ficha.nivel)}</strong>
            </div>

            <div>
              <small>Frequência</small>
              <strong>${ficha.diasSemana}x por semana</strong>
            </div>

            <div>
              <small>Exercícios</small>
              <strong>${ficha.exercicios.length} exercícios</strong>
            </div>

            <div>
              <small>Início</small>
              <strong>${formatarData(ficha.inicio)}</strong>
            </div>

            <div>
              <small>Validade</small>
              <strong>${formatarData(ficha.validade)}</strong>
            </div>

            <div>
              <small>Objetivo</small>
              <strong>${escaparHtml(ficha.objetivo)}</strong>
            </div>
          </div>

          <div class="workout-actions">
            <button
              class="btn btn-primary"
              type="button"
              data-workout-action="view"
              data-workout-id="${ficha.id}"
            >
              Visualizar
            </button>

            <button
              class="btn btn-secondary"
              type="button"
              data-workout-action="edit"
              data-workout-id="${ficha.id}"
            >
              Editar
            </button>

            <button
              class="btn btn-danger"
              type="button"
              data-workout-action="delete"
              data-workout-id="${ficha.id}"
            >
              Excluir
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  const total = fichasTreino.length;
  const ativas = fichasTreino.filter(
    (ficha) => ficha.status === "Ativa"
  ).length;

  const totalElemento = document.getElementById("totalFichasModulo");
  const ativasElemento = document.getElementById("fichasAtivasModulo");

  if (totalElemento) totalElemento.textContent = total;
  if (ativasElemento) ativasElemento.textContent = ativas;
}

function visualizarFichaTreino(id) {
  const ficha = fichasTreino.find((item) => item.id === id);
  if (!ficha) return;

  const aluno = alunos.find((item) => item.id === ficha.alunoId);
  const professor = professores.find(
    (item) => item.id === ficha.professorId
  );

  const conteudo = document.getElementById(
    "conteudoModalFichaTreino"
  );

  conteudo.innerHTML = `
    <div class="workout-modal-title">
      <span>FICHA DE TREINO INDIVIDUAL</span>
      <h3>${escaparHtml(aluno?.nome || "Aluno não encontrado")}</h3>
      <p>
        Objetivo: ${escaparHtml(ficha.objetivo)} •
        Professor: ${escaparHtml(professor?.nome || "Não encontrado")}
      </p>
    </div>

    <div class="workout-modal-summary">
      <div>
        <small>Status</small>
        <strong>${escaparHtml(ficha.status)}</strong>
      </div>
      <div>
        <small>Nível</small>
        <strong>${escaparHtml(ficha.nivel)}</strong>
      </div>
      <div>
        <small>Frequência</small>
        <strong>${ficha.diasSemana}x por semana</strong>
      </div>
      <div>
        <small>Validade</small>
        <strong>${formatarData(ficha.validade)}</strong>
      </div>
    </div>

    <div class="table-wrap">
      <table class="workout-detail-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Exercício</th>
            <th>Grupo muscular</th>
            <th>Séries</th>
            <th>Repetições</th>
            <th>Carga</th>
            <th>Descanso</th>
          </tr>
        </thead>

        <tbody>
          ${ficha.exercicios.map((exercicio, indice) => `
            <tr>
              <td>${indice + 1}</td>
              <td><strong>${escaparHtml(exercicio.nome)}</strong></td>
              <td>${escaparHtml(exercicio.grupo)}</td>
              <td>${exercicio.series}</td>
              <td>${escaparHtml(exercicio.repeticoes)}</td>
              <td>${escaparHtml(exercicio.carga || "A definir")}</td>
              <td>${escaparHtml(exercicio.descanso || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    ${
      ficha.observacoes
        ? `
          <div class="workout-observation">
            <strong>Orientações gerais:</strong><br>
            ${escaparHtml(ficha.observacoes)}
          </div>
        `
        : ""
    }

    <div class="workout-modal-actions">
      <button
        class="btn btn-secondary"
        type="button"
        data-modal-workout-action="edit"
        data-workout-id="${ficha.id}"
      >
        Editar ficha
      </button>

      <button
        class="btn btn-danger"
        type="button"
        data-modal-workout-action="delete"
        data-workout-id="${ficha.id}"
      >
        Excluir ficha
      </button>

      <button
        class="btn btn-primary"
        type="button"
        data-close-workout-modal
      >
        Fechar
      </button>
    </div>
  `;

  const modal = document.getElementById("modalFichaTreino");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function fecharModalFichaTreino() {
  const modal = document.getElementById("modalFichaTreino");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.addEventListener("click", (event) => {
  const fecharModal = event.target.closest(
    "[data-close-workout-modal]"
  );

  if (fecharModal) {
    fecharModalFichaTreino();
    return;
  }

  const acaoCartao = event.target.closest(
    "[data-workout-action]"
  );

  if (acaoCartao) {
    const id = acaoCartao.dataset.workoutId;
    const acao = acaoCartao.dataset.workoutAction;

    if (acao === "view") visualizarFichaTreino(id);
    if (acao === "edit") editarFichaTreino(id);
    if (acao === "delete") excluirFichaTreino(id);

    return;
  }

  const acaoModal = event.target.closest(
    "[data-modal-workout-action]"
  );

  if (acaoModal) {
    const id = acaoModal.dataset.workoutId;
    const acao = acaoModal.dataset.modalWorkoutAction;

    if (acao === "edit") {
      fecharModalFichaTreino();
      editarFichaTreino(id);
    }

    if (acao === "delete") {
      excluirFichaTreino(id);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") fecharModalFichaTreino();
});

document
  .getElementById("cancelarFichaTreino")
  ?.addEventListener("click", limparFormularioFichaTreino);

document
  .getElementById("buscarFichaTreino")
  ?.addEventListener("input", renderizarFichasTreino);

document
  .getElementById("filtrarStatusFicha")
  ?.addEventListener("change", renderizarFichasTreino);

function atualizarModulosTreino() {
  renderizarProfessores();
  renderizarSelectsFichaTreino();
  renderizarFichasTreino();
}

const atualizarTudoAntesDosTreinos = atualizarTudo;

atualizarTudo = function() {
  atualizarTudoAntesDosTreinos();
  atualizarModulosTreino();
};

document.getElementById("fichaInicio").value = hojeIso();
document.getElementById("fichaValidade").value =
  somarDiasData(hojeIso(), 60);

if (!document.querySelector("#listaExercicios .exercise-row")) {
  criarLinhaExercicio();
}

atualizarModulosTreino();

window.editarProfessor = editarProfessor;
window.excluirProfessor = excluirProfessor;
window.editarFichaTreino = editarFichaTreino;
window.excluirFichaTreino = excluirFichaTreino;
window.visualizarFichaTreino = visualizarFichaTreino;



// ==========================================================
// MODELOS AUTOMÁTICOS DE FICHA DE TREINO
// ==========================================================
const modelosAutomaticosTreino = [
  {
    id: "emagrecimento_iniciante",
    nome: "Emagrecimento — Iniciante",
    categoria: "Emagrecimento",
    objetivo: "Emagrecimento",
    nivel: "Iniciante",
    frequencia: 3,
    duracao: "45–60 minutos",
    icone: "🔥",
    descricao:
      "Treino geral com musculação e estímulos cardiovasculares para aumentar o gasto calórico.",
    observacoes:
      "Priorizar execução correta, cargas moderadas e evolução gradual. Realizar aquecimento de 5 a 10 minutos.",
    exercicios: [
      { nome: "Esteira — caminhada acelerada", grupo: "Cardiorrespiratório", series: 1, repeticoes: "10 min", carga: "Leve", descanso: "-" },
      { nome: "Agachamento livre", grupo: "Pernas", series: 3, repeticoes: "12-15", carga: "Moderada", descanso: "45s" },
      { nome: "Supino máquina", grupo: "Peito", series: 3, repeticoes: "12-15", carga: "Moderada", descanso: "45s" },
      { nome: "Puxada frontal", grupo: "Costas", series: 3, repeticoes: "12-15", carga: "Moderada", descanso: "45s" },
      { nome: "Elevação pélvica", grupo: "Glúteos", series: 3, repeticoes: "15", carga: "Moderada", descanso: "45s" },
      { nome: "Desenvolvimento máquina", grupo: "Ombros", series: 3, repeticoes: "12", carga: "Leve", descanso: "45s" },
      { nome: "Prancha abdominal", grupo: "Abdômen", series: 3, repeticoes: "30s", carga: "Corporal", descanso: "30s" },
      { nome: "Bicicleta ergométrica", grupo: "Cardiorrespiratório", series: 1, repeticoes: "12 min", carga: "Moderada", descanso: "-" }
    ]
  },
  {
    id: "emagrecimento_intermediario",
    nome: "Emagrecimento — Intermediário",
    categoria: "Emagrecimento",
    objetivo: "Emagrecimento",
    nivel: "Intermediário",
    frequencia: 4,
    duracao: "55–70 minutos",
    icone: "🔥",
    descricao:
      "Treino em circuito com maior intensidade para acelerar o metabolismo e melhorar o condicionamento.",
    observacoes:
      "Executar os exercícios em circuito. Ajustar intensidade conforme avaliação física e resposta do aluno.",
    exercicios: [
      { nome: "Esteira — intervalado", grupo: "Cardiorrespiratório", series: 1, repeticoes: "12 min", carga: "Intervalado", descanso: "-" },
      { nome: "Agachamento com halteres", grupo: "Pernas", series: 4, repeticoes: "12", carga: "Moderada", descanso: "40s" },
      { nome: "Remada baixa", grupo: "Costas", series: 4, repeticoes: "12", carga: "Moderada", descanso: "40s" },
      { nome: "Supino inclinado com halteres", grupo: "Peito", series: 4, repeticoes: "12", carga: "Moderada", descanso: "40s" },
      { nome: "Afundo alternado", grupo: "Pernas", series: 3, repeticoes: "12 cada", carga: "Moderada", descanso: "40s" },
      { nome: "Corda naval", grupo: "Corpo inteiro", series: 5, repeticoes: "30s", carga: "Intensa", descanso: "30s" },
      { nome: "Abdominal remador", grupo: "Abdômen", series: 4, repeticoes: "15", carga: "Corporal", descanso: "30s" },
      { nome: "Elíptico", grupo: "Cardiorrespiratório", series: 1, repeticoes: "15 min", carga: "Moderada", descanso: "-" }
    ]
  },
  {
    id: "hipertrofia_iniciante",
    nome: "Hipertrofia — Iniciante",
    categoria: "Hipertrofia",
    objetivo: "Hipertrofia",
    nivel: "Iniciante",
    frequencia: 3,
    duracao: "55–70 minutos",
    icone: "💪",
    descricao:
      "Treino básico de corpo inteiro para adaptação e ganho inicial de massa muscular.",
    observacoes:
      "Priorizar técnica, amplitude segura e progressão de carga somente após domínio dos movimentos.",
    exercicios: [
      { nome: "Leg press 45°", grupo: "Pernas", series: 3, repeticoes: "10-12", carga: "Moderada", descanso: "60s" },
      { nome: "Cadeira extensora", grupo: "Pernas", series: 3, repeticoes: "12", carga: "Moderada", descanso: "60s" },
      { nome: "Supino reto máquina", grupo: "Peito", series: 3, repeticoes: "10-12", carga: "Moderada", descanso: "60s" },
      { nome: "Puxada frontal aberta", grupo: "Costas", series: 3, repeticoes: "10-12", carga: "Moderada", descanso: "60s" },
      { nome: "Desenvolvimento com halteres", grupo: "Ombros", series: 3, repeticoes: "10-12", carga: "Leve", descanso: "60s" },
      { nome: "Rosca direta", grupo: "Bíceps", series: 3, repeticoes: "12", carga: "Leve", descanso: "45s" },
      { nome: "Tríceps pulley", grupo: "Tríceps", series: 3, repeticoes: "12", carga: "Leve", descanso: "45s" },
      { nome: "Abdominal máquina", grupo: "Abdômen", series: 3, repeticoes: "15", carga: "Leve", descanso: "45s" }
    ]
  },
  {
    id: "hipertrofia_intermediario",
    nome: "Hipertrofia — Intermediário",
    categoria: "Hipertrofia",
    objetivo: "Hipertrofia",
    nivel: "Intermediário",
    frequencia: 5,
    duracao: "65–85 minutos",
    icone: "💪",
    descricao:
      "Treino com maior volume, intensidade e foco em progressão para ganho de massa muscular.",
    observacoes:
      "Aplicar progressão de carga, controlar cadência e manter registro das cargas utilizadas.",
    exercicios: [
      { nome: "Agachamento livre", grupo: "Pernas", series: 4, repeticoes: "8-10", carga: "Progressiva", descanso: "90s" },
      { nome: "Stiff com barra", grupo: "Pernas", series: 4, repeticoes: "10", carga: "Progressiva", descanso: "90s" },
      { nome: "Supino reto com barra", grupo: "Peito", series: 4, repeticoes: "8-10", carga: "Progressiva", descanso: "90s" },
      { nome: "Remada curvada", grupo: "Costas", series: 4, repeticoes: "8-10", carga: "Progressiva", descanso: "90s" },
      { nome: "Desenvolvimento militar", grupo: "Ombros", series: 4, repeticoes: "8-10", carga: "Moderada", descanso: "75s" },
      { nome: "Rosca alternada", grupo: "Bíceps", series: 4, repeticoes: "10-12", carga: "Moderada", descanso: "60s" },
      { nome: "Tríceps francês", grupo: "Tríceps", series: 4, repeticoes: "10-12", carga: "Moderada", descanso: "60s" },
      { nome: "Elevação de pernas", grupo: "Abdômen", series: 4, repeticoes: "15", carga: "Corporal", descanso: "45s" }
    ]
  },
  {
    id: "forca_intermediario",
    nome: "Força — Intermediário",
    categoria: "Força",
    objetivo: "Força",
    nivel: "Intermediário",
    frequencia: 4,
    duracao: "65–80 minutos",
    icone: "⚡",
    descricao:
      "Treino baseado em exercícios compostos, baixas repetições e maior intervalo de recuperação.",
    observacoes:
      "Exigir técnica consolidada. Utilizar cargas progressivas e descanso completo entre séries principais.",
    exercicios: [
      { nome: "Agachamento livre", grupo: "Pernas", series: 5, repeticoes: "5", carga: "Alta", descanso: "180s" },
      { nome: "Supino reto com barra", grupo: "Peito", series: 5, repeticoes: "5", carga: "Alta", descanso: "180s" },
      { nome: "Levantamento terra", grupo: "Corpo inteiro", series: 4, repeticoes: "5", carga: "Alta", descanso: "180s" },
      { nome: "Desenvolvimento militar", grupo: "Ombros", series: 4, repeticoes: "6", carga: "Alta", descanso: "120s" },
      { nome: "Remada curvada", grupo: "Costas", series: 4, repeticoes: "6", carga: "Alta", descanso: "120s" },
      { nome: "Prancha com carga", grupo: "Abdômen", series: 4, repeticoes: "40s", carga: "Moderada", descanso: "60s" }
    ]
  },
  {
    id: "condicionamento_iniciante",
    nome: "Condicionamento — Iniciante",
    categoria: "Condicionamento",
    objetivo: "Condicionamento",
    nivel: "Iniciante",
    frequencia: 3,
    duracao: "40–55 minutos",
    icone: "🏃",
    descricao:
      "Treino funcional para melhorar capacidade cardiorrespiratória, coordenação e resistência geral.",
    observacoes:
      "Manter ritmo confortável e monitorar percepção de esforço durante todo o circuito.",
    exercicios: [
      { nome: "Caminhada na esteira", grupo: "Cardiorrespiratório", series: 1, repeticoes: "10 min", carga: "Leve", descanso: "-" },
      { nome: "Polichinelo", grupo: "Corpo inteiro", series: 3, repeticoes: "30s", carga: "Corporal", descanso: "30s" },
      { nome: "Agachamento corporal", grupo: "Pernas", series: 3, repeticoes: "15", carga: "Corporal", descanso: "30s" },
      { nome: "Remada no TRX", grupo: "Costas", series: 3, repeticoes: "12", carga: "Corporal", descanso: "30s" },
      { nome: "Step no banco", grupo: "Pernas", series: 3, repeticoes: "12 cada", carga: "Corporal", descanso: "30s" },
      { nome: "Mountain climber", grupo: "Corpo inteiro", series: 3, repeticoes: "30s", carga: "Corporal", descanso: "30s" },
      { nome: "Prancha", grupo: "Abdômen", series: 3, repeticoes: "30s", carga: "Corporal", descanso: "30s" },
      { nome: "Bicicleta ergométrica", grupo: "Cardiorrespiratório", series: 1, repeticoes: "10 min", carga: "Leve", descanso: "-" }
    ]
  },
  {
    id: "resistencia_intermediario",
    nome: "Resistência — Intermediário",
    categoria: "Resistência",
    objetivo: "Resistência",
    nivel: "Intermediário",
    frequencia: 4,
    duracao: "55–70 minutos",
    icone: "❤️",
    descricao:
      "Treino com repetições mais altas e pausas curtas para resistência muscular e cardiovascular.",
    observacoes:
      "Utilizar cargas leves a moderadas e preservar a qualidade do movimento mesmo com fadiga.",
    exercicios: [
      { nome: "Agachamento goblet", grupo: "Pernas", series: 4, repeticoes: "15-20", carga: "Moderada", descanso: "40s" },
      { nome: "Flexão de braço", grupo: "Peito", series: 4, repeticoes: "Máximo técnico", carga: "Corporal", descanso: "40s" },
      { nome: "Remada baixa", grupo: "Costas", series: 4, repeticoes: "15", carga: "Moderada", descanso: "40s" },
      { nome: "Avanço alternado", grupo: "Pernas", series: 4, repeticoes: "15 cada", carga: "Leve", descanso: "40s" },
      { nome: "Elevação lateral", grupo: "Ombros", series: 4, repeticoes: "15-20", carga: "Leve", descanso: "35s" },
      { nome: "Burpee adaptado", grupo: "Corpo inteiro", series: 4, repeticoes: "10", carga: "Corporal", descanso: "45s" },
      { nome: "Abdominal bicicleta", grupo: "Abdômen", series: 4, repeticoes: "20", carga: "Corporal", descanso: "35s" }
    ]
  },
  {
    id: "mobilidade_iniciante",
    nome: "Mobilidade — Iniciante",
    categoria: "Mobilidade",
    objetivo: "Mobilidade",
    nivel: "Iniciante",
    frequencia: 3,
    duracao: "30–45 minutos",
    icone: "🧘",
    descricao:
      "Rotina de mobilidade, estabilidade e alongamento ativo para melhorar movimentos e prevenir desconfortos.",
    observacoes:
      "Executar lentamente, sem dor e respeitando os limites individuais. Não forçar amplitudes.",
    exercicios: [
      { nome: "Mobilidade de tornozelo", grupo: "Pernas", series: 3, repeticoes: "10 cada", carga: "Corporal", descanso: "20s" },
      { nome: "Alongamento dinâmico de quadril", grupo: "Pernas", series: 3, repeticoes: "10 cada", carga: "Corporal", descanso: "20s" },
      { nome: "Rotação torácica", grupo: "Costas", series: 3, repeticoes: "10 cada", carga: "Corporal", descanso: "20s" },
      { nome: "Mobilidade de ombros com bastão", grupo: "Ombros", series: 3, repeticoes: "12", carga: "Leve", descanso: "20s" },
      { nome: "Ponte de glúteos", grupo: "Glúteos", series: 3, repeticoes: "15", carga: "Corporal", descanso: "30s" },
      { nome: "Bird dog", grupo: "Abdômen", series: 3, repeticoes: "10 cada", carga: "Corporal", descanso: "30s" },
      { nome: "Prancha lateral", grupo: "Abdômen", series: 3, repeticoes: "25s cada", carga: "Corporal", descanso: "30s" }
    ]
  }
];

let filtroModeloTreinoAtual = "Todos";
let modeloAutomaticoSelecionadoId = "";

function renderizarModelosAutomaticosTreino() {
  const container = document.getElementById("modelosAutomaticosTreino");
  if (!container) return;

  const modelosFiltrados = modelosAutomaticosTreino.filter(
    (modelo) =>
      filtroModeloTreinoAtual === "Todos" ||
      modelo.categoria === filtroModeloTreinoAtual
  );

  container.innerHTML = modelosFiltrados.map((modelo) => `
    <article
      class="automatic-template-card ${
        modeloAutomaticoSelecionadoId === modelo.id ? "selected" : ""
      }"
      data-template-card-id="${modelo.id}"
    >
      <div class="template-card-top">
        <div class="template-icon">${modelo.icone}</div>
        <span class="template-level">${escaparHtml(modelo.nivel)}</span>
      </div>

      <h5>${escaparHtml(modelo.nome)}</h5>
      <span class="template-category">${escaparHtml(modelo.categoria)}</span>

      <p class="template-description">
        ${escaparHtml(modelo.descricao)}
      </p>

      <div class="template-metadata">
        <div>
          <small>Frequência</small>
          <strong>${modelo.frequencia}x por semana</strong>
        </div>

        <div>
          <small>Duração média</small>
          <strong>${escaparHtml(modelo.duracao)}</strong>
        </div>

        <div>
          <small>Exercícios</small>
          <strong>${modelo.exercicios.length} exercícios</strong>
        </div>

        <div>
          <small>Nível</small>
          <strong>${escaparHtml(modelo.nivel)}</strong>
        </div>
      </div>

      <button
        class="use-template-button"
        type="button"
        data-use-template-id="${modelo.id}"
      >
        ${
          modeloAutomaticoSelecionadoId === modelo.id
            ? "Modelo aplicado"
            : "Usar este modelo"
        }
      </button>
    </article>
  `).join("");

  container
    .querySelectorAll("[data-use-template-id]")
    .forEach((botao) => {
      botao.addEventListener("click", () => {
        aplicarModeloAutomaticoTreino(botao.dataset.useTemplateId);
      });
    });
}

function aplicarModeloAutomaticoTreino(modeloId) {
  const modelo = modelosAutomaticosTreino.find(
    (item) => item.id === modeloId
  );

  if (!modelo) {
    mostrarAlerta("O modelo selecionado não foi encontrado.", "error");
    return;
  }

  const lista = document.getElementById("listaExercicios");

  if (
    lista?.children.length > 0 &&
    !confirm(
      "Os exercícios atuais serão substituídos pelo modelo selecionado. Deseja continuar?"
    )
  ) {
    return;
  }

  modeloAutomaticoSelecionadoId = modelo.id;

  document.getElementById("fichaObjetivo").value = modelo.objetivo;
  document.getElementById("fichaNivel").value = modelo.nivel;
  document.getElementById("fichaDiasSemana").value =
    String(modelo.frequencia);
  document.getElementById("fichaObservacoes").value =
    modelo.observacoes;

  if (lista) {
    lista.innerHTML = "";
  }

  modelo.exercicios.forEach((exercicio) => {
    criarLinhaExercicio({
      ...exercicio
    });
  });

  const aviso = document.getElementById("modeloSelecionadoAviso");
  const nome = document.getElementById("nomeModeloSelecionado");
  const detalhes = document.getElementById(
    "detalhesModeloSelecionado"
  );

  if (aviso) aviso.classList.add("show");
  if (nome) nome.textContent = modelo.nome;
  if (detalhes) {
    detalhes.textContent =
      `${modelo.exercicios.length} exercícios carregados • ` +
      `${modelo.frequencia} vezes por semana • ${modelo.duracao}`;
  }

  renderizarModelosAutomaticosTreino();

  document
    .querySelector(".exercise-builder")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });

  mostrarAlerta(
    `Modelo "${modelo.nome}" aplicado. Agora personalize os exercícios.`
  );
}

function usarFichaTreinoEmBranco() {
  const lista = document.getElementById("listaExercicios");

  if (
    lista?.children.length > 0 &&
    !confirm(
      "Deseja limpar todos os exercícios e começar uma ficha em branco?"
    )
  ) {
    return;
  }

  modeloAutomaticoSelecionadoId = "";

  if (lista) {
    lista.innerHTML = "";
  }

  criarLinhaExercicio();

  const aviso = document.getElementById("modeloSelecionadoAviso");
  const nome = document.getElementById("nomeModeloSelecionado");
  const detalhes = document.getElementById(
    "detalhesModeloSelecionado"
  );

  if (aviso) aviso.classList.remove("show");
  if (nome) nome.textContent = "Nenhum modelo selecionado";
  if (detalhes) {
    detalhes.textContent =
      "Escolha um modelo ou monte a ficha do zero.";
  }

  renderizarModelosAutomaticosTreino();
  mostrarAlerta("Ficha em branco preparada.");
}

document
  .querySelectorAll("[data-template-filter]")
  .forEach((botao) => {
    botao.addEventListener("click", () => {
      filtroModeloTreinoAtual =
        botao.dataset.templateFilter || "Todos";

      document
        .querySelectorAll("[data-template-filter]")
        .forEach((item) => {
          item.classList.toggle("active", item === botao);
        });

      renderizarModelosAutomaticosTreino();
    });
  });

document
  .getElementById("limparModeloAutomatico")
  ?.addEventListener("click", usarFichaTreinoEmBranco);

renderizarModelosAutomaticosTreino();

const VIDEOS_STORAGE_KEY="fitcontrol_videos_jiujitsu",PRODUTOS_STORAGE_KEY="fitcontrol_produtos_loja",PEDIDOS_STORAGE_KEY="fitcontrol_pedidos_loja",NOTIFICACOES_STORAGE_KEY="fitcontrol_notificacoes",CARRINHO_STORAGE_KEY="fitcontrol_carrinho";
let videosTreino=carregar(VIDEOS_STORAGE_KEY),produtosLoja=carregar(PRODUTOS_STORAGE_KEY),pedidosLoja=carregar(PEDIDOS_STORAGE_KEY),notificacoes=carregar(NOTIFICACOES_STORAGE_KEY),carrinhoLoja=carregar(CARRINHO_STORAGE_KEY);
textosPaginas.videos=["Vídeos","Treino do dia e técnicas demonstrativas"];textosPaginas.loja=["Loja","Produtos e pedidos"];textosPaginas.notificacoes=["Notificações","Vendas, promoções e mensalidades"];textosPaginas.treinos=["Treinos de jiu-jitsu","Planejamento técnico"];
function criarNotificacao(o){notificacoes.unshift({id:gerarId(),tipo:o.tipo||"Geral",titulo:o.titulo,mensagem:o.mensagem,publico:o.publico||"Administrador",alunoId:o.alunoId||"",lida:false,criadaEm:new Date().toISOString()});salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}
function videoEmbed(u){try{let x=new URL(u);if(x.hostname.includes("youtube.com"))return`https://www.youtube.com/embed/${x.searchParams.get("v")}`;if(x.hostname.includes("youtu.be"))return`https://www.youtube.com/embed/${x.pathname.slice(1)}`;if(x.hostname.includes("vimeo.com"))return`https://player.vimeo.com/video/${x.pathname.split("/").pop()}`;return u}catch{return u}}
document.getElementById("formVideoTreino")?.addEventListener("submit",e=>{e.preventDefault();let id=videoTreinoId.value,d={id:id||gerarId(),titulo:videoTitulo.value.trim(),categoria:videoCategoria.value,nivel:videoNivel.value,status:videoStatus.value,url:videoUrl.value.trim(),descricao:videoDescricao.value.trim()};videosTreino=id?videosTreino.map(v=>v.id===id?d:v):[d,...videosTreino];salvar(VIDEOS_STORAGE_KEY,videosTreino);if(!id)criarNotificacao({tipo:"Treino",titulo:d.categoria==="Treino do dia"?"Novo treino do dia":"Novo vídeo",mensagem:d.titulo+" foi publicado.",publico:"Todos os alunos"});formVideoTreino.reset();videoTreinoId.value="";renderizarVideos();mostrarAlerta("Vídeo salvo.")});
function renderizarVideos(){if(!document.getElementById("listaVideosTreino"))return;listaVideosTreino.innerHTML=videosTreino.length?videosTreino.map(v=>`<article class="video-card"><div class="video-preview"><iframe src="${escaparHtml(videoEmbed(v.url))}" allowfullscreen></iframe></div><div class="video-card-content"><h4>${escaparHtml(v.titulo)}</h4><p>${escaparHtml(v.categoria)} • ${escaparHtml(v.nivel)}</p><p>${escaparHtml(v.descricao||"")}</p><div class="actions"><button class="btn btn-danger" onclick="excluirVideo('${v.id}')">Excluir</button></div></div></article>`).join(""):'<div class="empty">Nenhum vídeo.</div>';totalVideosModulo.textContent=videosTreino.length}
function excluirVideo(id){if(confirm("Excluir vídeo?")){videosTreino=videosTreino.filter(v=>v.id!==id);salvar(VIDEOS_STORAGE_KEY,videosTreino);renderizarVideos()}}
document.getElementById("cancelarVideoTreino")?.addEventListener("click",()=>formVideoTreino.reset());
function precoProduto(p){return p.precoPromocional>0&&p.precoPromocional<p.preco?p.precoPromocional:p.preco}
document.getElementById("formProduto")?.addEventListener("submit",e=>{e.preventDefault();let id=produtoId.value,d={id:id||gerarId(),nome:produtoNome.value.trim(),categoria:produtoCategoria.value,preco:+produtoPreco.value,precoPromocional:+produtoPrecoPromocional.value||0,estoque:+produtoEstoque.value,status:produtoStatus.value,imagem:produtoImagem.value.trim(),descricao:produtoDescricao.value.trim()};produtosLoja=id?produtosLoja.map(p=>p.id===id?d:p):[d,...produtosLoja];salvar(PRODUTOS_STORAGE_KEY,produtosLoja);if(!id&&d.precoPromocional>0&&d.precoPromocional<d.preco)criarNotificacao({tipo:"Promoção",titulo:"Promoção: "+d.nome,mensagem:`Produto por ${formatarMoeda(d.precoPromocional)}.`,publico:"Todos os alunos"});formProduto.reset();produtoId.value="";produtoEstoque.value=1;renderizarProdutos();mostrarAlerta("Produto salvo.")});
function renderizarProdutos(){if(!document.getElementById("listaProdutos"))return;listaProdutos.innerHTML=produtosLoja.length?produtosLoja.map(p=>`<article class="product-card"><div class="product-image">${p.imagem?`<img src="${escaparHtml(p.imagem)}">`:"🥋"}</div><div class="product-card-content"><h4>${escaparHtml(p.nome)}</h4><p>${escaparHtml(p.descricao||"")}</p><p><strong class="product-price">${formatarMoeda(precoProduto(p))}</strong>${precoProduto(p)<p.preco?`<span class="product-old-price">${formatarMoeda(p.preco)}</span>`:""}</p><div class="actions"><button class="btn btn-primary" onclick="adicionarCarrinho('${p.id}')">Comprar</button><button class="btn btn-danger" onclick="excluirProdutoLoja('${p.id}')">Excluir</button></div></div></article>`).join(""):'<div class="empty">Nenhum produto.</div>';totalProdutosModulo.textContent=produtosLoja.length}
function adicionarCarrinho(id){let p=produtosLoja.find(x=>x.id===id),i=carrinhoLoja.find(x=>x.produtoId===id);if(!p||p.estoque<=0)return mostrarAlerta("Produto indisponível.","error");i?i.quantidade++:carrinhoLoja.push({produtoId:id,quantidade:1});salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);renderizarCarrinho()}
function excluirProdutoLoja(id){if(confirm("Excluir produto?")){produtosLoja=produtosLoja.filter(p=>p.id!==id);carrinhoLoja=carrinhoLoja.filter(i=>i.produtoId!==id);salvar(PRODUTOS_STORAGE_KEY,produtosLoja);salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);renderizarProdutos();renderizarCarrinho()}}
function removerCarrinho(id){carrinhoLoja=carrinhoLoja.filter(i=>i.produtoId!==id);salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);renderizarCarrinho()}
function renderizarCarrinho(){if(!document.getElementById("listaCarrinho"))return;let t=0,q=0;listaCarrinho.innerHTML=carrinhoLoja.length?carrinhoLoja.map(i=>{let p=produtosLoja.find(x=>x.id===i.produtoId);if(!p)return"";let s=precoProduto(p)*i.quantidade;t+=s;q+=i.quantidade;return`<div class="cart-item"><div><strong>${escaparHtml(p.nome)}</strong><small>${i.quantidade} x ${formatarMoeda(precoProduto(p))}</small></div><button onclick="removerCarrinho('${p.id}')">×</button></div>`}).join(""):'<div class="empty">Carrinho vazio.</div>';carrinhoTotal.textContent=formatarMoeda(t);cartItemCount.textContent=q}
function preencherAlunosExtras(){["carrinhoAluno","notificacaoAluno"].forEach(id=>{let s=document.getElementById(id);if(!s)return;let v=s.value;s.innerHTML='<option value="">Selecione o aluno</option>'+alunos.filter(a=>a.status==="Ativo").map(a=>`<option value="${a.id}">${escaparHtml(a.nome)}</option>`).join("");s.value=v})}
document.getElementById("finalizarCompra")?.addEventListener("click",()=>{let alunoId=carrinhoAluno.value;if(!alunoId||!carrinhoLoja.length)return mostrarAlerta("Selecione o aluno e adicione produtos.","error");let aluno=alunos.find(a=>a.id===alunoId),itens=[],total=0;for(let i of carrinhoLoja){let p=produtosLoja.find(x=>x.id===i.produtoId);if(!p||i.quantidade>p.estoque)return mostrarAlerta("Estoque insuficiente.","error");itens.push({nome:p.nome,quantidade:i.quantidade,preco:precoProduto(p)});total+=precoProduto(p)*i.quantidade;p.estoque-=i.quantidade}let ped={id:gerarId(),codigo:"PED-"+String(pedidosLoja.length+1).padStart(4,"0"),alunoId,itens,total,pagamento:formaPagamentoLoja.value,criadoEm:new Date().toISOString()};pedidosLoja.unshift(ped);carrinhoLoja=[];salvar(PEDIDOS_STORAGE_KEY,pedidosLoja);salvar(PRODUTOS_STORAGE_KEY,produtosLoja);salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);criarNotificacao({tipo:"Venda",titulo:"Nova venda realizada",mensagem:`${aluno.nome} comprou ${formatarMoeda(total)}.`,publico:"Administrador"});criarNotificacao({tipo:"Venda",titulo:"Pedido confirmado",mensagem:`Pedido ${ped.codigo} confirmado.`,publico:"Aluno específico",alunoId});renderizarProdutos();renderizarCarrinho();renderizarPedidos();mostrarAlerta("Pagamento aprovado em modo demonstrativo.")});
function renderizarPedidos(){if(!document.getElementById("tabelaPedidosLoja"))return;tabelaPedidosLoja.innerHTML=pedidosLoja.length?pedidosLoja.map(p=>`<tr><td>${p.codigo}</td><td>${escaparHtml(alunos.find(a=>a.id===p.alunoId)?.nome||"-")}</td><td>${p.itens.map(i=>i.quantidade+"x "+escaparHtml(i.nome)).join("<br>")}</td><td>${p.pagamento}</td><td>${formatarMoeda(p.total)}</td><td>${new Date(p.criadoEm).toLocaleString("pt-BR")}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Nenhum pedido.</td></tr>';totalPedidosModulo.textContent=pedidosLoja.length}
document.getElementById("formNotificacao")?.addEventListener("submit",e=>{e.preventDefault();if(notificacaoPublico.value==="Aluno específico"&&!notificacaoAluno.value)return mostrarAlerta("Selecione o aluno.","error");criarNotificacao({tipo:notificacaoTipo.value,titulo:notificacaoTitulo.value.trim(),mensagem:notificacaoMensagem.value.trim(),publico:notificacaoPublico.value,alunoId:notificacaoAluno.value});formNotificacao.reset();renderizarNotificacoes();mostrarAlerta("Notificação enviada.")});
function renderizarNotificacoes(){if(!document.getElementById("listaNotificacoes"))return;listaNotificacoes.innerHTML=notificacoes.length?notificacoes.map(n=>`<article class="notification-card ${n.lida?"":"unread"}"><div class="notification-icon">🔔</div><div class="notification-content"><strong>${escaparHtml(n.titulo)}</strong><p>${escaparHtml(n.mensagem)}</p><small>${n.tipo} • ${new Date(n.criadaEm).toLocaleString("pt-BR")}</small></div><div class="notification-actions">${n.lida?"":`<button onclick="lerNotificacao('${n.id}')">Lida</button>`}<button onclick="apagarNotificacao('${n.id}')">Excluir</button></div></article>`).join(""):'<div class="empty">Nenhuma notificação.</div>';let q=notificacoes.filter(n=>!n.lida).length;[menuNotificationBadge,topNotificationBadge].forEach(x=>{x.textContent=q;x.classList.toggle("show",q>0)});totalNotificacoesNaoLidas.textContent=q}
function lerNotificacao(id){notificacoes=notificacoes.map(n=>n.id===id?{...n,lida:true}:n);salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}
function apagarNotificacao(id){notificacoes=notificacoes.filter(n=>n.id!==id);salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}
document.getElementById("gerarAlertasMensalidade")?.addEventListener("click",()=>{let c=0,hoje=new Date();matriculas.forEach(m=>{if(m.status!=="Ativo")return;let d=Math.ceil((new Date(m.vencimento+"T00:00:00")-hoje)/86400000);if(d<=7){criarNotificacao({tipo:d<0?"Renovação":"Mensalidade",titulo:d<0?"Plano vencido":"Mensalidade próxima",mensagem:d<0?`Seu plano venceu em ${formatarData(m.vencimento)}.`:`Sua mensalidade vence em ${formatarData(m.vencimento)}.`,publico:"Aluno específico",alunoId:m.alunoId});c++}});mostrarAlerta(c?`${c} alerta(s) gerado(s).`:"Nenhum alerta necessário.")});
document.getElementById("marcarTodasNotificacoes")?.addEventListener("click",()=>{notificacoes=notificacoes.map(n=>({...n,lida:true}));salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()});
document.getElementById("topNotificationButton")?.addEventListener("click",()=>document.querySelector('[data-view="notificacoes"]')?.click());
function atualizarExtras(){renderizarVideos();renderizarProdutos();preencherAlunosExtras();renderizarCarrinho();renderizarPedidos();renderizarNotificacoes()}
const atualizarTudoAnteriorExtras=atualizarTudo;atualizarTudo=function(){atualizarTudoAnteriorExtras();atualizarExtras()};atualizarExtras();
window.excluirVideo=excluirVideo;window.adicionarCarrinho=adicionarCarrinho;window.excluirProdutoLoja=excluirProdutoLoja;window.removerCarrinho=removerCarrinho;window.lerNotificacao=lerNotificacao;window.apagarNotificacao=apagarNotificacao;

const modelosJiuJitsu=[
{id:"jj_fundamentos_branca",nome:"Fundamentos — Faixa branca",categoria:"Fundamentos",objetivo:"Fundamentos",nivel:"Faixa branca",frequencia:3,duracao:"60 min",icone:"🥋",descricao:"Base, postura, movimentação e segurança.",observacoes:"Priorizar técnica e controle.",exercicios:[
{nome:"Saída de quadril",grupo:"Corpo inteiro",series:3,repeticoes:"10 cada lado",carga:"Corporal",descanso:"30s"},
{nome:"Levantada técnica",grupo:"Corpo inteiro",series:3,repeticoes:"10",carga:"Corporal",descanso:"30s"},
{nome:"Queda de quadril básica",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Passagem de guarda toreando",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Escape da montada",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Armlock da guarda",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"}]},
{id:"jj_guarda_azul",nome:"Guarda — Faixa azul",categoria:"Guarda",objetivo:"Guarda",nivel:"Faixa azul",frequencia:4,duracao:"75 min",icone:"🛡️",descricao:"Retenção, raspagens e ataques da guarda.",observacoes:"Trabalhar pegadas e conexão.",exercicios:[
{nome:"Retenção de guarda",grupo:"Corpo inteiro",series:5,repeticoes:"2 min",carga:"Parceiro",descanso:"45s"},
{nome:"Raspagem tesoura",grupo:"Corpo inteiro",series:4,repeticoes:"6 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Raspagem pendular",grupo:"Corpo inteiro",series:4,repeticoes:"6 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Triângulo da guarda",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Armlock da guarda",grupo:"Corpo inteiro",series:4,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"}]},
{id:"jj_passagem",nome:"Passagem de guarda",categoria:"Passagem de guarda",objetivo:"Passagem de guarda",nivel:"Faixa azul",frequencia:4,duracao:"75 min",icone:"⚡",descricao:"Pressão, mobilidade e estabilização.",observacoes:"Controlar quadril e cabeça.",exercicios:[
{nome:"Toreando",grupo:"Corpo inteiro",series:5,repeticoes:"6 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Passagem over-under",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Passagem meia-guarda",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Estabilização lateral",grupo:"Corpo inteiro",series:4,repeticoes:"1 min",carga:"Parceiro",descanso:"30s"}]},
{id:"jj_finalizacoes",nome:"Finalizações",categoria:"Finalizações",objetivo:"Finalizações",nivel:"Faixa roxa",frequencia:4,duracao:"80 min",icone:"🎯",descricao:"Encadeamento de ataques e controle.",observacoes:"Aplicar com segurança e soltar imediatamente ao sinal.",exercicios:[
{nome:"Armlock da montada",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Estrangulamento de lapela",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Kimura da lateral",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"},
{nome:"Triângulo",grupo:"Corpo inteiro",series:5,repeticoes:"5 cada lado",carga:"Parceiro",descanso:"45s"}]},
{id:"jj_competicao",nome:"Preparação para competição",categoria:"Competição",objetivo:"Competição",nivel:"Faixa roxa",frequencia:5,duracao:"90 min",icone:"🏆",descricao:"Estratégia, rounds e situações específicas.",observacoes:"Monitorar intensidade e recuperação.",exercicios:[
{nome:"Aquecimento específico",grupo:"Corpo inteiro",series:1,repeticoes:"15 min",carga:"Corporal",descanso:"-"},
{nome:"Entrada de queda",grupo:"Corpo inteiro",series:5,repeticoes:"2 min",carga:"Parceiro",descanso:"45s"},
{nome:"Treino posicional",grupo:"Corpo inteiro",series:6,repeticoes:"3 min",carga:"Parceiro",descanso:"60s"},
{nome:"Rounds de luta",grupo:"Corpo inteiro",series:5,repeticoes:"5 min",carga:"Parceiro",descanso:"60s"}]}
];
if(typeof modelosAutomaticosTreino!=="undefined"){modelosAutomaticosTreino.splice(0,modelosAutomaticosTreino.length,...modelosJiuJitsu);filtroModeloTreinoAtual="Todos";renderizarModelosAutomaticosTreino()}


// ==========================================================
// ÁREA DO ALUNO COM ACESSO POR CPF E COMPRAS
// ==========================================================
const STUDENT_SESSION_KEY = "fitcontrol_aluno_logado";

let alunoLogadoId =
  sessionStorage.getItem(STUDENT_SESSION_KEY) ||
  localStorage.getItem(STUDENT_SESSION_KEY) ||
  "";

let carrinhoAluno = [];

textosPaginas.areaAluno = [
  "Área do aluno",
  "Acesso individual, loja, notificações e pedidos"
];

function obterAlunoLogado() {
  return alunos.find(
    (aluno) => String(aluno.id) === String(alunoLogadoId)
  );
}

function entrarAreaAluno(aluno) {
  alunoLogadoId = aluno.id;
  sessionStorage.setItem(STUDENT_SESSION_KEY, aluno.id);

  document
    .getElementById("studentAccessScreen")
    ?.classList.add("hidden");

  document
    .getElementById("studentDashboard")
    ?.classList.remove("hidden");

  carrinhoAluno = [];
  renderizarAreaAluno();
}

function sairAreaAluno() {
  alunoLogadoId = "";
  carrinhoAluno = [];

  sessionStorage.removeItem(STUDENT_SESSION_KEY);
  localStorage.removeItem(STUDENT_SESSION_KEY);

  document
    .getElementById("studentDashboard")
    ?.classList.add("hidden");

  document
    .getElementById("studentAccessScreen")
    ?.classList.remove("hidden");

  const cpfInput = document.getElementById("cpfAcessoAluno");
  const erro = document.getElementById("erroAcessoAluno");

  if (cpfInput) cpfInput.value = "";
  if (erro) erro.textContent = "";
}

document
  .getElementById("formAcessoAluno")
  ?.addEventListener("submit", (event) => {
    event.preventDefault();

    const cpf = normalizarCpf(
      document.getElementById("cpfAcessoAluno").value
    );

    const erro = document.getElementById("erroAcessoAluno");

    const aluno = alunos.find(
      (item) => normalizarCpf(item.cpf) === cpf
    );

    if (!aluno) {
      erro.textContent = "CPF não encontrado no cadastro de alunos.";
      return;
    }

    if (aluno.status !== "Ativo") {
      erro.textContent =
        "Seu cadastro está inativo. Procure a recepção da academia.";
      return;
    }

    erro.textContent = "";
    entrarAreaAluno(aluno);
  });

document
  .getElementById("sairAreaAluno")
  ?.addEventListener("click", sairAreaAluno);

function obterMatriculaAluno(alunoId) {
  return matriculas.find(
    (matricula) =>
      String(matricula.alunoId) === String(alunoId) &&
      matricula.status === "Ativo"
  );
}

function notificacoesDoAluno(alunoId) {
  return notificacoes.filter(
    (notificacao) =>
      notificacao.publico === "Todos os alunos" ||
      (
        notificacao.publico === "Aluno específico" &&
        String(notificacao.alunoId) === String(alunoId)
      )
  );
}

function pedidosDoAluno(alunoId) {
  return pedidosLoja.filter(
    (pedido) => String(pedido.alunoId) === String(alunoId)
  );
}

function renderizarResumoAluno() {
  const aluno = obterAlunoLogado();
  if (!aluno) return;

  const matricula = obterMatriculaAluno(aluno.id);
  const plano = matricula
    ? planos.find((item) => item.id === matricula.planoId)
    : null;

  const notificacoesAluno = notificacoesDoAluno(aluno.id);
  const pedidosAluno = pedidosDoAluno(aluno.id);

  document.getElementById("studentProfileAvatar").textContent =
    obterIniciaisAluno(aluno.nome);

  document.getElementById("studentProfileName").textContent =
    aluno.nome;

  document.getElementById("studentProfileDetails").textContent =
    `CPF: ${formatarCpfVisual(aluno.cpf)}` +
    (aluno.telefone ? ` • ${aluno.telefone}` : "");

  document.getElementById("studentPlanName").textContent =
    plano?.nome || "Sem plano ativo";

  document.getElementById("studentPlanStatus").textContent =
    matricula
      ? `Matrícula ${matricula.status.toLowerCase()}`
      : "Procure a recepção";

  document.getElementById("studentPlanDue").textContent =
    matricula ? formatarData(matricula.vencimento) : "—";

  document.getElementById("studentPlanDueStatus").textContent =
    matricula
      ? "Data de renovação do plano"
      : "Nenhuma matrícula ativa";

  document.getElementById("studentUnreadNotifications").textContent =
    notificacoesAluno.filter((item) => !item.lida).length;

  document.getElementById("studentOrdersCount").textContent =
    pedidosAluno.length;
}

function renderizarProdutosAreaAluno() {
  const container = document.getElementById("studentProductGrid");
  if (!container) return;

  const produtosAtivos = produtosLoja.filter(
    (produto) =>
      produto.status === "Ativo" &&
      Number(produto.estoque) > 0
  );

  container.innerHTML = produtosAtivos.length
    ? produtosAtivos.map((produto) => {
        const preco = precoProduto(produto);
        const promocao = preco < produto.preco;

        return `
          <article class="student-product-card">
            <div class="student-product-image">
              ${
                produto.imagem
                  ? `
                    <img
                      src="${escaparHtml(produto.imagem)}"
                      alt="${escaparHtml(produto.nome)}"
                    >
                  `
                  : "🥋"
              }
            </div>

            <div class="student-product-content">
              <div class="student-product-tags">
                <span>${escaparHtml(produto.categoria)}</span>
                ${
                  promocao
                    ? '<span class="promotion-tag">Promoção</span>'
                    : ""
                }
                <span>Estoque: ${produto.estoque}</span>
              </div>

              <h4>${escaparHtml(produto.nome)}</h4>

              <p>
                ${escaparHtml(
                  produto.descricao ||
                  "Produto disponível para retirada na academia."
                )}
              </p>

              <div class="product-prices">
                <strong class="product-price">
                  ${formatarMoeda(preco)}
                </strong>

                ${
                  promocao
                    ? `
                      <span class="product-old-price">
                        ${formatarMoeda(produto.preco)}
                      </span>
                    `
                    : ""
                }
              </div>

              <button
                class="btn btn-primary student-product-buy"
                type="button"
                data-student-add-product="${produto.id}"
              >
                Comprar
              </button>
            </div>
          </article>
        `;
      }).join("")
    : `
      <div class="empty" style="grid-column:1/-1;">
        Nenhum produto disponível no momento.
      </div>
    `;
}

function adicionarProdutoCarrinhoAluno(produtoId) {
  const produto = produtosLoja.find(
    (item) => String(item.id) === String(produtoId)
  );

  if (!produto || produto.status !== "Ativo" || produto.estoque <= 0) {
    mostrarAlerta("Produto indisponível.", "error");
    return;
  }

  const itemExistente = carrinhoAluno.find(
    (item) => String(item.produtoId) === String(produtoId)
  );

  if (itemExistente) {
    if (itemExistente.quantidade >= produto.estoque) {
      mostrarAlerta(
        "Você já adicionou todo o estoque disponível.",
        "error"
      );
      return;
    }

    itemExistente.quantidade += 1;
  } else {
    carrinhoAluno.push({
      produtoId,
      quantidade: 1
    });
  }

  renderizarCarrinhoAreaAluno();
  mostrarAlerta("Produto adicionado ao carrinho.");
}

function removerProdutoCarrinhoAluno(produtoId) {
  carrinhoAluno = carrinhoAluno.filter(
    (item) => String(item.produtoId) !== String(produtoId)
  );

  renderizarCarrinhoAreaAluno();
}

function renderizarCarrinhoAreaAluno() {
  const container = document.getElementById("studentCartList");
  if (!container) return;

  let total = 0;
  let quantidade = 0;

  const itensValidos = carrinhoAluno
    .map((item) => {
      const produto = produtosLoja.find(
        (produto) =>
          String(produto.id) === String(item.produtoId)
      );

      if (!produto) return null;

      const subtotal =
        precoProduto(produto) * item.quantidade;

      total += subtotal;
      quantidade += item.quantidade;

      return {
        item,
        produto,
        subtotal
      };
    })
    .filter(Boolean);

  container.innerHTML = itensValidos.length
    ? itensValidos.map(({ item, produto, subtotal }) => `
        <div class="cart-item">
          <div>
            <strong>${escaparHtml(produto.nome)}</strong>
            <small>
              ${item.quantidade} x
              ${formatarMoeda(precoProduto(produto))}
              = ${formatarMoeda(subtotal)}
            </small>
          </div>

          <button
            type="button"
            data-student-remove-product="${produto.id}"
          >
            ×
          </button>
        </div>
      `).join("")
    : '<div class="empty">Seu carrinho está vazio.</div>';

  document.getElementById("studentCartTotal").textContent =
    formatarMoeda(total);

  document.getElementById("studentCartCount").textContent =
    quantidade;
}

function finalizarCompraAreaAluno() {
  const aluno = obterAlunoLogado();

  if (!aluno) {
    mostrarAlerta(
      "Sua sessão expirou. Entre novamente usando o CPF.",
      "error"
    );
    sairAreaAluno();
    return;
  }

  if (!carrinhoAluno.length) {
    mostrarAlerta("Seu carrinho está vazio.", "error");
    return;
  }

  const itens = [];
  let total = 0;

  for (const item of carrinhoAluno) {
    const produto = produtosLoja.find(
      (produto) =>
        String(produto.id) === String(item.produtoId)
    );

    if (!produto || item.quantidade > produto.estoque) {
      mostrarAlerta(
        `Estoque insuficiente para ${
          produto?.nome || "um dos produtos"
        }.`,
        "error"
      );
      renderizarProdutosAreaAluno();
      return;
    }

    const preco = precoProduto(produto);

    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      quantidade: item.quantidade,
      preco
    });

    total += preco * item.quantidade;
  }

  const codigo =
    `PED-${Date.now().toString().slice(-6)}`;

  const pedido = {
    id: gerarId(),
    codigo,
    alunoId: aluno.id,
    itens,
    total,
    pagamento:
      document.getElementById("studentPaymentMethod").value,
    formaPagamento:
      document.getElementById("studentPaymentMethod").value,
    retirada: "Retirada na academia",
    status: "Aguardando separação",
    criadoEm: new Date().toISOString()
  };

  pedidosLoja.unshift(pedido);

  produtosLoja = produtosLoja.map((produto) => {
    const itemComprado = carrinhoAluno.find(
      (item) =>
        String(item.produtoId) === String(produto.id)
    );

    return itemComprado
      ? {
          ...produto,
          estoque:
            produto.estoque - itemComprado.quantidade
        }
      : produto;
  });

  carrinhoAluno = [];

  salvar(PEDIDOS_STORAGE_KEY, pedidosLoja);
  salvar(PRODUTOS_STORAGE_KEY, produtosLoja);

  criarNotificacao({
    tipo: "Venda",
    titulo: "Nova venda na área do aluno",
    mensagem:
      `${aluno.nome} realizou o pedido ${codigo} ` +
      `no valor de ${formatarMoeda(total)}. ` +
      "O pedido será retirado na academia.",
    publico: "Administrador"
  });

  criarNotificacao({
    tipo: "Venda",
    titulo: "Compra confirmada",
    mensagem:
      `Seu pedido ${codigo} foi confirmado no valor de ` +
      `${formatarMoeda(total)}. Aguarde a academia separar ` +
      "os produtos para retirada.",
    publico: "Aluno específico",
    alunoId: aluno.id
  });

  renderizarProdutos();
  renderizarPedidos();
  renderizarNotificacoes();
  renderizarAreaAluno();

  mostrarAlerta(
    "Compra confirmada. A academia recebeu o alerta."
  );
}

function renderizarNotificacoesAreaAluno() {
  const aluno = obterAlunoLogado();
  const container =
    document.getElementById("studentNotificationsList");

  if (!aluno || !container) return;

  const notificacoesAluno =
    notificacoesDoAluno(aluno.id);

  container.innerHTML = notificacoesAluno.length
    ? notificacoesAluno.map((notificacao) => `
        <article class="notification-card ${
          notificacao.lida ? "" : "unread"
        }">
          <div class="notification-icon">🔔</div>

          <div class="notification-content">
            <strong>
              ${escaparHtml(notificacao.titulo)}
            </strong>

            <p>
              ${escaparHtml(notificacao.mensagem)}
            </p>

            <small>
              ${escaparHtml(notificacao.tipo)} •
              ${new Date(
                notificacao.criadaEm
              ).toLocaleString("pt-BR")}
            </small>
          </div>

          <div class="notification-actions">
            ${
              notificacao.lida
                ? ""
                : `
                  <button
                    type="button"
                    data-student-read-notification="${
                      notificacao.id
                    }"
                  >
                    Marcar como lida
                  </button>
                `
            }
          </div>
        </article>
      `).join("")
    : '<div class="empty">Nenhuma notificação para você.</div>';
}

function marcarNotificacaoAlunoComoLida(id) {
  notificacoes = notificacoes.map((notificacao) =>
    String(notificacao.id) === String(id)
      ? {
          ...notificacao,
          lida: true
        }
      : notificacao
  );

  salvar(NOTIFICACOES_STORAGE_KEY, notificacoes);
  renderizarNotificacoes();
  renderizarAreaAluno();
}

function renderizarPedidosAreaAluno() {
  const aluno = obterAlunoLogado();
  const container =
    document.getElementById("studentOrdersList");

  if (!aluno || !container) return;

  const pedidosAluno = pedidosDoAluno(aluno.id);

  container.innerHTML = pedidosAluno.length
    ? pedidosAluno.map((pedido) => `
        <article class="student-order-card">
          <div class="student-order-card-header">
            <strong>${escaparHtml(pedido.codigo)}</strong>
            <span class="status pendente">
              ${escaparHtml(
                pedido.status || "Aguardando separação"
              )}
            </span>
          </div>

          <p>
            ${pedido.itens
              .map(
                (item) =>
                  `${item.quantidade}x ${escaparHtml(item.nome)}`
              )
              .join("<br>")}
          </p>

          <small>
            ${formatarMoeda(pedido.total)} •
            ${escaparHtml(
              pedido.formaPagamento ||
              pedido.pagamento ||
              "-"
            )} •
            Retirada na academia •
            ${new Date(
              pedido.criadoEm
            ).toLocaleString("pt-BR")}
          </small>
        </article>
      `).join("")
    : '<div class="empty">Você ainda não realizou compras.</div>';
}

function renderizarAreaAluno() {
  const aluno = obterAlunoLogado();

  if (!aluno) return;

  renderizarResumoAluno();
  renderizarProdutosAreaAluno();
  renderizarCarrinhoAreaAluno();
  renderizarNotificacoesAreaAluno();
  renderizarPedidosAreaAluno();
}

document.addEventListener("click", (event) => {
  const adicionar = event.target.closest(
    "[data-student-add-product]"
  );

  if (adicionar) {
    adicionarProdutoCarrinhoAluno(
      adicionar.dataset.studentAddProduct
    );
    return;
  }

  const remover = event.target.closest(
    "[data-student-remove-product]"
  );

  if (remover) {
    removerProdutoCarrinhoAluno(
      remover.dataset.studentRemoveProduct
    );
    return;
  }

  const ler = event.target.closest(
    "[data-student-read-notification]"
  );

  if (ler) {
    marcarNotificacaoAlunoComoLida(
      ler.dataset.studentReadNotification
    );
  }
});

document
  .getElementById("studentCheckoutButton")
  ?.addEventListener(
    "click",
    finalizarCompraAreaAluno
  );

const atualizarTudoAntesDaAreaAluno = atualizarTudo;

atualizarTudo = function() {
  atualizarTudoAntesDaAreaAluno();

  if (alunoLogadoId && obterAlunoLogado()) {
    document
      .getElementById("studentAccessScreen")
      ?.classList.add("hidden");

    document
      .getElementById("studentDashboard")
      ?.classList.remove("hidden");

    renderizarAreaAluno();
  }
};

if (alunoLogadoId && obterAlunoLogado()) {
  document
    .getElementById("studentAccessScreen")
    ?.classList.add("hidden");

  document
    .getElementById("studentDashboard")
    ?.classList.remove("hidden");

  renderizarAreaAluno();
}

const PAYMENT_ALERT_CONTROL_KEY="champion_team_alertas_mensalidade";

function mensagemMensalidadeChampion(aluno,matricula){
  return `Passando para lembrar que a mensalidade do treino de Jiu-Jitsu do aluno ${aluno.nome} encontra-se em aberto.

Pedimos a gentileza de verificar a situação e, se possível, realizar o pagamento para manter a matrícula ativa e garantir a continuidade dos treinos.

Caso o pagamento já tenha sido realizado, por favor, desconsidere esta mensagem e nos envie o comprovante para atualização do sistema.

Qualquer dúvida, estamos à disposição.

Equipe Champion Team 🥋`;
}

function gerarAlertaAutomaticoMensalidade(aluno,matricula){
  if(!aluno||!matricula)return;
  const vencimento=matricula.proximaMensalidade||matricula.vencimento;
  if(!vencimento||vencimento>=hojeIso())return;

  const existe=notificacoes.some(n=>
    n.tipo==="Mensalidade" &&
    String(n.alunoId)===String(aluno.id) &&
    n.referenciaVencimento===vencimento
  );

  if(!existe){
    notificacoes.unshift({
      id:gerarId(),
      tipo:"Mensalidade",
      titulo:"Mensalidade em aberto",
      mensagem:mensagemMensalidadeChampion(aluno,matricula),
      publico:"Aluno específico",
      alunoId:aluno.id,
      prioridade:"Alta",
      lida:false,
      referenciaVencimento:vencimento,
      criadaEm:new Date().toISOString()
    });

    notificacoes.unshift({
      id:gerarId(),
      tipo:"Mensalidade",
      titulo:"Aluno com mensalidade em aberto",
      mensagem:`${aluno.nome} possui mensalidade vencida desde ${formatarData(vencimento)}.`,
      publico:"Administrador",
      alunoId:aluno.id,
      prioridade:"Alta",
      lida:false,
      referenciaVencimento:vencimento,
      criadaEm:new Date().toISOString()
    });

    salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);
  }
}

function atualizarAlertaVisualMensalidadeAluno(){
  const aluno=obterAlunoLogado();
  const alerta=document.getElementById("studentPaymentAlert");
  if(!aluno||!alerta)return;

  const matricula=matriculas.find(m=>String(m.alunoId)===String(aluno.id));
  if(!matricula){
    alerta.classList.add("hidden");
    return;
  }

  const vencimento=matricula.proximaMensalidade||matricula.vencimento;
  const emAberto=vencimento&&vencimento<hojeIso();

  if(!emAberto){
    alerta.classList.add("hidden");
    return;
  }

  gerarAlertaAutomaticoMensalidade(aluno,matricula);

  const titulo=document.getElementById("studentPaymentAlertTitle");
  if(titulo){
    titulo.textContent=`Mensalidade vencida em ${formatarData(vencimento)}`;
  }

  alerta.classList.remove("hidden");
}

document.getElementById("studentPaymentContactButton")?.addEventListener("click",()=>{
  const aluno=obterAlunoLogado();
  const matricula=aluno?matriculas.find(m=>String(m.alunoId)===String(aluno.id)):null;
  if(!aluno||!matricula)return;

  navigator.clipboard?.writeText(mensagemMensalidadeChampion(aluno,matricula))
    .then(()=>mostrarAlerta("Mensagem copiada."))
    .catch(()=>mostrarAlerta("Procure a recepção para regularizar.","error"));
});

const renderizarAreaAlunoChampionOriginal=renderizarAreaAluno;
renderizarAreaAluno=function(){
  renderizarAreaAlunoChampionOriginal();
  atualizarAlertaVisualMensalidadeAluno();
};


/* =========================================================
   MÓDULO CHAMPION TEAM — GESTÃO DE GRADUAÇÕES
   LocalStorage hoje; estrutura pronta para futura migração.
========================================================= */
const GRADUATION_KEYS = {
  graduacoes: "champion_team_graduacoes",
  regras: "champion_team_regras_graduacao",
  historico: "champion_team_historico_graduacao",
  exames: "champion_team_exames_graduacao"
};

let graduacoes = carregar(GRADUATION_KEYS.graduacoes);
let regrasGraduacao = carregar(GRADUATION_KEYS.regras);
let historicoGraduacoes = carregar(GRADUATION_KEYS.historico);
let examesGraduacao = carregar(GRADUATION_KEYS.exames);

if (!regrasGraduacao.length) {
  regrasGraduacao = [
    { id: gerarId(), categoria: "Infantil", faixa: "Cinza", graus: 4, dias: 60 },
    { id: gerarId(), categoria: "Infantil", faixa: "Amarela", graus: 4, dias: 90 },
    { id: gerarId(), categoria: "Infantil", faixa: "Laranja", graus: 4, dias: 90 },
    { id: gerarId(), categoria: "Infantil", faixa: "Verde", graus: 4, dias: 120 },
    { id: gerarId(), categoria: "Juvenil", faixa: "Branca", graus: 4, dias: 90 },
    { id: gerarId(), categoria: "Juvenil", faixa: "Azul", graus: 4, dias: 180 },
    { id: gerarId(), categoria: "Adulto", faixa: "Branca", graus: 4, dias: 120 },
    { id: gerarId(), categoria: "Adulto", faixa: "Azul", graus: 4, dias: 180 },
    { id: gerarId(), categoria: "Adulto", faixa: "Roxa", graus: 4, dias: 180 },
    { id: gerarId(), categoria: "Adulto", faixa: "Marrom", graus: 4, dias: 180 },
    { id: gerarId(), categoria: "Adulto", faixa: "Preta", graus: 6, dias: 365 }
  ];
  salvar(GRADUATION_KEYS.regras, regrasGraduacao);
}

function diasEntreDatas(inicioIso, fimIso = hojeIso()) {
  if (!inicioIso) return 0;
  const inicio = new Date(inicioIso + "T00:00:00");
  const fim = new Date(fimIso + "T00:00:00");
  return Math.max(0, Math.floor((fim - inicio) / 86400000));
}

function obterAlunoPorId(id) {
  return alunos.find(a => String(a.id) === String(id));
}

function obterRegraGraduacao(graduacao) {
  if (!graduacao) return null;
  return regrasGraduacao.find(r =>
    r.categoria === graduacao.categoria &&
    String(r.faixa).toLowerCase() === String(graduacao.faixa).toLowerCase()
  ) || null;
}

function obterGraduacaoAluno(alunoId) {
  return graduacoes.find(g => String(g.alunoId) === String(alunoId));
}

function calcularStatusGraduacao(graduacao) {
  const regra = obterRegraGraduacao(graduacao);
  const diasPassados = diasEntreDatas(graduacao?.ultimoAvanco || graduacao?.dataFaixa);
  const referencia = Number(regra?.dias || 0);
  const faltam = Math.max(0, referencia - diasPassados);
  return {
    regra,
    diasPassados,
    referencia,
    faltam,
    apto: referencia > 0 && diasPassados >= referencia,
    proximo: referencia > 0 && faltam > 0 && faltam <= 30
  };
}

function faixaCorClasse(faixa) {
  const nome = String(faixa || "").toLowerCase();
  if (nome.includes("branca")) return "belt-white";
  if (nome.includes("azul")) return "belt-blue";
  if (nome.includes("roxa")) return "belt-purple";
  if (nome.includes("marrom")) return "belt-brown";
  if (nome.includes("preta")) return "belt-black";
  if (nome.includes("cinza")) return "belt-gray";
  if (nome.includes("amarela")) return "belt-yellow";
  if (nome.includes("laranja")) return "belt-orange";
  if (nome.includes("verde")) return "belt-green";
  return "belt-neutral";
}

function listaFaixasDisponiveis(categoria) {
  const faixas = regrasGraduacao
    .filter(r => r.categoria === categoria)
    .map(r => r.faixa);
  return [...new Set(faixas)];
}

function preencherSelectGraduacaoAlunos() {
  const ids = ["graduacaoAlunoId", "graduacaoEvolucaoAluno", "historicoGraduacaoAluno"];
  ids.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const valor = select.value;
    const inicial = id === "historicoGraduacaoAluno"
      ? '<option value="">Todos os alunos</option>'
      : '<option value="">Selecione um aluno</option>';
    select.innerHTML = inicial + alunos
      .slice()
      .sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(a => `<option value="${a.id}">${a.nome}</option>`)
      .join("");
    if ([...select.options].some(o => o.value === valor)) select.value = valor;
  });

  const professor = document.getElementById("graduacaoProfessor");
  if (professor) {
    const listaProfessores = typeof professores !== "undefined" ? professores : [];
    professor.innerHTML = '<option value="">Equipe de professores</option>' +
      listaProfessores.map(p => `<option value="${p.id}">${p.nome}</option>`).join("");
  }
}

function preencherFaixasGraduacao() {
  const categoria = document.getElementById("graduacaoCategoria")?.value || "Adulto";
  const select = document.getElementById("graduacaoFaixa");
  if (!select) return;
  const atual = select.value;
  const faixas = listaFaixasDisponiveis(categoria);
  select.innerHTML = faixas.map(f => `<option value="${f}">${f}</option>`).join("");
  if (faixas.includes(atual)) select.value = atual;
}

function renderizarResumoGraduacaoAluno() {
  const alunoId = document.getElementById("graduacaoEvolucaoAluno")?.value;
  const container = document.getElementById("graduacaoResumoAluno");
  if (!container) return;
  const aluno = obterAlunoPorId(alunoId);
  const grad = obterGraduacaoAluno(alunoId);

  if (!aluno) {
    container.innerHTML = '<div class="empty-state">Selecione um aluno para visualizar a evolução.</div>';
    return;
  }
  if (!grad) {
    container.innerHTML = `<div class="empty-state">${aluno.nome} ainda não possui graduação cadastrada.</div>`;
    return;
  }

  const status = calcularStatusGraduacao(grad);
  container.innerHTML = `
    <div class="belt-badge ${faixaCorClasse(grad.faixa)}"><span></span>${grad.faixa} · ${grad.grau || 0}º grau</div>
    <h4>${aluno.nome}</h4>
    <div class="graduation-mini-grid">
      <div><small>Categoria</small><strong>${grad.categoria}</strong></div>
      <div><small>Último avanço</small><strong>${formatarData(grad.ultimoAvanco)}</strong></div>
      <div><small>Tempo decorrido</small><strong>${status.diasPassados} dias</strong></div>
      <div><small>Status</small><strong class="${status.apto ? "status-ready" : ""}">${status.apto ? "Apto para análise" : `Faltam ${status.faltam} dias`}</strong></div>
    </div>
    ${grad.observacoes ? `<p class="graduation-note">${grad.observacoes}</p>` : ""}
  `;
}

function renderizarPainelGraduacoes() {
  const acompanhados = graduacoes.filter(g => obterAlunoPorId(g.alunoId));
  const aptos = acompanhados.filter(g => calcularStatusGraduacao(g).apto);
  const proximos = acompanhados.filter(g => calcularStatusGraduacao(g).proximo);
  const futurosExames = examesGraduacao.filter(e => e.data >= hojeIso());

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText("graduacaoTotalAptos", aptos.length);
  setText("gradTotalAlunos", acompanhados.length);
  setText("gradAptos", aptos.length);
  setText("gradProximos", proximos.length);
  setText("gradExames", futurosExames.length);
  setText("menuGraduacaoBadge", aptos.length);

  const listaAptos = document.getElementById("listaGraduacaoAptos");
  if (listaAptos) {
    listaAptos.innerHTML = aptos.length ? aptos.map(g => {
      const aluno = obterAlunoPorId(g.alunoId);
      const s = calcularStatusGraduacao(g);
      return `<article class="graduation-list-item">
        <div><span class="belt-dot ${faixaCorClasse(g.faixa)}"></span><strong>${aluno?.nome || "Aluno"}</strong><small>${g.faixa} · ${g.grau || 0}º grau · ${s.diasPassados} dias</small></div>
        <span class="graduation-status ready">Apto para análise</span>
      </article>`;
    }).join("") : '<div class="empty-state">Nenhum aluno atingiu a referência de tempo.</div>';
  }

  const listaProximos = document.getElementById("listaGraduacaoProximos");
  if (listaProximos) {
    listaProximos.innerHTML = proximos.length ? proximos
      .sort((a,b) => calcularStatusGraduacao(a).faltam - calcularStatusGraduacao(b).faltam)
      .map(g => {
        const aluno = obterAlunoPorId(g.alunoId);
        const s = calcularStatusGraduacao(g);
        return `<article class="graduation-list-item">
          <div><span class="belt-dot ${faixaCorClasse(g.faixa)}"></span><strong>${aluno?.nome || "Aluno"}</strong><small>${g.faixa} · ${g.grau || 0}º grau</small></div>
          <span class="graduation-status waiting">${s.faltam} dias</span>
        </article>`;
      }).join("") : '<div class="empty-state">Nenhum aluno está a menos de 30 dias da referência.</div>';
  }

  const mapa = document.getElementById("mapaFaixas");
  if (mapa) {
    const contagem = acompanhados.reduce((acc, g) => {
      acc[g.faixa] = (acc[g.faixa] || 0) + 1;
      return acc;
    }, {});
    mapa.innerHTML = Object.keys(contagem).length
      ? Object.entries(contagem).sort((a,b) => b[1]-a[1]).map(([faixa,total]) =>
        `<article class="belt-map-card ${faixaCorClasse(faixa)}"><span class="belt-strip"></span><div><strong>${total}</strong><small>Faixa ${faixa}</small></div></article>`
      ).join("")
      : '<div class="empty-state">Cadastre a graduação dos alunos para gerar o mapa.</div>';
  }
}

function renderizarRegrasGraduacao() {
  const tbody = document.getElementById("tabelaRegrasGraduacao");
  if (!tbody) return;
  tbody.innerHTML = regrasGraduacao.length ? regrasGraduacao
    .slice()
    .sort((a,b) => a.categoria.localeCompare(b.categoria) || a.faixa.localeCompare(b.faixa))
    .map(r => `<tr>
      <td>${r.categoria}</td><td><span class="belt-table ${faixaCorClasse(r.faixa)}"></span>${r.faixa}</td>
      <td>${r.graus}</td><td>${r.dias} dias</td>
      <td><button class="table-action" onclick="editarRegraGraduacao('${r.id}')">Editar</button>
      <button class="table-action danger" onclick="excluirRegraGraduacao('${r.id}')">Excluir</button></td>
    </tr>`).join("")
    : '<tr><td colspan="5"><div class="empty-state">Nenhuma regra cadastrada.</div></td></tr>';
}

window.editarRegraGraduacao = function(id) {
  const r = regrasGraduacao.find(item => item.id === id);
  if (!r) return;
  document.getElementById("regraGraduacaoEditor")?.classList.remove("hidden");
  document.getElementById("regraGraduacaoId").value = r.id;
  document.getElementById("regraCategoria").value = r.categoria;
  document.getElementById("regraFaixa").value = r.faixa;
  document.getElementById("regraGraus").value = r.graus;
  document.getElementById("regraDias").value = r.dias;
};

window.excluirRegraGraduacao = function(id) {
  if (!confirm("Excluir esta regra de referência?")) return;
  regrasGraduacao = regrasGraduacao.filter(r => r.id !== id);
  salvar(GRADUATION_KEYS.regras, regrasGraduacao);
  renderizarTudoGraduacoes();
  mostrarAlerta("Regra excluída.");
};

function renderizarExamesGraduacao() {
  const participantes = document.getElementById("exameGraduacaoParticipantes");
  if (participantes) {
    participantes.innerHTML = alunos.length ? alunos
      .slice().sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"))
      .map(a => `<label class="participant-option"><input type="checkbox" value="${a.id}"><span>${a.nome}</span></label>`)
      .join("") : '<div class="empty-state">Cadastre alunos antes de criar um exame.</div>';
  }

  const lista = document.getElementById("listaExamesGraduacao");
  if (!lista) return;
  lista.innerHTML = examesGraduacao.length ? examesGraduacao
    .slice().sort((a,b)=>b.data.localeCompare(a.data))
    .map(e => `<article class="exam-card">
      <div class="exam-date"><strong>${new Date(e.data+"T00:00:00").getDate()}</strong><span>${new Date(e.data+"T00:00:00").toLocaleDateString("pt-BR",{month:"short"}).replace(".","")}</span></div>
      <div class="exam-info"><h4>Exame de graduação</h4><p>${e.local} · ${e.avaliadores}</p><small>${e.participantes.length} participante(s)</small></div>
      <button class="table-action danger" type="button" onclick="excluirExameGraduacao('${e.id}')">Excluir</button>
    </article>`).join("")
    : '<div class="empty-state">Nenhum exame de graduação agendado.</div>';
}

window.excluirExameGraduacao = function(id) {
  if (!confirm("Excluir este exame?")) return;
  examesGraduacao = examesGraduacao.filter(e => e.id !== id);
  salvar(GRADUATION_KEYS.exames, examesGraduacao);
  renderizarTudoGraduacoes();
  mostrarAlerta("Exame excluído.");
};

function renderizarHistoricoGraduacoes() {
  const filtro = document.getElementById("historicoGraduacaoAluno")?.value || "";
  const timeline = document.getElementById("timelineGraduacoes");
  if (!timeline) return;
  const lista = historicoGraduacoes
    .filter(h => !filtro || String(h.alunoId) === String(filtro))
    .slice().sort((a,b)=>String(b.data).localeCompare(String(a.data)));

  timeline.innerHTML = lista.length ? lista.map(h => {
    const aluno = obterAlunoPorId(h.alunoId);
    return `<article class="timeline-item">
      <div class="timeline-marker ${faixaCorClasse(h.faixa)}"></div>
      <div class="timeline-body">
        <div class="timeline-heading"><strong>${aluno?.nome || "Aluno removido"}</strong><time>${formatarData(h.data)}</time></div>
        <h4>${h.evento}</h4>
        <p>${h.professor ? `Responsável: ${h.professor}` : "Registro da equipe técnica"}</p>
        ${h.observacoes ? `<small>${h.observacoes}</small>` : ""}
      </div>
    </article>`;
  }).join("") : '<div class="empty-state">Nenhum registro de graduação encontrado.</div>';
}

function renderizarTudoGraduacoes() {
  preencherSelectGraduacaoAlunos();
  preencherFaixasGraduacao();
  renderizarPainelGraduacoes();
  renderizarResumoGraduacaoAluno();
  renderizarRegrasGraduacao();
  renderizarExamesGraduacao();
  renderizarHistoricoGraduacoes();
}

document.querySelectorAll(".graduation-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".graduation-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".graduation-tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    const id = "graduationTab" + btn.dataset.graduationTab.charAt(0).toUpperCase() + btn.dataset.graduationTab.slice(1);
    document.getElementById(id)?.classList.add("active");
  });
});

document.getElementById("graduacaoCategoria")?.addEventListener("change", preencherFaixasGraduacao);
document.getElementById("graduacaoEvolucaoAluno")?.addEventListener("change", renderizarResumoGraduacaoAluno);
document.getElementById("historicoGraduacaoAluno")?.addEventListener("change", renderizarHistoricoGraduacoes);

document.getElementById("graduacaoAlunoId")?.addEventListener("change", event => {
  const grad = obterGraduacaoAluno(event.target.value);
  if (!grad) {
    document.getElementById("graduacaoDataFaixa").value = hojeIso();
    document.getElementById("graduacaoUltimoAvanco").value = hojeIso();
    return;
  }
  document.getElementById("graduacaoCategoria").value = grad.categoria;
  preencherFaixasGraduacao();
  document.getElementById("graduacaoFaixa").value = grad.faixa;
  document.getElementById("graduacaoGrau").value = String(grad.grau || 0);
  document.getElementById("graduacaoDataFaixa").value = grad.dataFaixa;
  document.getElementById("graduacaoUltimoAvanco").value = grad.ultimoAvanco;
  document.getElementById("graduacaoProfessor").value = grad.professorId || "";
  document.getElementById("graduacaoObservacoes").value = grad.observacoes || "";
});

document.getElementById("formGraduacaoAluno")?.addEventListener("submit", event => {
  event.preventDefault();
  const alunoId = document.getElementById("graduacaoAlunoId").value;
  if (!alunoId) return mostrarAlerta("Selecione um aluno.", "error");

  const existente = obterGraduacaoAluno(alunoId);
  const dados = {
    id: existente?.id || gerarId(),
    alunoId,
    categoria: document.getElementById("graduacaoCategoria").value,
    faixa: document.getElementById("graduacaoFaixa").value,
    grau: Number(document.getElementById("graduacaoGrau").value),
    dataFaixa: document.getElementById("graduacaoDataFaixa").value,
    ultimoAvanco: document.getElementById("graduacaoUltimoAvanco").value,
    professorId: document.getElementById("graduacaoProfessor").value,
    observacoes: document.getElementById("graduacaoObservacoes").value.trim()
  };

  if (existente) graduacoes = graduacoes.map(g => g.id === existente.id ? dados : g);
  else graduacoes.push(dados);

  if (!existente) {
    historicoGraduacoes.push({
      id: gerarId(), alunoId, data: dados.dataFaixa, faixa: dados.faixa,
      evento: `Graduação cadastrada: faixa ${dados.faixa}, ${dados.grau}º grau`,
      professor: document.getElementById("graduacaoProfessor").selectedOptions[0]?.textContent || "",
      observacoes: dados.observacoes
    });
  }

  salvar(GRADUATION_KEYS.graduacoes, graduacoes);
  salvar(GRADUATION_KEYS.historico, historicoGraduacoes);
  renderizarTudoGraduacoes();
  document.getElementById("graduacaoEvolucaoAluno").value = alunoId;
  renderizarResumoGraduacaoAluno();
  mostrarAlerta("Graduação salva com sucesso.");
});

document.getElementById("btnAdicionarGrau")?.addEventListener("click", () => {
  const alunoId = document.getElementById("graduacaoEvolucaoAluno").value;
  const grad = obterGraduacaoAluno(alunoId);
  if (!grad) return mostrarAlerta("Cadastre a graduação atual do aluno primeiro.", "error");
  const regra = obterRegraGraduacao(grad);
  const maxGraus = Number(regra?.graus || 4);
  if (Number(grad.grau || 0) >= maxGraus) {
    return mostrarAlerta("O aluno já atingiu o limite de graus desta faixa. Avalie a promoção de faixa.", "error");
  }
  if (!confirm(`Confirmar o avanço para o ${Number(grad.grau || 0) + 1}º grau?`)) return;
  grad.grau = Number(grad.grau || 0) + 1;
  grad.ultimoAvanco = hojeIso();
  const aluno = obterAlunoPorId(alunoId);
  historicoGraduacoes.push({
    id: gerarId(), alunoId, data: hojeIso(), faixa: grad.faixa,
    evento: `Recebeu o ${grad.grau}º grau na faixa ${grad.faixa}`,
    professor: "Equipe técnica Champion Team",
    observacoes: ""
  });
  salvar(GRADUATION_KEYS.graduacoes, graduacoes);
  salvar(GRADUATION_KEYS.historico, historicoGraduacoes);
  renderizarTudoGraduacoes();
  mostrarAlerta(`${aluno?.nome || "Aluno"} avançou para o ${grad.grau}º grau.`);
});

function proximaFaixa(graduacao) {
  const faixas = listaFaixasDisponiveis(graduacao.categoria);
  const indice = faixas.findIndex(f => f === graduacao.faixa);
  return indice >= 0 && indice < faixas.length - 1 ? faixas[indice + 1] : null;
}

document.getElementById("btnPromoverFaixa")?.addEventListener("click", () => {
  const alunoId = document.getElementById("graduacaoEvolucaoAluno").value;
  const grad = obterGraduacaoAluno(alunoId);
  if (!grad) return mostrarAlerta("Cadastre a graduação atual do aluno primeiro.", "error");
  const novaFaixa = proximaFaixa(grad);
  if (!novaFaixa) return mostrarAlerta("Não há próxima faixa configurada para esta categoria.", "error");
  if (!confirm(`Confirmar a promoção da faixa ${grad.faixa} para ${novaFaixa}?`)) return;
  const anterior = grad.faixa;
  grad.faixa = novaFaixa;
  grad.grau = 0;
  grad.dataFaixa = hojeIso();
  grad.ultimoAvanco = hojeIso();
  const aluno = obterAlunoPorId(alunoId);
  historicoGraduacoes.push({
    id: gerarId(), alunoId, data: hojeIso(), faixa: novaFaixa,
    evento: `Promovido da faixa ${anterior} para a faixa ${novaFaixa}`,
    professor: "Equipe técnica Champion Team",
    observacoes: ""
  });
  salvar(GRADUATION_KEYS.graduacoes, graduacoes);
  salvar(GRADUATION_KEYS.historico, historicoGraduacoes);
  renderizarTudoGraduacoes();
  mostrarAlerta(`${aluno?.nome || "Aluno"} foi promovido para a faixa ${novaFaixa}.`);
});

document.getElementById("btnNovaRegraGraduacao")?.addEventListener("click", () => {
  document.getElementById("formRegraGraduacao")?.reset();
  document.getElementById("regraGraduacaoId").value = "";
  document.getElementById("regraGraus").value = "4";
  document.getElementById("regraDias").value = "90";
  document.getElementById("regraGraduacaoEditor")?.classList.remove("hidden");
});

document.getElementById("btnCancelarRegraGraduacao")?.addEventListener("click", () => {
  document.getElementById("regraGraduacaoEditor")?.classList.add("hidden");
});

document.getElementById("formRegraGraduacao")?.addEventListener("submit", event => {
  event.preventDefault();
  const id = document.getElementById("regraGraduacaoId").value;
  const dados = {
    id: id || gerarId(),
    categoria: document.getElementById("regraCategoria").value,
    faixa: document.getElementById("regraFaixa").value.trim(),
    graus: Number(document.getElementById("regraGraus").value),
    dias: Number(document.getElementById("regraDias").value)
  };
  if (id) regrasGraduacao = regrasGraduacao.map(r => r.id === id ? dados : r);
  else regrasGraduacao.push(dados);
  salvar(GRADUATION_KEYS.regras, regrasGraduacao);
  document.getElementById("regraGraduacaoEditor")?.classList.add("hidden");
  renderizarTudoGraduacoes();
  mostrarAlerta("Regra de referência salva.");
});

document.getElementById("formExameGraduacao")?.addEventListener("submit", event => {
  event.preventDefault();
  const marcados = [...document.querySelectorAll("#exameGraduacaoParticipantes input:checked")].map(i => i.value);
  if (!marcados.length) return mostrarAlerta("Selecione ao menos um participante.", "error");
  examesGraduacao.push({
    id: gerarId(),
    data: document.getElementById("exameGraduacaoData").value,
    local: document.getElementById("exameGraduacaoLocal").value.trim(),
    avaliadores: document.getElementById("exameGraduacaoAvaliadores").value.trim(),
    participantes: marcados,
    status: "Agendado"
  });
  salvar(GRADUATION_KEYS.exames, examesGraduacao);
  event.target.reset();
  document.getElementById("exameGraduacaoLocal").value = "Champion Team";
  renderizarTudoGraduacoes();
  mostrarAlerta("Exame de graduação agendado.");
});

const atualizarTudoAntesGraduacao = atualizarTudo;
atualizarTudo = function() {
  atualizarTudoAntesGraduacao();
  renderizarTudoGraduacoes();
};

document.getElementById("graduacaoDataFaixa") && (document.getElementById("graduacaoDataFaixa").value = hojeIso());
document.getElementById("graduacaoUltimoAvanco") && (document.getElementById("graduacaoUltimoAvanco").value = hojeIso());
document.getElementById("exameGraduacaoData") && (document.getElementById("exameGraduacaoData").value = hojeIso());
renderizarTudoGraduacoes();