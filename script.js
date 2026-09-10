
window.addEventListener("error", (event) => {
  console.error("Erro global Champion Team:", event.error || event.message);

  const mensagem = event.error?.message || event.message || "Erro inesperado no sistema.";
  window.atualizarStatusSupabase?.(
    "error",
    `Falha ao iniciar: ${mensagem}`
  );
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Promise rejeitada:", event.reason);

  const mensagem = event.reason?.message || String(event.reason || "Falha inesperada.");
  window.atualizarStatusSupabase?.(
    "error",
    `Falha de conexão: ${mensagem}`
  );
});


window.CHAMPION_APP_VERSION = "37.5";

(async function limparVersaoAntigaChampionTeam() {
  try {
    if ("serviceWorker" in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations();
      for (const registro of registros) {
        await registro.unregister();
      }
    }

    if ("caches" in window) {
      const nomes = await caches.keys();
      await Promise.all(
        nomes
          .filter((nome) => nome.toLowerCase().includes("champion"))
          .map((nome) => caches.delete(nome))
      );
    }
  } catch (erro) {
    console.info("Limpeza de cache não necessária:", erro);
  }
})();

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
      const serializado = JSON.stringify(lista);
      const anterior = localStorage.getItem(chave);

      localStorage.setItem(chave, serializado);

      // Dados recebidos do Supabase não podem ser enviados de volta.
      // Isso elimina o ciclo: onSnapshot → atualizarTudo → salvar → onSnapshot.
      if (window.__CHAMPION_APLICANDO_FIREBASE__) return;

      // Não grava novamente quando nada realmente mudou.
      if (anterior === serializado) return;

      localStorage.setItem(`champion_sync_meta_${chave}`, String(agora));

      if (typeof window.supabaseCloudSave === "function") {
        window.supabaseCloudSave(chave, lista, agora).catch((erro) => {
          console.error("Falha ao sincronizar com Supabase:", erro);
          window.atualizarStatusSupabase?.(
            "offline",
            "Alteração mantida no aparelho. Tentaremos sincronizar novamente."
          );
        });
      }
    }

    
function comTimeout(promessa, milissegundos, mensagem) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(mensagem)),
        milissegundos
      );
    })
  ]);
}

function gerarId() {
      return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString() + Math.random().toString(16).slice(2);
    }

    function senhaPadraoCpf(cpf) {
      return normalizarCpf(cpf).slice(0, 6);
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
      if (!alerta) return;

      alerta.textContent = mensagem;
      alerta.className = `alert ${tipo} show`;
      alerta.setAttribute("role", tipo === "error" ? "alert" : "status");
      alerta.setAttribute("aria-live", tipo === "error" ? "assertive" : "polite");

      clearTimeout(window.alertTimer);
      window.alertTimer = setTimeout(() => {
        alerta.classList.remove("show");
      }, 4600);
    }



/* =========================================================
   PONTE FIREBASE
   Recebe dados em tempo real do Supabase e atualiza as
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
  champion_team_exames_graduacao: "examesGraduacao",
  champion_team_indicacoes_faixa: "indicacoesFaixa"
};

window.CHAMPION_SUPABASE_KEYS = Object.keys(FIREBASE_STORAGE_VARIABLES);
window.CHAMPION_SUPABASE_READY = false;
let resolverSupabasePronto;

window.CHAMPION_SUPABASE_READY_PROMISE = new Promise((resolve) => {
  resolverSupabasePronto = resolve;
});

window.marcarSupabasePronto = function() {
  if (window.CHAMPION_SUPABASE_READY) return;
  window.CHAMPION_SUPABASE_READY = true;
  resolverSupabasePronto?.(true);
  window.dispatchEvent(new CustomEvent("champion-supabase-ready"));
};

window.aguardarSupabasePronto = function(timeoutMs = 20000) {
  if (window.CHAMPION_SUPABASE_READY) return Promise.resolve(true);

  return Promise.race([
    window.CHAMPION_SUPABASE_READY_PROMISE,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Tempo limite ao carregar o Supabase.")),
        timeoutMs
      );
    })
  ]);
};


window.atualizarStatusSupabase = function(tipo, mensagem) {
  const caixa = document.getElementById("supabaseStatus");
  const texto = document.getElementById("supabaseStatusText");
  const tentar = document.getElementById("supabaseRetryButton");
  if (!caixa || !texto) return;

  caixa.classList.remove(
    "firebase-connecting",
    "firebase-online",
    "firebase-offline",
    "firebase-syncing",
    "firebase-error"
  );
  caixa.classList.add(`firebase-${tipo}`);
  texto.textContent = mensagem;

  if (tentar) {
    tentar.hidden = tipo !== "error" && tipo !== "offline";
  }
};

document.getElementById("supabaseRetryButton")?.addEventListener("click", () => {
  window.supabaseReconectar?.();
});

window.obterDadosLocaisSupabase = function(chave) {
  try {
    return JSON.parse(localStorage.getItem(chave)) || [];
  } catch (erro) {
    console.warn("Não foi possível ler a base local:", chave, erro);
    return [];
  }
};

window.aplicarDadosSupabase = function(chave, dadosRecebidos) {
  const dados = Array.isArray(dadosRecebidos) ? dadosRecebidos : [];
  const serializado = JSON.stringify(dados);

  // Evita renderização e gravação repetidas para o mesmo conteúdo.
  if (localStorage.getItem(chave) === serializado) return;

  window.__CHAMPION_APLICANDO_FIREBASE__ = true;
  localStorage.setItem(chave, serializado);

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
    case "champion_team_indicacoes_faixa":
      indicacoesFaixa = dados;
      break;
    default:
      return;
  }

  // Recalcula todas as telas depois de receber alterações de outro aparelho.
  if (typeof atualizarTudo === "function") {
    atualizarTudo();
  }

  clearTimeout(window.__CHAMPION_APLICANDO_FIREBASE_TIMER__);
  window.__CHAMPION_APLICANDO_FIREBASE_TIMER__ = setTimeout(() => {
    window.__CHAMPION_APLICANDO_FIREBASE__ = false;
  }, 600);
};

window.addEventListener("online", () => {
  window.atualizarStatusSupabase?.("syncing", "Internet restabelecida. Sincronizando...");
  window.supabaseReconectar?.();
});

window.addEventListener("offline", () => {
  window.atualizarStatusSupabase?.(
    "offline",
    "Sem internet. O sistema continua funcionando neste aparelho."
  );
});


    const textosPaginas = {
      dashboard: ["Visão Geral", "Resumo atual da academia"],
      alunos: ["Alunos", "Cadastro e gestão dos alunos"],
      planos: ["Planos", "Planos comerciais da academia"],
      matriculas: ["Matrículas", "Vínculos entre alunos e planos"],
      professores: ["Professores", "Equipe técnica e profissionais da academia"],
      treinos: ["Treinos de jiu-jitsu", "Planejamento técnico"],
      videos: ["Vídeos", "Treino do dia e técnicas demonstrativas"],
      loja: ["Gestão da loja", "Produtos, estoque e pedidos"],
      areaAluno: ["Área do aluno", "Acesso individual, loja, notificações e pedidos"],
      billingCrm: ["CRM de cobranças", "Mensalidades, atrasos e automações de cobrança"],
      notificacoes: ["Notificações", "Vendas, promoções e mensalidades"],
      graduacoes: ["Gestão de Graduações", "Faixas, graus, histórico e exames"],
      checkin: ["Check-in", "Controle de entrada dos alunos"]
    };

    document.querySelectorAll(".menu button").forEach((botao) => {
      botao.addEventListener("click", () => {
        const view = botao.dataset.view;
        const destino = document.getElementById(view);

        // Segurança: um botão sem destino não pode derrubar o sistema inteiro.
        if (!view || !destino) {
          console.warn("Navegação ignorada: view inexistente", view);
          return;
        }

        document.querySelectorAll(".menu button").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".view").forEach((secao) => secao.classList.remove("active"));

        botao.classList.add("active");
        destino.classList.add("active");

        const texto = textosPaginas[view] || [
          destino.dataset.title || "Champion Team",
          destino.dataset.subtitle || ""
        ];

        const pageTitle = document.getElementById("pageTitle");
        const pageSubtitle = document.getElementById("pageSubtitle");

        if (pageTitle) pageTitle.textContent = texto[0] || "Champion Team";
        if (pageSubtitle) pageSubtitle.textContent = texto[1] || "";

        try {
          atualizarTudo();
        } catch (error) {
          console.error("Falha ao atualizar a tela após navegação:", error);
        }
      });
    });

    document.getElementById("formAluno").addEventListener("submit", async (event) => {
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

      const emailAluno = document.getElementById("alunoEmail").value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAluno)) {
        mostrarAlerta("Informe um e-mail válido para criar o acesso do aluno.", "error");
        return;
      }

      const emailDuplicado = alunos.find(
        (aluno) =>
          String(aluno.email || "").trim().toLowerCase() === emailAluno &&
          aluno.id !== id
      );
      if (emailDuplicado) {
        mostrarAlerta("Já existe um aluno cadastrado com este e-mail.", "error");
        return;
      }
      const dados = {
        id: id || gerarId(),
        nome: document.getElementById("alunoNome").value.trim(),
        cpf,
        telefone: document.getElementById("alunoTelefone").value.trim(),
        email: emailAluno,
        nascimento: document.getElementById("alunoNascimento").value,
        status: document.getElementById("alunoStatus").value,
        senha: senhaPadraoCpf(cpf)
      };

      if (!id) {
        const conta = await window.supabaseCriarUsuario?.({
          role: "aluno",
          profileId: dados.id,
          nome: dados.nome,
          cpf: dados.cpf,
          email: dados.email,
          password: String(dados.cpf || "").replace(/\D/g, "").slice(0,6)
        });
        if (!conta?.uid) {
          mostrarAlerta("Não foi possível criar o acesso Supabase do aluno.", "error");
          return;
        }
        dados.authUid = conta.uid;
      } else {
        const anterior = alunos.find(a => a.id === id);
        dados.authUid = anterior?.authUid || "";

        if (!dados.authUid) {
          const conta = await window.supabaseCriarUsuario?.({
            role: "aluno",
            profileId: dados.id,
            nome: dados.nome,
            cpf: dados.cpf,
            email: dados.email,
            password: String(dados.cpf || "").replace(/\D/g, "").slice(0,6)
          });

          if (!conta?.uid) {
            mostrarAlerta("Não foi possível criar o acesso do aluno.", "error");
            return;
          }

          dados.authUid = conta.uid;
        } else if (
          anterior?.email &&
          String(anterior.email).trim().toLowerCase() !== dados.email
        ) {
          try {
            await window.supabaseMigrarAcessoAluno?.({
              authUid: dados.authUid,
              cpf: dados.cpf,
              emailNovo: dados.email,
              nome: dados.nome,
              profileId: dados.id
            });
          } catch (erroMigracao) {
            console.warn("Migração automática não concluída:", erroMigracao);
          }
        }
      }

      if (id) {
        alunos = alunos.map((aluno) => aluno.id === id ? dados : aluno);
        mostrarAlerta("Aluno atualizado com sucesso.");
      } else {
        alunos.push(dados);
        mostrarAlerta("Aluno cadastrado com sucesso.");
      }

      salvar(STORAGE_KEYS.alunos, alunos);

      if (dados.authUid && typeof window.supabaseAtualizarPerfilAcesso === "function") {
        try {
          await window.supabaseAtualizarPerfilAcesso({
            authUid: dados.authUid,
            role: "aluno",
            profileId: dados.id,
            nome: dados.nome,
            email: dados.email,
            cpf: dados.cpf
          });
        } catch (erroPerfil) {
          console.error("Não foi possível atualizar o perfil do aluno:", erroPerfil);
        }
      }

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

    async function excluirAluno(id) {
      await excluirHistoricoCompletoAluno(id);
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
      const matricula = matriculas.find((item) => item.id === id);
      if (!matricula) return;

      const aluno = alunos.find((item) => item.id === matricula.alunoId);
      if (!confirm(`Cancelar a matrícula de ${aluno?.nome || "este aluno"}? O histórico será mantido.`)) return;

      matriculas = matriculas.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Cancelada",
              canceladaEm: new Date().toISOString(),
              motivoCancelamento: "Cancelada pelo gestor"
            }
          : item
      );

      salvar(STORAGE_KEYS.matriculas, matriculas);
      atualizarTudo();
      mostrarAlerta("Matrícula cancelada. O histórico foi mantido.");
    }

    function editarMatricula(id) {
      const matricula = matriculas.find((item) => item.id === id);
      if (!matricula) return;

      const plano = planos.find((item) => item.id === matricula.planoId);
      const aluno = alunos.find((item) => item.id === matricula.alunoId);

      const novoInicio = prompt(
        `Data de início da matrícula de ${aluno?.nome || "aluno"} (AAAA-MM-DD):`,
        matricula.inicio
      );
      if (novoInicio === null) return;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(novoInicio)) {
        mostrarAlerta("Informe a data no formato AAAA-MM-DD.", "error");
        return;
      }

      const novoPagamento = prompt(
        "Forma de pagamento:",
        matricula.pagamento || "PIX"
      );
      if (novoPagamento === null) return;

      const reativar = matricula.status !== "Ativo"
        ? confirm("Deseja reativar esta matrícula agora?")
        : true;

      const novoStatus = reativar ? "Ativo" : matricula.status;
      const novoVencimento = plano
        ? adicionarMeses(novoInicio, plano.duracao)
        : matricula.vencimento;

      matriculas = matriculas.map((item) =>
        item.id === id
          ? {
              ...item,
              inicio: novoInicio,
              vencimento: novoVencimento,
              pagamento: novoPagamento.trim() || item.pagamento,
              status: novoStatus,
              reativadaEm: reativar ? new Date().toISOString() : item.reativadaEm
            }
          : item
      );

      salvar(STORAGE_KEYS.matriculas, matriculas);
      atualizarTudo();

      mostrarAlerta(
        reativar
          ? "Matrícula editada e reativada."
          : "Matrícula editada."
      );
    }


/* =========================================================
   MODAL PREMIUM DE CONFIRMAÇÃO — V16
========================================================= */
let confirmacaoPremiumResolver = null;
let confirmacaoPremiumInicializada = false;

function normalizarTextoConfirmacao(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function obterElementosConfirmacaoPremium() {
  return {
    overlay: document.getElementById("confirmacaoPremiumOverlay"),
    titulo: document.getElementById("confirmacaoPremiumTitulo"),
    descricao: document.getElementById("confirmacaoPremiumDescricao"),
    nome: document.getElementById("confirmacaoPremiumNome"),
    input: document.getElementById("confirmacaoPremiumInput"),
    feedback: document.getElementById("confirmacaoPremiumFeedback"),
    confirmar: document.getElementById("confirmacaoPremiumConfirmar"),
    cancelar: document.getElementById("confirmacaoPremiumCancelar"),
    fechar: document.getElementById("confirmacaoPremiumFechar")
  };
}

function atualizarEstadoConfirmacaoPremium() {
  const elementos = obterElementosConfirmacaoPremium();
  if (!elementos.input || !elementos.nome || !elementos.confirmar || !elementos.feedback) return;

  const valido =
    normalizarTextoConfirmacao(elementos.input.value) ===
    normalizarTextoConfirmacao(elementos.nome.textContent);

  elementos.confirmar.disabled = !valido;
  elementos.confirmar.classList.toggle("enabled", valido);

  elementos.feedback.textContent = valido
    ? "Nome confirmado ✓"
    : "O botão será liberado quando o nome estiver correto.";

  elementos.feedback.classList.toggle("valid", valido);
}

function fecharConfirmacaoPremium(resultado = false) {
  const { overlay, input, confirmar, feedback } = obterElementosConfirmacaoPremium();

  if (overlay) {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("modal-open");

  if (input) input.value = "";
  if (confirmar) {
    confirmar.disabled = true;
    confirmar.classList.remove("enabled");
  }
  if (feedback) {
    feedback.textContent = "O botão será liberado quando o nome estiver correto.";
    feedback.classList.remove("valid");
  }

  const resolver = confirmacaoPremiumResolver;
  confirmacaoPremiumResolver = null;

  if (resolver) resolver(resultado);
}

function inicializarConfirmacaoPremium() {
  if (confirmacaoPremiumInicializada) return;

  const elementos = obterElementosConfirmacaoPremium();
  if (!elementos.overlay) return;

  confirmacaoPremiumInicializada = true;

  elementos.input?.addEventListener("input", atualizarEstadoConfirmacaoPremium);
  elementos.input?.addEventListener("keyup", atualizarEstadoConfirmacaoPremium);
  elementos.cancelar?.addEventListener("click", () => fecharConfirmacaoPremium(false));
  elementos.fechar?.addEventListener("click", () => fecharConfirmacaoPremium(false));

  elementos.confirmar?.addEventListener("click", () => {
    if (elementos.confirmar.disabled) return;
    fecharConfirmacaoPremium(true);
  });

  elementos.overlay.addEventListener("click", (event) => {
    if (event.target === elementos.overlay) {
      fecharConfirmacaoPremium(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!elementos.overlay.classList.contains("show")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      fecharConfirmacaoPremium(false);
    }

    if (event.key === "Enter" && !elementos.confirmar.disabled) {
      event.preventDefault();
      fecharConfirmacaoPremium(true);
    }
  });
}

function abrirConfirmacaoPremium({ titulo, descricao, nome }) {
  inicializarConfirmacaoPremium();

  return new Promise((resolve) => {
    const elementos = obterElementosConfirmacaoPremium();

    if (!elementos.overlay) {
      resolve(false);
      mostrarAlerta("Não foi possível abrir a confirmação de exclusão.", "error");
      return;
    }

    // Resolve uma promessa anterior caso o modal tenha ficado aberto.
    if (confirmacaoPremiumResolver) {
      confirmacaoPremiumResolver(false);
    }

    confirmacaoPremiumResolver = resolve;

    elementos.titulo.textContent = titulo;
    elementos.descricao.textContent = descricao;
    elementos.nome.textContent = nome;
    elementos.input.value = "";
    elementos.confirmar.disabled = true;
    elementos.confirmar.classList.remove("enabled");
    elementos.feedback.textContent =
      "O botão será liberado quando o nome estiver correto.";
    elementos.feedback.classList.remove("valid");

    elementos.overlay.classList.add("show");
    elementos.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    requestAnimationFrame(() => {
      elementos.input.focus();
      atualizarEstadoConfirmacaoPremium();
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarConfirmacaoPremium, {
    once: true
  });
} else {
  inicializarConfirmacaoPremium();
}


    async function excluirHistoricoCompletoAluno(alunoId) {
      const aluno = alunos.find((item) => String(item.id) === String(alunoId));
      if (!aluno) {
        mostrarAlerta("Aluno não encontrado.", "error");
        return;
      }

      const confirmado = await abrirConfirmacaoPremium({
        titulo: "Excluir aluno e histórico",
        descricao: `Você está prestes a excluir definitivamente ${aluno.nome}. Esta ação não poderá ser desfeita.`,
        nome: aluno.nome
      });

      if (!confirmado) return;

      const authUid = aluno.authUid || "";

      matriculas = matriculas.filter((item) => String(item.alunoId) !== String(alunoId));
      checkins = checkins.filter((item) => String(item.alunoId) !== String(alunoId));
      fichasTreino = fichasTreino.filter((item) => String(item.alunoId) !== String(alunoId));
      pedidosLoja = pedidosLoja.filter((item) => String(item.alunoId) !== String(alunoId));
      notificacoes = notificacoes.filter((item) => String(item.alunoId || "") !== String(alunoId));
      graduacoes = graduacoes.filter((item) => String(item.alunoId) !== String(alunoId));
      historicoGraduacoes = historicoGraduacoes.filter((item) => String(item.alunoId) !== String(alunoId));
      examesGraduacao = examesGraduacao.map((exame) => ({
        ...exame,
        participantes: (exame.participantes || []).filter(
          (id) => String(id) !== String(alunoId)
        )
      }));

      alunos = alunos.filter((item) => String(item.id) !== String(alunoId));

      salvar(STORAGE_KEYS.matriculas, matriculas);
      salvar(STORAGE_KEYS.checkins, checkins);
      salvar(FICHAS_STORAGE_KEY, fichasTreino);
      salvar(PEDIDOS_STORAGE_KEY, pedidosLoja);
      salvar(NOTIFICACOES_STORAGE_KEY, notificacoes);
      salvar(GRADUATION_KEYS.graduacoes, graduacoes);
      salvar(GRADUATION_KEYS.historico, historicoGraduacoes);
      salvar(GRADUATION_KEYS.exames, examesGraduacao);
      salvar(STORAGE_KEYS.alunos, alunos);

      if (authUid && typeof window.supabaseExcluirPerfilAluno === "function") {
        try {
          await window.supabaseExcluirPerfilAluno(authUid);
        } catch (erro) {
          console.error("Falha ao remover perfil Supabase:", erro);
          mostrarAlerta(
            "Histórico removido, mas o perfil de acesso Supabase precisará ser revisado.",
            "error"
          );
          atualizarTudo();
          return;
        }
      }

      atualizarTudo();
      mostrarAlerta("Aluno e histórico removidos. O acesso foi desativado e pode ser reutilizado.");
    }

    function atualizarStatusMatriculas() {
      const hoje = hojeIso();
      let houveAlteracao = false;

      const atualizadas = matriculas.map((matricula) => {
        if (matricula.status === "Cancelada") return matricula;

        const novoStatus = matricula.vencimento < hoje ? "Vencido" : "Ativo";
        if (novoStatus === matricula.status) return matricula;

        houveAlteracao = true;
        return { ...matricula, status: novoStatus };
      });

      if (houveAlteracao) {
        matriculas = atualizadas;
        salvar(STORAGE_KEYS.matriculas, matriculas);
      }
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
              <div class="matricula-actions">
                <button class="btn btn-secondary" onclick="editarMatricula('${matricula.id}')">
                  ${matricula.status === "Cancelada" ? "Editar / Reativar" : "Editar"}
                </button>
                ${matricula.status !== "Cancelada"
                  ? `<button class="btn btn-warning" onclick="cancelarMatricula('${matricula.id}')">Cancelar matrícula</button>`
                  : `<button class="btn btn-success" onclick="editarMatricula('${matricula.id}')">Reativar</button>`}
                <button class="btn btn-danger" onclick="excluirHistoricoCompletoAluno('${matricula.alunoId}')">
                  Excluir aluno e histórico
                </button>
              </div>
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
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum check-in registrado.</td></tr>';
        ultimos.innerHTML = '<tr><td colspan="4" class="empty">Nenhum check-in registrado.</td></tr>';
        return;
      }

      tbody.innerHTML = checkins.map((checkin) => {
        const aluno = alunos.find((item) => item.id === checkin.alunoId);
        const statusMeta = statusCheckinLabelV30(checkin.validationStatus);

        return `
          <tr>
            <td>${aluno?.nome || "Aluno não encontrado"}</td>
            <td>${aluno?.cpf || "-"}</td>
            <td>
              ${checkin.fotoUrl
                ? `<img class="admin-checkin-thumb" data-checkin-photo-path="${checkin.fotoUrl}" alt="Selfie de check-in">`
                : `<span class="admin-checkin-no-photo">—</span>`
              }
            </td>
            <td>${formatarData(checkin.data)}</td>
            <td>${checkin.horario || checkin.hora || "--:--"}</td>
            <td><span class="student-checkin-status ${statusMeta.className}">${statusMeta.label}</span></td>
            <td>
              ${checkin.validationStatus === "pending"
                ? `<div class="checkin-validation-actions">
                    <button class="btn btn-success" type="button" data-validate-checkin="${checkin.id}" data-status="approved">Validar</button>
                    <button class="btn btn-danger" type="button" data-validate-checkin="${checkin.id}" data-status="rejected">Recusar</button>
                  </div>`
                : `<span class="muted">Concluído</span>`
              }
            </td>
          </tr>
        `;
      }).join("");

      ultimos.innerHTML = checkins.slice(0, 5).map((checkin) => {
        const aluno = alunos.find((item) => item.id === checkin.alunoId);
        const statusMeta = statusCheckinLabelV30(checkin.validationStatus);

        return `
          <tr>
            <td>${aluno?.nome || "Aluno não encontrado"}</td>
            <td>${formatarData(checkin.data)}</td>
            <td>${checkin.horario || checkin.hora || "--:--"}</td>
            <td><span class="student-checkin-status ${statusMeta.className}">${statusMeta.label}</span></td>
          </tr>
        `;
      }).join("");

      window.hidratarFotosCheckinV30?.(tbody);
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
    window.editarMatricula = editarMatricula;
    window.excluirHistoricoCompletoAluno = excluirHistoricoCompletoAluno;


document.querySelectorAll("[data-go-view]").forEach((botao) => {
  botao.addEventListener("click", () => {
    const destino = botao.dataset.goView;
    const menuDestino = document.querySelector(`.menu button[data-view="${destino}"]`);
    if (menuDestino) menuDestino.click();
  });
});


const LOGIN_KEY = "fitcontrol_login_ativo";
function abrirSistema(){document.getElementById("loginScreen").classList.add("hidden");document.getElementById("appShell").classList.remove("app-locked");atualizarGraficosDashboard()}
async function fecharSistema(){
  await window.supabaseLogout?.();
  localStorage.removeItem(LOGIN_KEY);
  sessionStorage.removeItem(LOGIN_KEY);
  localStorage.removeItem("fitcontrol_tipo_usuario");
  localStorage.removeItem("fitcontrol_aluno_usuario_id");
  localStorage.removeItem("champion_auth_uid");
  localStorage.removeItem("champion_perfil");
  sessionStorage.removeItem("fitcontrol_aluno_usuario_id");
  sessionStorage.removeItem("fitcontrol_aluno_logado");
  alunoLogadoId="";
  document.body.classList.remove("student-mode","professor-mode");
  document.getElementById("studentDashboard")?.classList.add("hidden");
  document.getElementById("studentAccessScreen")?.classList.remove("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("app-locked");
  document.getElementById("loginSenha").value="";
  document.getElementById("loginError").textContent="";
}
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
    botao.textContent = "ENTRANDO...";
  }

  try {
    if (typeof window.supabaseLogin !== "function") {
      throw new Error(
        "O Supabase não foi carregado. Faça um novo deploy com o script.js atualizado e limpe o cache."
      );
    }

    const sessao = await window.supabaseLogin(identificador, senha);
    const perfil = sessao.perfil;

    localStorage.setItem("fitcontrol_tipo_usuario", perfil.role);
    localStorage.setItem("champion_auth_uid", sessao.user.uid);
    localStorage.setItem("champion_perfil", JSON.stringify(perfil));

    if (lembrar) localStorage.setItem(LOGIN_KEY, "true");
    else sessionStorage.setItem(LOGIN_KEY, "true");

    if (perfil.role === "gestor") {
      abrirSistemaComoAdministrador(perfil.dbRole || "owner", perfil.nome || "Administrador");
      aplicarPermissoesPerfil("gestor");
      mostrarAlerta("Acesso do gestor realizado.");
      return;
    }

    if (perfil.role === "professor") {
      const professor = professores.find(p => String(p.id) === String(perfil.profileId)) || { nome: perfil.nome || sessao.user.email };
      abrirSistemaComoProfessor(professor);
      aplicarPermissoesPerfil("professor");
      mostrarAlerta(`Bem-vindo, ${professor.nome}.`);
      return;
    }

    if (perfil.role === "aluno") {
      const aluno = alunos.find(a => String(a.id) === String(perfil.profileId));
      if (!aluno) throw new Error("Cadastro do aluno não foi encontrado na base online.");
      if (aluno.status !== "Ativo") throw new Error("Seu cadastro está inativo. Procure a recepção.");

      localStorage.setItem("fitcontrol_aluno_usuario_id", aluno.id);
      abrirSistemaComoAluno(aluno);
      aplicarPermissoesPerfil("aluno");
      mostrarAlerta(`Bem-vindo, ${aluno.nome}.`);
      return;
    }

    throw new Error("Perfil sem permissão de acesso.");
  } catch (falha) {
    console.error("Erro de login:", falha);
    erro.textContent = falha?.message || "Não foi possível entrar.";
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = botao.dataset.textoOriginal || "ENTRAR NA CHAMPION TEAM →";
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
function abrirSistemaComoAdministrador(dbRole="owner", nome="Administrador"){
  document.body.classList.remove("student-mode","professor-mode");
  const isMaster = dbRole === "master_admin";
  atualizarPerfilCabecalho(
    isMaster ? (nome || "Master Admin") : (nome || "Proprietário"),
    isMaster ? "Administrador Master do SaaS" : "Proprietário da academia",
    isMaster ? "MA" : "AD"
  );
  abrirSistema();
  document.querySelector('.menu button[data-view="dashboard"]')?.click();
}
function abrirSistemaComoProfessor(professor){
  document.body.classList.remove("student-mode");
  document.body.classList.add("professor-mode");
  atualizarPerfilCabecalho(professor.nome || "Professor","Professor da academia",obterIniciaisAluno(professor.nome || "PR"));
  abrirSistema();
  document.querySelector('.menu button[data-view="treinos"]')?.click();
}

function aplicarPermissoesPerfil(role){
  const permitidas = {
    gestor: [
      "dashboard","alunos","planos","matriculas","professores",
      "treinos","videos","loja","areaAluno","notificacoes",
      "graduacoes","checkin","billingCrm"
    ],
    professor: ["treinos"],
    aluno: ["areaAluno"]
  };

  const lista = permitidas[role] || [];

  document.querySelectorAll(".menu button[data-view]").forEach(botao => {
    const permitido = lista.includes(botao.dataset.view);
    botao.hidden = !permitido;
    botao.classList.toggle("role-hidden", !permitido);

    if (permitido) {
      botao.style.removeProperty("display");
      botao.removeAttribute("aria-hidden");
      botao.tabIndex = 0;
    } else {
      botao.style.setProperty("display","none","important");
      botao.setAttribute("aria-hidden","true");
      botao.tabIndex = -1;
    }
  });

  document.querySelectorAll(".view").forEach(view => {
    const permitida = lista.includes(view.id);
    view.classList.toggle("role-view-disabled", !permitida);
    if (!permitida) view.classList.remove("active");
  });

  const topNotificationButton = document.getElementById("topNotificationButton");
  if (topNotificationButton) {
    const mostrarNotificacoes = role === "gestor";
    topNotificationButton.hidden = !mostrarNotificacoes;
    topNotificationButton.style.setProperty(
      "display",
      mostrarNotificacoes ? "" : "none",
      mostrarNotificacoes ? "" : "important"
    );
  }

  document.body.dataset.role = role;
  document.body.classList.toggle("professor-mode", role === "professor");
  document.body.classList.toggle("student-mode", role === "aluno");

  const teacherOverview = document.getElementById("teacherOverview");
  if (teacherOverview) teacherOverview.hidden = role !== "professor";
}

function abrirSistemaComoAluno(aluno){document.body.classList.add("student-mode");atualizarPerfilCabecalho(aluno.nome,"Aluno da academia",obterIniciaisAluno(aluno.nome));alunoLogadoId=aluno.id;sessionStorage.setItem("fitcontrol_aluno_logado",aluno.id);document.getElementById("studentAccessScreen")?.classList.add("hidden");document.getElementById("studentDashboard")?.classList.remove("hidden");abrirSistema();document.querySelector('.menu button[data-view="areaAluno"]')?.click();renderizarAreaAluno()}
function restaurarSessaoPorPerfil(){
  // A restauração real é controlada pelo Supabase Authentication.
}

window.addEventListener("champion-auth-restored", (event) => {
  const { user, perfil } = event.detail || {};
  if (!user || !perfil) return;

  localStorage.setItem("fitcontrol_tipo_usuario", perfil.role);
  localStorage.setItem("champion_auth_uid", user.uid);
  localStorage.setItem("champion_perfil", JSON.stringify(perfil));

  if (perfil.role === "gestor") {
    abrirSistemaComoAdministrador(perfil.dbRole || "owner", perfil.nome || "Administrador");
    aplicarPermissoesPerfil("gestor");
  } else if (perfil.role === "professor") {
    const professor = professores.find(p => String(p.id) === String(perfil.profileId)) || { nome: perfil.nome || user.email };
    abrirSistemaComoProfessor(professor);
    aplicarPermissoesPerfil("professor");
  } else if (perfil.role === "aluno") {
    const aluno = alunos.find(a => String(a.id) === String(perfil.profileId));
    if (aluno) {
      abrirSistemaComoAluno(aluno);
      aplicarPermissoesPerfil("aluno");
    }
  }
});




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
document.getElementById("formProfessor")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("professorId").value;
  const cref = document.getElementById("professorCref").value.trim().toUpperCase();
  const cpf = normalizarCpf(document.getElementById("professorCpf").value);
  const senhaAntiga = document.getElementById("professorSenha")?.value.trim();

  if (cpf.length !== 11) {
    mostrarAlerta("Informe um CPF válido para o professor.", "error");
    return;
  }

  const duplicadoCref = professores.find(
    (professor) =>
      String(professor.cref || "").toUpperCase() === cref &&
      professor.id !== id
  );

  if (duplicadoCref) {
    mostrarAlerta("Já existe um professor cadastrado com este CREF.", "error");
    return;
  }

  const duplicadoCpf = professores.find(
    (professor) =>
      normalizarCpf(professor.cpf) === cpf &&
      professor.id !== id
  );

  if (duplicadoCpf) {
    mostrarAlerta("Já existe um professor cadastrado com este CPF.", "error");
    return;
  }

  const anterior = professores.find(p => p.id === id);

  const dados = {
    id: id || gerarId(),
    nome: document.getElementById("professorNome").value.trim(),
    cpf,
    cref,
    especialidade: document.getElementById("professorEspecialidade").value,
    status: document.getElementById("professorStatus").value,
    telefone: document.getElementById("professorTelefone").value.trim(),
    email: document.getElementById("professorEmail").value.trim(),
    turno: document.getElementById("professorTurno").value,
    admissao: document.getElementById("professorAdmissao").value,
    authUid: anterior?.authUid || ""
  };

  try {
    if (!dados.authUid) {
      const conta = await window.supabaseCriarUsuario?.({
        role: "professor",
        profileId: dados.id,
        nome: dados.nome,
        cpf: dados.cpf,
        email: dados.email,
        password: String(dados.cpf || "").replace(/\D/g, "").slice(0,6)
      });

      if (!conta?.uid) {
        mostrarAlerta("Não foi possível criar o acesso do professor.", "error");
        return;
      }

      dados.authUid = conta.uid;
    } else if (senhaAntiga && anterior?.email) {
      await window.supabaseMigrarProfessor?.({
        authUid: dados.authUid,
        emailAntigo: anterior.email,
        senhaAntiga,
        cpf: dados.cpf,
        nome: dados.nome,
        profileId: dados.id
      });
    }

    if (id) {
      professores = professores.map((professor) =>
        professor.id === id ? dados : professor
      );
      mostrarAlerta("Professor atualizado com sucesso.");
    } else {
      professores.push(dados);
      mostrarAlerta("Professor cadastrado. Login: e-mail cadastrado; senha inicial: 6 primeiros números do CPF.");
    }

    salvarProfessores();

    if (dados.authUid && typeof window.supabaseAtualizarPerfilAcesso === "function") {
      try {
        await window.supabaseAtualizarPerfilAcesso({
          authUid: dados.authUid,
          role: "professor",
          profileId: dados.id,
          nome: dados.nome,
          email: dados.email,
          cpf: dados.cpf
        });
      } catch (erroPerfil) {
        console.error("Não foi possível atualizar o perfil do professor:", erroPerfil);
      }
    }

    limparFormularioProfessor();
    atualizarModulosTreino();
  } catch (erro) {
    mostrarAlerta(erro.message || "Não foi possível salvar o professor.", "error");
  }
});

function limparFormularioProfessor() {
  document.getElementById("formProfessor")?.reset();
  document.getElementById("professorId").value = "";
  if (document.getElementById("professorCpf")) document.getElementById("professorCpf").value = "";
  document.getElementById("professorStatus").value = "Ativo";
  document.getElementById("professorTurno").value = "Manhã";
}

function editarProfessor(id) {
  const professor = professores.find((item) => item.id === id);
  if (!professor) return;

  document.getElementById("professorId").value = professor.id;
  document.getElementById("professorNome").value = professor.nome;
  if (document.getElementById("professorCpf")) document.getElementById("professorCpf").value = professor.cpf || "";
  document.getElementById("professorCref").value = professor.cref;
  document.getElementById("professorEspecialidade").value = professor.especialidade;
  document.getElementById("professorStatus").value = professor.status;
  document.getElementById("professorTelefone").value = professor.telefone || "";
  document.getElementById("professorEmail").value = professor.email || "";
  document.getElementById("professorTurno").value = professor.turno || "Manhã";
  document.getElementById("professorAdmissao").value = professor.admissao || "";
  if (document.getElementById("professorSenha")) document.getElementById("professorSenha").value = "";

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
function criarNotificacao(o){notificacoes.unshift({id:gerarId(),tipo:o.tipo||"Geral",titulo:o.titulo,mensagem:o.mensagem,publico:o.publico||"Administrador",alunoId:o.alunoId||"",lida:false,criadaEm:new Date().toISOString()});salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}

function videoEmbed(u){
  try{
    let x=new URL(u);
    if(x.hostname.includes("youtube.com"))return`https://www.youtube.com/embed/${x.searchParams.get("v")}`;
    if(x.hostname.includes("youtu.be"))return`https://www.youtube.com/embed/${x.pathname.slice(1)}`;
    if(x.hostname.includes("vimeo.com"))return`https://player.vimeo.com/video/${x.pathname.split("/").pop()}`;
    return u;
  }catch{return u}
}

function resetVideoMediaV36(){
  const file=document.getElementById("videoArquivo");
  const path=document.getElementById("videoStoragePath");
  const preview=document.getElementById("videoUploadPreview");
  if(file) file.value="";
  if(path) path.value="";
  if(preview){preview.innerHTML="";preview.classList.add("hidden")}
}

document.getElementById("videoArquivo")?.addEventListener("change",e=>{
  const file=e.target.files?.[0];
  const preview=document.getElementById("videoUploadPreview");
  if(!preview)return;
  if(!file){preview.innerHTML="";preview.classList.add("hidden");return}
  preview.classList.remove("hidden");
  preview.innerHTML=`<div class="media-file-pill"><span>🎬</span><div><strong>${escaparHtml(file.name)}</strong><small>${(file.size/1024/1024).toFixed(1)} MB • será enviado ao salvar</small></div></div>`;
});

document.getElementById("formVideoTreino")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=e.submitter || e.target.querySelector('button[type="submit"],.btn-primary');
  const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="SALVANDO..."}

  try{
    const id=videoTreinoId.value;
    const existing=id?videosTreino.find(v=>v.id===id):null;
    const file=document.getElementById("videoArquivo")?.files?.[0];
    const typedUrl=videoUrl.value.trim();

    if(!typedUrl && !file && !existing?.storagePath && !existing?.url){
      throw new Error("Adicione uma URL ou anexe um arquivo de vídeo.");
    }

    let storagePath=existing?.storagePath||"";
    let mediaType=existing?.mediaType||"url";
    let finalUrl=typedUrl || existing?.url || "";

    if(file){
      const uploaded=await window.supabaseUploadTrainingVideoV36?.(file);
      if(!uploaded?.path) throw new Error("Não foi possível armazenar o vídeo.");
      storagePath=uploaded.path;
      mediaType="upload";
      finalUrl="";
    }else if(typedUrl){
      mediaType="url";
      storagePath="";
      finalUrl=typedUrl;
    }

    const d={
      id:id||gerarId(),
      titulo:videoTitulo.value.trim(),
      categoria:videoCategoria.value,
      nivel:videoNivel.value,
      status:videoStatus.value,
      url:finalUrl,
      storagePath,
      mediaType,
      descricao:videoDescricao.value.trim()
    };

    videosTreino=id?videosTreino.map(v=>v.id===id?d:v):[d,...videosTreino];
    await Promise.resolve(salvar(VIDEOS_STORAGE_KEY,videosTreino));

    if(!id)criarNotificacao({
      tipo:"Treino",
      titulo:d.categoria==="Treino do dia"?"Novo treino do dia":"Novo vídeo",
      mensagem:d.titulo+" foi publicado.",
      publico:"Todos os alunos"
    });

    formVideoTreino.reset();
    videoTreinoId.value="";
    resetVideoMediaV36();
    renderizarVideos();
    mostrarAlerta("Vídeo salvo na nuvem.");
  }catch(err){
    mostrarAlerta(err.message||"Falha ao salvar vídeo.","error");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old||"Salvar vídeo"}
  }
});

async function hidratarVideosUploadV36(root=document){
  const nodes=[...root.querySelectorAll("[data-training-video-path]")];
  await Promise.all(nodes.map(async video=>{
    const path=video.dataset.trainingVideoPath;
    if(!path)return;
    try{
      const url=await window.supabaseSignedTrainingVideoUrlV36?.(path,3600);
      if(url){
        video.src=url;
        video.load();
      }
    }catch(e){
      console.warn("Falha ao carregar vídeo armazenado",e);
    }
  }));
}

function renderizarVideos(){
  if(!document.getElementById("listaVideosTreino"))return;
  listaVideosTreino.innerHTML=videosTreino.length?videosTreino.map(v=>{
    const uploaded=v.mediaType==="upload" && v.storagePath;
    const media=uploaded
      ? `<video class="uploaded-training-video" controls preload="metadata" data-training-video-path="${escaparHtml(v.storagePath)}"></video>`
      : `<iframe src="${escaparHtml(videoEmbed(v.url||""))}" allowfullscreen loading="lazy"></iframe>`;
    return `<article class="video-card">
      <div class="video-preview">${media}</div>
      <div class="video-card-content">
        <h4>${escaparHtml(v.titulo)}</h4>
        <p>${escaparHtml(v.categoria)} • ${escaparHtml(v.nivel)}</p>
        <p>${escaparHtml(v.descricao||"")}</p>
        <div class="media-origin-badge">${uploaded?"ARQUIVO NO SUPABASE":"LINK EXTERNO"}</div>
        <div class="actions"><button class="btn btn-danger" onclick="excluirVideo('${v.id}')">Excluir</button></div>
      </div>
    </article>`;
  }).join(""):'<div class="empty">Nenhum vídeo.</div>';
  totalVideosModulo.textContent=videosTreino.length;
  hidratarVideosUploadV36(listaVideosTreino);
}

function excluirVideo(id){
  if(confirm("Excluir vídeo?")){
    videosTreino=videosTreino.filter(v=>v.id!==id);
    salvar(VIDEOS_STORAGE_KEY,videosTreino);
    renderizarVideos();
  }
}
document.getElementById("cancelarVideoTreino")?.addEventListener("click",()=>{
  formVideoTreino.reset();
  resetVideoMediaV36();
});

function precoProduto(p){return p.precoPromocional>0&&p.precoPromocional<p.preco?p.precoPromocional:p.preco}

function resetProdutoMediaV36(){
  const file=document.getElementById("produtoImagemArquivo");
  const preview=document.getElementById("produtoImagemPreview");
  if(file)file.value="";
  if(preview){preview.innerHTML="";preview.classList.add("hidden")}
}

document.getElementById("produtoImagemArquivo")?.addEventListener("change",e=>{
  const file=e.target.files?.[0];
  const preview=document.getElementById("produtoImagemPreview");
  if(!preview)return;
  if(!file){preview.innerHTML="";preview.classList.add("hidden");return}
  const objectUrl=URL.createObjectURL(file);
  preview.classList.remove("hidden");
  preview.innerHTML=`<div class="product-image-upload-preview">
    <img src="${objectUrl}" alt="Prévia da foto do produto">
    <div><strong>${escaparHtml(file.name)}</strong><small>${(file.size/1024/1024).toFixed(1)} MB • será enviada ao salvar</small></div>
  </div>`;
});

document.getElementById("formProduto")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const btn=e.submitter || e.target.querySelector('button[type="submit"],.btn-primary');
  const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="SALVANDO..."}

  try{
    const id=produtoId.value;
    const existing=id?produtosLoja.find(p=>p.id===id):null;
    const file=document.getElementById("produtoImagemArquivo")?.files?.[0];

    let imagem=produtoImagem.value.trim() || existing?.imagem || "";
    let imagePath=existing?.imagePath || "";

    if(file){
      const uploaded=await window.supabaseUploadProductImageV36?.(file);
      if(!uploaded?.publicUrl) throw new Error("Não foi possível armazenar a foto.");
      imagem=uploaded.publicUrl;
      imagePath=uploaded.path||"";
    }

    const precoBase=Number(produtoPreco.value||0);
    const precoPromo=Number(produtoPrecoPromocional.value||0);

    if(precoBase<=0){
      throw new Error("Informe um preço principal maior que zero.");
    }

    if(precoPromo<0){
      throw new Error("O preço promocional não pode ser negativo.");
    }

    if(precoPromo>0 && precoPromo>=precoBase){
      throw new Error("O preço promocional deve ser menor que o preço principal.");
    }

    const d={
      id:id||gerarId(),
      nome:produtoNome.value.trim(),
      categoria:produtoCategoria.value,
      preco:precoBase,
      precoPromocional:precoPromo,
      estoque:+produtoEstoque.value,
      status:produtoStatus.value,
      imagem,
      imagePath,
      descricao:produtoDescricao.value.trim()
    };

    // IMPORTANTE: estoque zero não apaga a mídia.
    // Ao reabastecer o mesmo cadastro, a imagem volta automaticamente.
    produtosLoja=id?produtosLoja.map(p=>p.id===id?d:p):[d,...produtosLoja];
    await Promise.resolve(salvar(PRODUTOS_STORAGE_KEY,produtosLoja));

    // Mantém a tela coerente com o valor que será usado na compra.
    // A sincronização normalizada agora persiste promotional_price no Supabase.
    const produtoSalvo=produtosLoja.find(p=>String(p.id)===String(d.id));
    if(produtoSalvo){
      produtoSalvo.precoPromocional=Number(d.precoPromocional||0);
    }

    if(d.precoPromocional>0&&d.precoPromocional<d.preco){
      const promoMudou=!existing || Number(existing.precoPromocional||0)!==Number(d.precoPromocional);
      if(promoMudou){
        criarNotificacao({
          tipo:"Promoção",
          titulo:"Promoção: "+d.nome,
          mensagem:`Agora por ${formatarMoeda(d.precoPromocional)}.`,
          publico:"Todos os alunos"
        });
      }
    }

    formProduto.reset();
    produtoId.value="";
    produtoEstoque.value=1;
    resetProdutoMediaV36();
    renderizarProdutos();
    mostrarAlerta(d.estoque>0?"Produto salvo com foto na nuvem.":"Produto salvo sem estoque. A foto foi preservada para reposição.");
  }catch(err){
    mostrarAlerta(err.message||"Falha ao salvar produto.","error");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old||"Salvar produto"}
  }
});


function usuarioEhAlunoV362(){
  return document.body.classList.contains("student-mode");
}

function usuarioEhProfessorV362(){
  return document.body.classList.contains("professor-mode");
}

function usuarioEhGestaoV362(){
  return !usuarioEhAlunoV362() && !usuarioEhProfessorV362();
}

function editarProdutoLoja(id){
  const p=produtosLoja.find(x=>String(x.id)===String(id));
  if(!p)return mostrarAlerta("Produto não encontrado.","error");

  produtoId.value=p.id||"";
  produtoNome.value=p.nome||"";
  produtoCategoria.value=p.categoria||"";
  produtoPreco.value=Number(p.preco||0);
  produtoPrecoPromocional.value=Number(p.precoPromocional||0);
  produtoEstoque.value=Number(p.estoque||0);
  produtoStatus.value=p.status||"Ativo";
  produtoImagem.value=p.imagem||"";
  produtoDescricao.value=p.descricao||"";

  const path=document.getElementById("produtoImagemStoragePath");
  if(path)path.value=p.imagePath||"";

  resetProdutoMediaV36();

  document.getElementById("formProduto")?.scrollIntoView({
    behavior:"smooth",
    block:"start"
  });

  mostrarAlerta("Produto carregado para edição.");
}

function renderizarProdutos(){
  if(!document.getElementById("listaProdutos"))return;

  const aluno=usuarioEhAlunoV362();
  const gestao=usuarioEhGestaoV362();

  listaProdutos.innerHTML=produtosLoja.length?produtosLoja.map(p=>{
    const semEstoque=Number(p.estoque||0)<=0;

    let actions="";
    if(aluno){
      actions=`
        <div class="actions product-actions-student">
          <button class="btn btn-primary"
                  onclick="adicionarCarrinho('${p.id}')"
                  ${semEstoque?"disabled":""}>
            ${semEstoque?"Indisponível":"Comprar"}
          </button>
        </div>`;
    }else if(gestao){
      actions=`
        <div class="actions product-actions-admin">
          <button class="btn btn-secondary"
                  onclick="editarProdutoLoja('${p.id}')">
            Editar
          </button>
          <button class="btn btn-danger"
                  onclick="excluirProdutoLoja('${p.id}')">
            Excluir
          </button>
        </div>`;
    }

    return `<article class="product-card ${semEstoque?"product-out-of-stock":""}">
      <div class="product-image">
        ${p.imagem?`<img src="${escaparHtml(p.imagem)}" loading="lazy" alt="${escaparHtml(p.nome||"Produto")}">`:"🥋"}
      </div>

      <div class="product-card-content">
        <div class="product-stock-badge ${semEstoque?"out":"in"}">
          ${semEstoque?"SEM ESTOQUE":"ESTOQUE: "+p.estoque}
        </div>

        <h4>${escaparHtml(p.nome)}</h4>
        <p>${escaparHtml(p.descricao||"")}</p>

        <p class="product-price-wrap">
          ${precoProduto(p)<p.preco?`<span class="product-old-price">${formatarMoeda(p.preco)}</span>`:""}
          <strong class="product-price">${formatarMoeda(precoProduto(p))}</strong>
          ${precoProduto(p)<p.preco?`<span class="product-discount-badge">PROMO</span>`:""}
        </p>

        ${semEstoque?`
          <small class="product-photo-retained">
            Foto preservada para quando este item voltar ao estoque.
          </small>`:""}

        ${actions}
      </div>
    </article>`;
  }).join(""):'<div class="empty">Nenhum produto.</div>';

  if(totalProdutosModulo) totalProdutosModulo.textContent=produtosLoja.length;
}

function adicionarCarrinho(id){
  if(!usuarioEhAlunoV362()){
    return mostrarAlerta("Compras estão disponíveis apenas na área do aluno.","error");
  }
  const p=produtosLoja.find(x=>x.id===id);
  if(!p||Number(p.estoque||0)<=0)return mostrarAlerta("Produto sem estoque.","error");
  let i=carrinhoLoja.find(x=>x.produtoId===id);
  if(i){if(i.quantidade>=p.estoque)return mostrarAlerta("Limite do estoque.","error");i.quantidade++}
  else carrinhoLoja.push({produtoId:id,quantidade:1});
  salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);
  renderizarCarrinho();
  mostrarAlerta("Produto adicionado.");
}
function removerCarrinho(id){carrinhoLoja=carrinhoLoja.filter(x=>x.produtoId!==id);salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);renderizarCarrinho()}
function renderizarCarrinho(){
  if(!document.getElementById("itensCarrinho"))return;
  itensCarrinho.innerHTML=carrinhoLoja.length?carrinhoLoja.map(i=>{
    let p=produtosLoja.find(x=>x.id===i.produtoId);
    return p?`<div class="cart-item"><div><strong>${escaparHtml(p.nome)}</strong><small>${i.quantidade} x ${formatarMoeda(precoProduto(p))}</small></div><button onclick="removerCarrinho('${i.produtoId}')">×</button></div>`:""
  }).join(""):'<div class="empty">Seu carrinho está vazio.</div>';
  let t=carrinhoLoja.reduce((s,i)=>{let p=produtosLoja.find(x=>x.id===i.produtoId);return s+(p?precoProduto(p)*i.quantidade:0)},0);
  totalCarrinho.textContent=formatarMoeda(t);contadorCarrinho.textContent=carrinhoLoja.reduce((s,i)=>s+i.quantidade,0)
}
document.getElementById("finalizarCompra")?.addEventListener("click",()=>{
  if(!usuarioEhAlunoV362())return mostrarAlerta("Compras estão disponíveis apenas na área do aluno.","error");
  if(!carrinhoLoja.length)return mostrarAlerta("Carrinho vazio.","error");
  let alunoId=alunoPortalId.value;
  let aluno=alunos.find(a=>a.id===alunoId);
  if(!aluno)return mostrarAlerta("Acesse a área do aluno.","error");
  let itens=[],total=0;
  for(let i of carrinhoLoja){
    let p=produtosLoja.find(x=>x.id===i.produtoId);
    if(!p||i.quantidade>p.estoque)return mostrarAlerta("Estoque insuficiente.","error");
    itens.push({nome:p.nome,quantidade:i.quantidade,preco:precoProduto(p)});
    total+=precoProduto(p)*i.quantidade;
    p.estoque-=i.quantidade;
  }
  let ped={id:gerarId(),codigo:"PED-"+String(pedidosLoja.length+1).padStart(4,"0"),alunoId,itens,total,pagamento:formaPagamentoLoja.value,criadoEm:new Date().toISOString()};
  pedidosLoja.unshift(ped);
  carrinhoLoja=[];
  salvar(PEDIDOS_STORAGE_KEY,pedidosLoja);
  salvar(PRODUTOS_STORAGE_KEY,produtosLoja);
  salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);
  criarNotificacao({tipo:"Venda",titulo:"Nova venda realizada",mensagem:`${aluno.nome} comprou ${formatarMoeda(total)}.`,publico:"Administrador"});
  criarNotificacao({tipo:"Venda",titulo:"Pedido confirmado",mensagem:`Pedido ${ped.codigo} confirmado.`,publico:"Aluno específico",alunoId});
  renderizarProdutos();renderizarCarrinho();renderizarPedidos();
  mostrarAlerta("Pagamento aprovado em modo demonstrativo.");
});
function renderizarPedidos(){
  if(!document.getElementById("tabelaPedidosLoja"))return;
  const statusLabel=s=>({pending:"AGUARDANDO PIX",paid:"PAGO",deposit_paid:"SINAL PAGO",ready:"PRONTO",delivered:"ENTREGUE",cancelled:"CANCELADO"}[s]||String(s||"PENDENTE").toUpperCase());
  tabelaPedidosLoja.innerHTML=pedidosLoja.length?pedidosLoja.map(p=>`<tr>
    <td><strong>${escaparHtml(p.codigo||String(p.id).slice(0,8))}</strong><br><small class="order-status-v37 ${p.status||"pending"}">${statusLabel(p.status)}</small>${p.status==="cancelled"&&p.motivoCancelamento?`<br><small class="order-cancel-reason-v376">${escaparHtml(p.motivoCancelamento)}</small>`:""}</td>
    <td>${escaparHtml(alunos.find(a=>a.id===p.alunoId)?.nome||"-")}</td>
    <td>${(p.itens||[]).map(i=>i.quantidade+"x "+escaparHtml(i.nome)).join("<br>")}</td>
    <td>${escaparHtml(p.pagamento||"PIX")}</td>
    <td><strong>${formatarMoeda(p.total)}</strong></td>
    <td>${new Date(p.criadoEm).toLocaleString("pt-BR")}</td>
    <td>${p.status==="pending"?`<button type="button" class="btn btn-danger btn-cancel-reservation-v376" onclick="cancelarReservaPedidoV376('${p.id}')">CANCELAR RESERVA</button>`:'<span class="order-no-action-v376">—</span>'}</td>
  </tr>`).join(""):'<tr><td colspan="7" class="empty">Nenhum pedido.</td></tr>';
  if(document.getElementById("totalPedidosModulo"))totalPedidosModulo.textContent=pedidosLoja.length;
}

async function cancelarReservaPedidoV376(orderId){
  const pedido=pedidosLoja.find(item=>String(item.id)===String(orderId));
  if(!pedido||pedido.status!=="pending") return mostrarAlerta("Esta reserva não está mais aguardando PIX.","error");
  if(!confirm(`Cancelar a reserva ${pedido.codigo}? O pedido continuará no histórico para auditoria.`)) return;
  const button=document.querySelector(`[onclick="cancelarReservaPedidoV376('${orderId}')"]`);
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent="CANCELANDO..."}
  try{
    const result=await window.supabaseCancelStoreOrderV376?.(orderId);
    if(!result?.ok) throw new Error("Não foi possível cancelar a reserva.");
    mostrarAlerta(result.legacy_stock_restored
      ?`Reserva cancelada. ${Number(result.restored_quantity||0)} unidade(s) devolvida(s) ao estoque.`
      :"Reserva cancelada e quantidade liberada imediatamente.");
  }catch(error){
    console.error("Cancelamento V37.6",error);
    mostrarAlerta(error?.message||"Não foi possível cancelar a reserva.","error");
    if(button){button.disabled=false;button.textContent=old||"CANCELAR RESERVA"}
  }
}
document.getElementById("formNotificacao")?.addEventListener("submit",e=>{e.preventDefault();if(notificacaoPublico.value==="Aluno específico"&&!notificacaoAluno.value)return mostrarAlerta("Selecione o aluno.","error");criarNotificacao({tipo:notificacaoTipo.value,titulo:notificacaoTitulo.value.trim(),mensagem:notificacaoMensagem.value.trim(),publico:notificacaoPublico.value,alunoId:notificacaoAluno.value});formNotificacao.reset();renderizarNotificacoes();mostrarAlerta("Notificação enviada.")});
function renderizarNotificacoes(){if(!document.getElementById("listaNotificacoes"))return;listaNotificacoes.innerHTML=notificacoes.length?notificacoes.map(n=>`<article class="notification-card ${n.lida?"":"unread"}"><div class="notification-icon">🔔</div><div class="notification-content"><strong>${escaparHtml(n.titulo)}</strong><p>${escaparHtml(n.mensagem)}</p><small>${n.tipo} • ${new Date(n.criadaEm).toLocaleString("pt-BR")}</small></div><div class="notification-actions">${n.lida?"":`<button onclick="lerNotificacao('${n.id}')">Lida</button>`}<button onclick="apagarNotificacao('${n.id}')">Excluir</button></div></article>`).join(""):'<div class="empty">Nenhuma notificação.</div>';let q=notificacoes.filter(n=>!n.lida).length;[menuNotificationBadge,topNotificationBadge].forEach(x=>{x.textContent=q;x.classList.toggle("show",q>0)});totalNotificacoesNaoLidas.textContent=q}
function lerNotificacao(id){notificacoes=notificacoes.map(n=>n.id===id?{...n,lida:true}:n);salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}
function apagarNotificacao(id){notificacoes=notificacoes.filter(n=>n.id!==id);salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()}
document.getElementById("gerarAlertasMensalidade")?.addEventListener("click",()=>{let c=0,hoje=new Date();matriculas.forEach(m=>{if(m.status!=="Ativo")return;let d=Math.ceil((new Date(m.vencimento+"T00:00:00")-hoje)/86400000);if(d<=7){criarNotificacao({tipo:d<0?"Renovação":"Mensalidade",titulo:d<0?"Plano vencido":"Mensalidade próxima",mensagem:d<0?`Seu plano venceu em ${formatarData(m.vencimento)}.`:`Sua mensalidade vence em ${formatarData(m.vencimento)}.`,publico:"Aluno específico",alunoId:m.alunoId});c++}});mostrarAlerta(c?`${c} alerta(s) gerado(s).`:"Nenhum alerta necessário.")});
document.getElementById("marcarTodasNotificacoes")?.addEventListener("click",()=>{notificacoes=notificacoes.map(n=>({...n,lida:true}));salvar(NOTIFICACOES_STORAGE_KEY,notificacoes);renderizarNotificacoes()});
document.getElementById("topNotificationButton")?.addEventListener("click",()=>document.querySelector('[data-view="notificacoes"]')?.click());

/* =========================================================
   HOTFIX V36.1
   Restaura funções auxiliares removidas acidentalmente na V36.
   Sem estas funções, atualizarExtras() interrompia o script
   antes da inicialização do bridge Supabase.
========================================================= */

function preencherAlunosExtras(){
  ["carrinhoAluno","notificacaoAluno"].forEach(id=>{
    const s=document.getElementById(id);
    if(!s)return;
    const valorAtual=s.value;
    s.innerHTML=
      '<option value="">Selecione o aluno</option>'+
      alunos
        .filter(a=>a.status==="Ativo")
        .map(a=>`<option value="${a.id}">${escaparHtml(a.nome)}</option>`)
        .join("");
    s.value=valorAtual;
  });
}

function excluirProdutoLoja(id){
  if(!confirm("Excluir produto?"))return;

  produtosLoja=produtosLoja.filter(p=>p.id!==id);
  carrinhoLoja=carrinhoLoja.filter(i=>i.produtoId!==id);

  salvar(PRODUTOS_STORAGE_KEY,produtosLoja);
  salvar(CARRINHO_STORAGE_KEY,carrinhoLoja);

  renderizarProdutos();
  renderizarCarrinho();
}

function atualizarExtras(){renderizarVideos();renderizarProdutos();preencherAlunosExtras();renderizarCarrinho();renderizarPedidos();renderizarNotificacoes()}
const atualizarTudoAnteriorExtras=atualizarTudo;
atualizarTudo=function(){
  atualizarTudoAnteriorExtras();
  try{
    atualizarExtras();
  }catch(error){
    console.error("Falha em atualizar extras:",error);
  }
};
try{
  atualizarExtras();
}catch(error){
  console.error("Falha inicial em atualizar extras:",error);
}
window.excluirVideo=excluirVideo;window.adicionarCarrinho=adicionarCarrinho;window.excluirProdutoLoja=excluirProdutoLoja;window.removerCarrinho=removerCarrinho;window.lerNotificacao=lerNotificacao;window.apagarNotificacao=apagarNotificacao;window.cancelarReservaPedidoV376=cancelarReservaPedidoV376;

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
// CHECK-IN COM SELFIE — ÁREA DO ALUNO — V30
// ==========================================================
let studentSelfieFileV30 = null;

function statusCheckinLabelV30(status){
  const s=String(status||"pending");
  if(s==="approved") return {label:"PRESENÇA VALIDADA",className:"approved"};
  if(s==="rejected") return {label:"CHECK-IN RECUSADO",className:"rejected"};
  return {label:"AGUARDANDO VALIDAÇÃO",className:"pending"};
}

function belemAgoraV375(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Belem",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false
  }).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const hour=Number(get("hour"))%24, minute=Number(get("minute"));
  return {weekday:dayMap[get("weekday")]??-1,minutes:hour*60+minute,hour,minute};
}
function classStartMinutesV375(c){
  const [h,m]=String(c?.start_time||"00:00").split(":").map(Number);
  return (h||0)*60+(m||0);
}
function checkinLiberadoClasseV375(c){
  const now=belemAgoraV375();
  return Number(c?.weekday)===now.weekday && now.minutes>=classStartMinutesV375(c);
}
function atualizarBloqueioCheckinV375(classes=[]){
  const input=document.getElementById("studentSelfieInput");
  const label=document.querySelector('label[for="studentSelfieInput"]');
  const select=document.getElementById("studentCheckinClass");
  const button=document.getElementById("studentSelfieCheckinButton");
  const lock=document.getElementById("studentCheckinScheduleLock");
  const badge=document.getElementById("studentCheckinStatusBadge");
  const available=classes.filter(checkinLiberadoClasseV375);

  if(select){
    [...select.options].forEach(o=>{
      if(!o.value)return;
      const c=classes.find(x=>String(x.id)===String(o.value));
      o.disabled=!c||!checkinLiberadoClasseV375(c);
    });
    if(select.value){
      const selected=classes.find(c=>String(c.id)===String(select.value));
      if(selected&&!checkinLiberadoClasseV375(selected)) select.value="";
    }
    if(!select.value && available.length) select.value=available[0].id;
  }

  const unlocked=available.length>0;
  if(input) input.disabled=!unlocked;
  if(button) button.disabled=!unlocked;
  label?.classList.toggle("is-disabled",!unlocked);
  lock?.classList.toggle("unlocked",unlocked);

  if(lock){
    const strong=lock.querySelector("strong"),small=lock.querySelector("small"),icon=lock.querySelector(".student-checkin-lock-icon");
    if(unlocked){
      if(icon)icon.textContent="🔓";
      if(strong)strong.textContent="CHECK-IN LIBERADO";
      if(small)small.textContent="Sua turma já iniciou. Tire ou anexe uma selfie e envie sua presença.";
    }else{
      const prox=classes
        .filter(c=>Number(c.weekday)===belemAgoraV375().weekday)
        .sort((a,b)=>classStartMinutesV375(a)-classStartMinutesV375(b))[0];
      if(icon)icon.textContent="🔒";
      if(strong)strong.textContent="CHECK-IN BLOQUEADO";
      if(small)small.textContent=prox
        ? `Liberado hoje somente após ${String(prox.start_time||"").slice(0,5)}.`
        : "Você não possui uma turma liberada para check-in neste momento.";
    }
  }

  if(!unlocked && badge){
    badge.textContent="AGUARDANDO HORÁRIO DA AULA";
    badge.className="student-checkin-badge locked";
  }
  return unlocked;
}
let checkinScheduleTimerV375=null;

window.renderStudentSelfieCheckinV30 = async function(payload={}){
  const student=payload.student;
  const classes=Array.isArray(payload.classes)?payload.classes:[];
  const dbCheckins=(Array.isArray(payload.checkins)?payload.checkins:[])
    .slice()
    .sort((a,b)=>new Date(b.checked_in_at||b.created_at||0)-new Date(a.checked_in_at||a.created_at||0));
  const select=document.getElementById("studentCheckinClass");
  const history=document.getElementById("studentCheckinHistory");
  const badge=document.getElementById("studentCheckinStatusBadge");
  if(!student || !select || !history) return;

  const weekdaysV375=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  window.studentClassesForCheckinV375=classes;
  select.innerHTML='<option value="">Selecione sua turma</option>' + classes.map(c=>`
    <option value="${c.id}" ${checkinLiberadoClasseV375(c)?"":"disabled"}>
      ${escaparHtml(c.name)} • ${weekdaysV375[Number(c.weekday)]||"Dia"} ${String(c.start_time||"").slice(0,5)}
    </option>
  `).join("");
  atualizarBloqueioCheckinV375(classes);
  clearInterval(checkinScheduleTimerV375);
  checkinScheduleTimerV375=setInterval(()=>atualizarBloqueioCheckinV375(window.studentClassesForCheckinV375||[]),30000);

  const today=hojeIso();
  const todayCheckin=dbCheckins.find(c=>String(c.checkin_date||c.checked_in_at||"").slice(0,10)===today);
  if(todayCheckin && badge){
    const meta=statusCheckinLabelV30(todayCheckin.validation_status);
    badge.textContent=meta.label;
    badge.className=`student-checkin-badge ${meta.className}`;
  }else if(badge){
    if((classes||[]).some(checkinLiberadoClasseV375)){
      badge.textContent="PRONTO PARA CHECK-IN";
      badge.className="student-checkin-badge";
    }else{
      badge.textContent="AGUARDANDO HORÁRIO DA AULA";
      badge.className="student-checkin-badge locked";
    }
  }

  history.innerHTML=dbCheckins.length
    ? dbCheckins.map((c,index)=>{
        const meta=statusCheckinLabelV30(c.validation_status);
        const cls=classes.find(x=>String(x.id)===String(c.class_id));
        const date=String(c.checkin_date||c.checked_in_at||"").slice(0,10);
        const time=String(c.checked_in_at||"").slice(11,16);
        const hasPhoto=!!c.photo_url;
        const isLatest=index===0;

        if(isLatest){
          return `
            <article class="student-checkin-history-card student-checkin-latest">
              <div class="student-checkin-history-photo ${hasPhoto?"is-clickable":""}"
                   ${hasPhoto?`data-open-checkin-photo="${c.photo_url}" role="button" tabindex="0" aria-label="Abrir foto do último check-in"`:""}>
                ${hasPhoto
                  ? `<img data-checkin-photo-path="${c.photo_url}" alt="Selfie do último check-in">`
                  : `<div class="student-checkin-no-photo">✓</div>`
                }
              </div>
              <div class="student-checkin-history-content">
                <span class="student-checkin-latest-label">ÚLTIMO CHECK-IN</span>
                <strong>${escaparHtml(cls?.name || "Check-in")}</strong>
                <span>${formatarData(date)} • ${time}</span>
                <small class="student-checkin-status ${meta.className}">${meta.label}</small>
              </div>
            </article>
          `;
        }

        return `
          <article class="student-checkin-history-card student-checkin-compact">
            <div class="student-checkin-compact-date">
              <strong>${formatarData(date)}</strong>
              <span>${time}</span>
            </div>
            <small class="student-checkin-status ${meta.className}">${meta.label}</small>
            ${hasPhoto ? `
              <button type="button" class="student-checkin-photo-button"
                      data-open-checkin-photo="${c.photo_url}"
                      aria-label="Abrir foto deste check-in" title="Ver foto">
                📷
              </button>` : `
              <span class="student-checkin-photo-expired" title="Foto removida após 30 dias">—</span>`
            }
          </article>
        `;
      }).join("")
    : '<div class="empty">Você ainda não realizou check-in com selfie.</div>';

  await window.hidratarFotosCheckinV30?.(history);
  window.bindCheckinPhotoViewerV35?.(history);
};

window.openCheckinPhotoV35 = async function(path){
  if(!path) return;
  try{
    const url=await window.supabaseSignedCheckinUrl(path,300);
    if(!url) throw new Error("Foto indisponível.");

    let modal=document.getElementById("checkinPhotoViewerV35");
    if(!modal){
      modal=document.createElement("div");
      modal.id="checkinPhotoViewerV35";
      modal.className="checkin-photo-viewer-v35";
      modal.innerHTML=`
        <div class="checkin-photo-viewer-backdrop" data-close-checkin-photo></div>
        <div class="checkin-photo-viewer-dialog" role="dialog" aria-modal="true" aria-label="Foto do check-in">
          <button type="button" class="checkin-photo-viewer-close" data-close-checkin-photo aria-label="Fechar">×</button>
          <div class="checkin-photo-viewer-head">
            <span>📷 REGISTRO DE PRESENÇA</span>
            <small>Foto privada do check-in</small>
          </div>
          <img alt="Foto do check-in">
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click",e=>{
        if(e.target.closest("[data-close-checkin-photo]")) modal.classList.remove("show");
      });
      document.addEventListener("keydown",e=>{
        if(e.key==="Escape") modal.classList.remove("show");
      });
    }
    modal.querySelector("img").src=url;
    modal.classList.add("show");
  }catch(e){
    window.mostrarAlertaPremium?.("Foto indisponível","Esta foto pode ter ultrapassado o período de retenção de 30 dias.","erro");
  }
};

window.bindCheckinPhotoViewerV35 = function(root=document){
  root.querySelectorAll("[data-open-checkin-photo]").forEach(el=>{
    if(el.dataset.viewerBound==="1") return;
    el.dataset.viewerBound="1";
    const open=()=>window.openCheckinPhotoV35(el.dataset.openCheckinPhoto);
    el.addEventListener("click",open);
    el.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){ e.preventDefault(); open(); }
    });
  });
};

document.getElementById("studentSelfieInput")?.addEventListener("change",(event)=>{
  const file=event.target.files?.[0] || null;
  const preview=document.getElementById("studentSelfiePreview");
  const message=document.getElementById("studentSelfieCheckinMessage");
  studentSelfieFileV30=file;

  if(message) message.textContent="";

  if(!file){
    if(preview) preview.innerHTML=`
      <div class="student-selfie-placeholder">
        <span>📷</span>
        <strong>SUA SELFIE APARECE AQUI</strong>
        <small>A foto é privada e usada somente para validar a presença.</small>
      </div>`;
    return;
  }

  if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){
    studentSelfieFileV30=null;
    event.target.value="";
    if(message) message.textContent="Use uma imagem JPG, PNG ou WEBP.";
    return;
  }

  if(file.size > 10 * 1024 * 1024){
    studentSelfieFileV30=null;
    event.target.value="";
    if(message) message.textContent="A foto deve ter no máximo 10 MB.";
    return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
    if(preview) preview.innerHTML=`<img src="${reader.result}" alt="Prévia da selfie">`;
  };
  reader.readAsDataURL(file);
});

document.getElementById("studentSelfieCheckinButton")?.addEventListener("click",async()=>{
  const aluno=obterAlunoLogado();
  const classId=document.getElementById("studentCheckinClass")?.value;
  const message=document.getElementById("studentSelfieCheckinMessage");
  const button=document.getElementById("studentSelfieCheckinButton");

  if(!aluno){
    if(message) message.textContent="Sessão do aluno não encontrada.";
    return;
  }
  if(!classId){
    if(message) message.textContent="Selecione uma turma já liberada pelo horário.";
    return;
  }
  const selectedClass=(window.studentClassesForCheckinV375||[]).find(c=>String(c.id)===String(classId));
  if(!selectedClass || !checkinLiberadoClasseV375(selectedClass)){
    if(message) message.textContent=`Check-in liberado somente no dia da aula, após ${String(selectedClass?.start_time||"").slice(0,5)}.`;
    mostrarAlerta("O check-in ainda não foi liberado para esta aula.","error");
    return;
  }
  if(!studentSelfieFileV30){
    if(message) message.textContent="Tire ou escolha uma selfie antes de enviar.";
    return;
  }

  button.disabled=true;
  button.textContent="ENVIANDO CHECK-IN...";
  if(message) message.textContent="Enviando sua selfie com segurança...";

  try{
    await window.supabaseRegistrarSelfieCheckin({
      studentId:aluno.id,
      classId,
      file:studentSelfieFileV30
    });

    studentSelfieFileV30=null;
    const input=document.getElementById("studentSelfieInput");
    if(input) input.value="";
    const preview=document.getElementById("studentSelfiePreview");
    if(preview) preview.innerHTML=`
      <div class="student-selfie-success">
        <span>✓</span>
        <strong>CHECK-IN ENVIADO</strong>
        <small>Aguarde a validação do professor.</small>
      </div>`;

    if(message) message.textContent="Check-in enviado. Sua presença está aguardando validação.";
    mostrarAlerta("Selfie enviada. O professor já pode validar sua presença.");
  }catch(e){
    if(message) message.textContent=e.message || "Não foi possível enviar o check-in.";
    mostrarAlerta(e.message || "Falha ao enviar check-in.","error");
  }finally{
    button.disabled=false;
    button.textContent="ENVIAR SELFIE E CONFIRMAR CHECK-IN";
  }
});

// ==========================================================
// ÁREA DO ALUNO COM ACESSO POR CPF E COMPRAS
// ==========================================================
const STUDENT_SESSION_KEY = "fitcontrol_aluno_logado";

let alunoLogadoId =
  sessionStorage.getItem(STUDENT_SESSION_KEY) ||
  localStorage.getItem(STUDENT_SESSION_KEY) ||
  "";

let carrinhoAluno = [];

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

const studentProductQtyV375 = new Map();

function quantidadeSelecionadaProdutoV375(produtoId, estoque){
  const max=Math.max(1,Number(estoque||1));
  const atual=Math.max(1,Math.min(max,Number(studentProductQtyV375.get(String(produtoId))||1)));
  studentProductQtyV375.set(String(produtoId),atual);
  return atual;
}

function alterarQuantidadeProdutoV375(produtoId,delta){
  const produto=produtosLoja.find(p=>String(p.id)===String(produtoId));
  if(!produto)return;
  const max=Math.max(1,Number(produto.estoque||1));
  const atual=quantidadeSelecionadaProdutoV375(produtoId,max);
  const nova=Math.max(1,Math.min(max,atual+Number(delta||0)));
  studentProductQtyV375.set(String(produtoId),nova);

  const value=document.querySelector(`[data-student-product-qty-value="${CSS.escape(String(produtoId))}"]`);
  const subtotal=document.querySelector(`[data-student-product-subtotal="${CSS.escape(String(produtoId))}"]`);
  if(value)value.textContent=String(nova);
  if(subtotal)subtotal.textContent=formatarMoeda(precoProduto(produto)*nova);
}

function renderizarProdutosAreaAluno() {
  const container = document.getElementById("studentProductGrid");
  if (!container) return;

  const produtosAtivos = produtosLoja.filter(
    (produto) => produto.status === "Ativo" && Number(produto.estoque) > 0
  );

  container.innerHTML = produtosAtivos.length
    ? produtosAtivos.map((produto) => {
        const preco = precoProduto(produto);
        const promocao = preco < produto.preco;
        const qtd = quantidadeSelecionadaProdutoV375(produto.id, produto.estoque);

        return `
          <article class="student-product-card">
            <div class="student-product-image">
              ${
                produto.imagem
                  ? `<img src="${escaparHtml(produto.imagem)}" alt="${escaparHtml(produto.nome)}">`
                  : "🥋"
              }
            </div>

            <div class="student-product-content">
              <div class="student-product-tags">
                <span>${escaparHtml(produto.categoria)}</span>
                ${promocao ? '<span class="promotion-tag">Promoção</span>' : ""}
                <span>Estoque: ${produto.estoque}</span>
              </div>

              <h4>${escaparHtml(produto.nome)}</h4>
              <p>${escaparHtml(produto.descricao || "Produto disponível para retirada na academia.")}</p>

              <div class="product-prices">
                <strong class="product-price">${formatarMoeda(preco)}</strong>
                ${promocao ? `<span class="product-old-price">${formatarMoeda(produto.preco)}</span>` : ""}
              </div>

              <div class="student-product-purchase-row">
                <div class="student-qty-control" aria-label="Quantidade">
                  <button type="button" data-student-qty-minus="${produto.id}" aria-label="Diminuir quantidade">−</button>
                  <strong data-student-product-qty-value="${produto.id}">${qtd}</strong>
                  <button type="button" data-student-qty-plus="${produto.id}" aria-label="Aumentar quantidade">+</button>
                </div>

                <div class="student-product-subtotal">
                  <small>SUBTOTAL</small>
                  <strong data-student-product-subtotal="${produto.id}">${formatarMoeda(preco*qtd)}</strong>
                </div>
              </div>

              <button
                class="btn btn-primary student-product-buy"
                type="button"
                data-student-add-product="${produto.id}"
              >
                Adicionar ao carrinho
              </button>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="empty" style="grid-column:1/-1;">Nenhum produto disponível no momento.</div>`;
}

function adicionarProdutoCarrinhoAluno(produtoId) {
  const produto = produtosLoja.find(
    (item) => String(item.id) === String(produtoId)
  );

  if (!produto || produto.status !== "Ativo" || Number(produto.estoque) <= 0) {
    mostrarAlerta("Produto indisponível.", "error");
    return;
  }

  const escolhida=quantidadeSelecionadaProdutoV375(produtoId,produto.estoque);
  const itemExistente = carrinhoAluno.find(
    (item) => String(item.produtoId) === String(produtoId)
  );
  const noCarrinho=Number(itemExistente?.quantidade||0);
  const novaQuantidade=noCarrinho+escolhida;

  if(novaQuantidade>Number(produto.estoque)){
    mostrarAlerta(`Você pode adicionar no máximo ${produto.estoque} unidade(s).`,"error");
    return;
  }

  if(itemExistente) itemExistente.quantidade=novaQuantidade;
  else carrinhoAluno.push({produtoId,quantidade:escolhida});

  studentProductQtyV375.set(String(produtoId),1);
  renderizarProdutosAreaAluno();
  renderizarCarrinhoAreaAluno();
  atualizarResumoPagamentoV375();
  mostrarAlerta(`${escolhida} unidade(s) adicionada(s) ao carrinho.`);
}

function removerProdutoCarrinhoAluno(produtoId) {
  carrinhoAluno = carrinhoAluno.filter(
    (item) => String(item.produtoId) !== String(produtoId)
  );

  renderizarCarrinhoAreaAluno();
}

function alterarQuantidadeCarrinhoV375(produtoId,delta){
  const produto=produtosLoja.find(p=>String(p.id)===String(produtoId));
  const item=carrinhoAluno.find(i=>String(i.produtoId)===String(produtoId));
  if(!produto||!item)return;

  const nova=Number(item.quantidade||1)+Number(delta||0);
  if(nova<=0){
    removerProdutoCarrinhoAluno(produtoId);
    atualizarResumoPagamentoV375();
    return;
  }
  if(nova>Number(produto.estoque||0)){
    mostrarAlerta(`Estoque máximo disponível: ${produto.estoque}.`,"error");
    return;
  }
  item.quantidade=nova;
  renderizarCarrinhoAreaAluno();
  atualizarResumoPagamentoV375();
}

function renderizarCarrinhoAreaAluno() {
  const container = document.getElementById("studentCartList");
  if (!container) return;

  let total = 0;
  let quantidade = 0;

  const itensValidos = carrinhoAluno
    .map((item) => {
      const produto = produtosLoja.find((produto) => String(produto.id) === String(item.produtoId));
      if (!produto) return null;
      const subtotal = precoProduto(produto) * Number(item.quantidade||1);
      total += subtotal;
      quantidade += Number(item.quantidade||1);
      return { item, produto, subtotal };
    })
    .filter(Boolean);

  container.innerHTML = itensValidos.length
    ? itensValidos.map(({ item, produto, subtotal }) => `
        <div class="cart-item cart-item-v375">
          <div class="cart-item-main-v375">
            <strong>${escaparHtml(produto.nome)}</strong>
            <small>${formatarMoeda(precoProduto(produto))} cada</small>
            <div class="cart-qty-v375">
              <button type="button" data-cart-qty-minus="${produto.id}">−</button>
              <span>${item.quantidade}</span>
              <button type="button" data-cart-qty-plus="${produto.id}">+</button>
            </div>
          </div>
          <div class="cart-item-total-v375">
            <strong>${formatarMoeda(subtotal)}</strong>
            <button type="button" data-student-remove-product="${produto.id}" aria-label="Remover produto">×</button>
          </div>
        </div>
      `).join("")
    : '<div class="empty">Seu carrinho está vazio.</div>';

  document.getElementById("studentCartTotal").textContent = formatarMoeda(total);
  document.getElementById("studentCartCount").textContent = quantidade;
  atualizarResumoPagamentoV375();
}

function totalCarrinhoAlunoV375(){
  return carrinhoAluno.reduce((sum,item)=>{
    const produto=produtosLoja.find(p=>String(p.id)===String(item.produtoId));
    return sum+(produto?precoProduto(produto)*Number(item.quantidade||1):0);
  },0);
}

function atualizarResumoPagamentoV375(){
  const method=document.getElementById("studentPaymentMethod")?.value||"pix_full";
  const box=document.getElementById("studentPaymentSplitValue");
  if(!box)return;
  const total=totalCarrinhoAlunoV375();
  if(method==="pix_deposit"){
    const sinal=Math.round(total*30)/100;
    const restante=Math.max(0,total-sinal);
    box.textContent=`Sinal agora: ${formatarMoeda(sinal)} • Restante na retirada: ${formatarMoeda(restante)}`;
  }else{
    box.textContent=`PIX agora: ${formatarMoeda(total)} • Restante: R$ 0,00`;
  }
}

async function finalizarCompraAreaAluno() {
  const aluno=obterAlunoLogado();
  if(!aluno){
    mostrarAlerta("Sua sessão expirou. Entre novamente.","error");
    sairAreaAluno();
    return;
  }
  if(!carrinhoAluno.length) return mostrarAlerta("Seu carrinho está vazio.","error");

  const paymentOption=document.getElementById("studentPaymentMethod")?.value||"pix_full";
  if(!["pix_full","pix_deposit"].includes(paymentOption)){
    return mostrarAlerta("Selecione uma opção de PIX válida.","error");
  }

  const btn=document.getElementById("studentCheckoutButton");
  const old=btn?.textContent;
  if(btn){btn.disabled=true;btn.textContent="RESERVANDO E GERANDO PIX..."}

  try{
    const result=await window.supabaseStoreCheckoutV375?.(carrinhoAluno,paymentOption);
    if(!result?.order_id) throw new Error("O pedido não foi criado.");
    if(!result?.pix_qr_code_base64 || !result?.pix_copy_paste){
      throw new Error("O Asaas não retornou o QR Code do Pix.");
    }

    carrinhoAluno=[];
    renderizarCarrinhoAreaAluno();
    abrirPixPedidoV375(result);
    await window.supabaseRefreshCurrentUserV30?.();
    renderizarAreaAluno();

    mostrarAlerta("Itens reservados por 5 minutos. Finalize o PIX.");
  }catch(err){
    console.error("Checkout PIX V37.5:",err);
    mostrarAlerta(err?.message||"Não foi possível gerar o PIX.","error");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old||"GERAR PIX E RESERVAR POR 5 MIN"}
  }
}

let championPixTimerV37=null;
let championPixPollV37=null;

function fecharPixPedidoV37(){
  clearInterval(championPixTimerV37);
  clearInterval(championPixPollV37);
  championPixTimerV37=null; championPixPollV37=null;
  document.getElementById("championPixModalV37")?.remove();
}

function abrirPixPedidoV375(data){
  fecharPixPedidoV37();
  const exp=new Date(data.pix_expires_at).getTime();
  const img=String(data.pix_qr_code_base64||"");
  const src=img.startsWith("data:")?img:`data:image/png;base64,${img}`;
  const isDeposit=data.payment_option==="pix_deposit";
  const modal=document.createElement("div");
  modal.id="championPixModalV37";
  modal.className="pix-modal-v37";
  modal.innerHTML=`
    <div class="pix-card-v37">
      <button type="button" class="pix-close-v37" data-pix-close>×</button>
      <span class="pix-kicker-v37">PAGAMENTO SEGURO • ASAAS SANDBOX</span>
      <h3>PIX GERADO</h3>
      <p>Pedido <strong>${escaparHtml(data.code||"")}</strong></p>

      <div class="pix-order-values-v375">
        <div><span>Total do pedido</span><strong>${formatarMoeda(Number(data.total||0))}</strong></div>
        <div class="highlight"><span>${isDeposit?"Sinal PIX (30%)":"Valor do PIX"}</span><strong>${formatarMoeda(Number(data.amount_due_now ?? data.total ?? 0))}</strong></div>
        ${isDeposit?`<div><span>Restante na retirada</span><strong>${formatarMoeda(Number(data.remaining_balance||0))}</strong></div>`:""}
      </div>

      <div class="pix-reservation-v375">
        <span>🔒 ITENS RESERVADOS</span>
        <small>Nenhum outro aluno pode reservar estas unidades durante o contador.</small>
      </div>

      <div class="pix-qr-wrap-v37"><img src="${src}" alt="QR Code Pix"></div>
      <div class="pix-timer-v37"><span>RESERVA EXPIRA EM</span><strong id="pixCountdownV37">05:00</strong></div>

      <label class="pix-copy-label-v37">PIX COPIA E COLA</label>
      <div class="pix-copy-row-v37">
        <input id="pixCopyV37" readonly value="${escaparHtml(data.pix_copy_paste||"")}">
        <button type="button" data-copy-store-pix>COPIAR</button>
      </div>

      <div id="pixStatusV37" class="pix-status-v37 waiting"><span></span> Aguardando confirmação automática do Asaas...</div>
      <small>A confirmação chega pelo webhook. Não é necessário enviar comprovante.</small>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector("[data-pix-close]")?.addEventListener("click",fecharPixPedidoV37);
  modal.querySelector("[data-copy-store-pix]")?.addEventListener("click",async()=>{
    const input=modal.querySelector("#pixCopyV37");
    try{await navigator.clipboard.writeText(input.value)}catch{input.select();document.execCommand("copy")}
    mostrarAlerta("Código PIX copiado.");
  });

  let warned30=false;
  const tick=async()=>{
    const left=Math.max(0,exp-Date.now());
    const min=Math.floor(left/60000),sec=Math.floor((left%60000)/1000);
    const el=document.getElementById("pixCountdownV37");
    if(el)el.textContent=`${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;

    if(left<=30000 && left>0 && !warned30){
      warned30=true;
      mostrarAlerta("Faltam 30 segundos para a reserva expirar.");
    }

    if(left<=0){
      clearInterval(championPixTimerV37); clearInterval(championPixPollV37);
      const st=document.getElementById("pixStatusV37");
      if(st){st.className="pix-status-v37 expired";st.innerHTML="<span></span> Reserva expirada. Os itens foram liberados."}
      try{await window.supabaseExpireStoreOrderV37?.(data.order_id)}catch(e){console.warn(e)}
      await window.supabaseRefreshCurrentUserV30?.().catch(()=>{});
      renderizarAreaAluno();
    }
  };
  tick();
  championPixTimerV37=setInterval(tick,1000);

  const poll=async()=>{
    try{
      const order=await window.supabaseGetStoreOrderV375?.(data.order_id);
      if(["paid","deposit_paid"].includes(order?.status)){
        clearInterval(championPixTimerV37);clearInterval(championPixPollV37);
        const st=document.getElementById("pixStatusV37");
        if(st){
          st.className="pix-status-v37 paid";
          st.innerHTML=order.status==="deposit_paid"
            ? "<span></span> SINAL CONFIRMADO AUTOMATICAMENTE ✓"
            : "<span></span> PAGAMENTO CONFIRMADO AUTOMATICAMENTE ✓";
        }
        const c=document.getElementById("pixCountdownV37");if(c)c.textContent="PAGO";
        await window.supabaseRefreshCurrentUserV30?.();
        renderizarAreaAluno();
        mostrarAlerta(order.status==="deposit_paid"
          ? "Sinal confirmado! O restante será pago na retirada."
          : "Pagamento confirmado! A academia já foi notificada.");
      }else if(order?.status==="cancelled"){
        clearInterval(championPixTimerV37);clearInterval(championPixPollV37);
        const st=document.getElementById("pixStatusV37");
        if(st){st.className="pix-status-v37 expired";st.innerHTML="<span></span> Pedido cancelado / reserva liberada."}
      }
    }catch(e){console.warn("Consulta do pedido:",e)}
  };
  championPixPollV37=setInterval(poll,2500);
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


document.getElementById("studentPaymentMethod")?.addEventListener("change",atualizarResumoPagamentoV375);

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
  const qtyPlus=event.target.closest("[data-student-qty-plus]");
  if(qtyPlus){
    alterarQuantidadeProdutoV375(qtyPlus.dataset.studentQtyPlus,1);
    return;
  }

  const qtyMinus=event.target.closest("[data-student-qty-minus]");
  if(qtyMinus){
    alterarQuantidadeProdutoV375(qtyMinus.dataset.studentQtyMinus,-1);
    return;
  }

  const cartPlus=event.target.closest("[data-cart-qty-plus]");
  if(cartPlus){
    alterarQuantidadeCarrinhoV375(cartPlus.dataset.cartQtyPlus,1);
    return;
  }

  const cartMinus=event.target.closest("[data-cart-qty-minus]");
  if(cartMinus){
    alterarQuantidadeCarrinhoV375(cartMinus.dataset.cartQtyMinus,-1);
    return;
  }

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
const INDICACOES_FAIXA_KEY = "champion_team_indicacoes_faixa";
let indicacoesFaixa = carregar(INDICACOES_FAIXA_KEY);

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






function configurarFormularioAlterarSenha({
  formId,
  senhaAtualId,
  novaSenhaId,
  confirmarSenhaId
}) {
  document.getElementById(formId)?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const atual = document.getElementById(senhaAtualId).value;
    const nova = document.getElementById(novaSenhaId).value;
    const confirmar = document.getElementById(confirmarSenhaId).value;
    const botao = event.submitter;

    if (nova.length < 6) {
      mostrarAlerta("A nova senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (nova !== confirmar) {
      mostrarAlerta("A confirmação da nova senha não confere.", "error");
      return;
    }

    if (atual === nova) {
      mostrarAlerta("A nova senha deve ser diferente da senha atual.", "error");
      return;
    }

    try {
      if (botao) {
        botao.disabled = true;
        botao.textContent = "Atualizando...";
      }

      await window.supabaseAlterarSenhaUsuario?.(atual, nova);

      event.target.reset();
      mostrarAlerta("Senha atualizada com sucesso.");
    } catch (erro) {
      mostrarAlerta(
        erro.message || "Não foi possível atualizar a senha.",
        "error"
      );
    } finally {
      if (botao) {
        botao.disabled = false;
        botao.textContent = "Atualizar senha";
      }
    }
  });
}

configurarFormularioAlterarSenha({
  formId: "formAlterarSenhaAluno",
  senhaAtualId: "senhaAtualAluno",
  novaSenhaId: "novaSenhaAluno",
  confirmarSenhaId: "confirmarNovaSenhaAluno"
});

configurarFormularioAlterarSenha({
  formId: "formAlterarSenhaProfessor",
  senhaAtualId: "senhaAtualProfessor",
  novaSenhaId: "novaSenhaProfessor",
  confirmarSenhaId: "confirmarNovaSenhaProfessor"
});





/* =========================================================
   INDICAÇÕES DE FAIXA PELOS PROFESSORES — V21
========================================================= */
function professorLogadoAtual() {
  const perfil = JSON.parse(localStorage.getItem("champion_perfil") || "{}");
  return professores.find(
    professor => String(professor.id) === String(perfil.profileId)
  ) || {
    id: perfil.profileId || "",
    nome: perfil.nome || "Professor"
  };
}

function preencherAlunosIndicacao() {
  const select = document.getElementById("indicacaoAluno");
  if (!select) return;

  const atual = select.value;
  select.innerHTML =
    '<option value="">Selecione o aluno</option>' +
    alunos
      .filter(aluno => aluno.status === "Ativo")
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(aluno => `<option value="${aluno.id}">${aluno.nome}</option>`)
      .join("");

  if ([...select.options].some(option => option.value === atual)) {
    select.value = atual;
  }
}

function renderizarIndicacoesFaixa() {
  const perfil = JSON.parse(localStorage.getItem("champion_perfil") || "{}");
  const professor = professorLogadoAtual();

  const professorContainer = document.getElementById("listaIndicacoesProfessor");
  if (professorContainer) {
    const minhas = indicacoesFaixa
      .filter(item => String(item.professorId) === String(professor.id))
      .sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));

    professorContainer.innerHTML = minhas.length
      ? minhas.map(item => {
          const aluno = alunos.find(a => String(a.id) === String(item.alunoId));
          return `
            <article class="teacher-indication-card">
              <div>
                <strong>${aluno?.nome || "Aluno não encontrado"}</strong>
                <small>${item.faixaSugerida} · ${item.grauSugerido || 0}º grau</small>
              </div>
              <span class="indication-status indication-${String(item.status || "Pendente").toLowerCase()}">
                ${item.status || "Pendente"}
              </span>
              <p>${item.observacao || ""}</p>
            </article>
          `;
        }).join("")
      : '<div class="empty-state">Nenhuma indicação enviada.</div>';
  }

  const gestorContainer = document.getElementById("listaIndicacoesGestor");
  if (gestorContainer) {
    const lista = [...indicacoesFaixa].sort(
      (a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm))
    );

    gestorContainer.innerHTML = lista.length
      ? lista.map(item => {
          const aluno = alunos.find(a => String(a.id) === String(item.alunoId));
          const prof = professores.find(p => String(p.id) === String(item.professorId));
          return `
            <article class="manager-indication-card">
              <div class="manager-indication-main">
                <div>
                  <strong>${aluno?.nome || "Aluno não encontrado"}</strong>
                  <small>Professor: ${prof?.nome || item.professorNome || "Não informado"}</small>
                </div>
                <span class="access-role access-role-professor">
                  ${item.faixaSugerida} · ${item.grauSugerido || 0}º grau
                </span>
              </div>
              <p>${item.observacao || ""}</p>
              <div class="manager-indication-actions">
                <span class="indication-status indication-${String(item.status || "Pendente").toLowerCase()}">
                  ${item.status || "Pendente"}
                </span>
                ${item.status === "Pendente" ? `
                  <button type="button" class="btn btn-success"
                    onclick="atualizarStatusIndicacao('${item.id}','Aprovada')">Aprovar</button>
                  <button type="button" class="btn btn-danger"
                    onclick="atualizarStatusIndicacao('${item.id}','Recusada')">Recusar</button>
                ` : ""}
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty-state">Nenhuma indicação recebida.</div>';
  }
}

document.getElementById("formIndicacaoFaixa")?.addEventListener("submit", event => {
  event.preventDefault();

  const professor = professorLogadoAtual();
  const alunoId = document.getElementById("indicacaoAluno").value;
  const faixaSugerida = document.getElementById("indicacaoFaixa").value;
  const grauSugerido = Number(document.getElementById("indicacaoGrau").value || 0);
  const observacao = document.getElementById("indicacaoObservacao").value.trim();

  if (!professor.id) {
    mostrarAlerta("O perfil do professor não está vinculado corretamente.", "error");
    return;
  }

  indicacoesFaixa.push({
    id: gerarId(),
    alunoId,
    professorId: professor.id,
    professorNome: professor.nome,
    faixaSugerida,
    grauSugerido,
    observacao,
    status: "Pendente",
    criadaEm: new Date().toISOString()
  });

  salvar(INDICACOES_FAIXA_KEY, indicacoesFaixa);
  event.target.reset();
  preencherAlunosIndicacao();
  renderizarIndicacoesFaixa();
  mostrarAlerta("Indicação enviada ao gestor.");
});

window.atualizarStatusIndicacao = function(id, status) {
  indicacoesFaixa = indicacoesFaixa.map(item =>
    item.id === id
      ? {
          ...item,
          status,
          analisadaEm: new Date().toISOString()
        }
      : item
  );

  salvar(INDICACOES_FAIXA_KEY, indicacoesFaixa);
  renderizarIndicacoesFaixa();
  mostrarAlerta(`Indicação ${status.toLowerCase()}.`);
};



const atualizarTudoAntesDasIndicacoes = atualizarTudo;
atualizarTudo = function() {
  atualizarTudoAntesDasIndicacoes();
  preencherAlunosIndicacao();
  renderizarIndicacoesFaixa();
};



/* =========================================================
   PAINEL DO PROFESSOR — V28
========================================================= */
window.renderProfessorOverviewV28 = function(payload = {}){
  const root = document.getElementById("teacherOverview");
  if (!root) return;

  const classes = Array.isArray(payload.classes) ? payload.classes : [];
  const classStudents = Array.isArray(payload.classStudents) ? payload.classStudents : [];
  const checkins = Array.isArray(payload.checkins) ? payload.checkins : [];
  const students = Array.isArray(payload.students) ? payload.students : [];

  const today = new Date();
  const isoToday = [
    today.getFullYear(),
    String(today.getMonth()+1).padStart(2,"0"),
    String(today.getDate()).padStart(2,"0")
  ].join("-");

  const classIds = new Set(classes.map(x=>String(x.id)));
  const linkedStudentIds = new Set(
    classStudents
      .filter(x=>classIds.has(String(x.class_id)))
      .map(x=>String(x.student_id))
  );

  const checkinsToday = checkins.filter(x=>{
    const date = String(x.checked_in_at || x.checkin_date || "").slice(0,10);
    return date === isoToday && classIds.has(String(x.class_id));
  });

  document.getElementById("teacherClassesCount").textContent = classes.length;
  document.getElementById("teacherStudentsCount").textContent = linkedStudentIds.size;
  document.getElementById("teacherCheckinsToday").textContent = checkinsToday.filter(x=>x.validation_status!=="rejected").length;

  const validationList=document.getElementById("teacherCheckinValidationList");
  const pending=checkinsToday.filter(x=>x.photo_url && (x.validation_status||"pending")==="pending");
  const pendingCount=document.getElementById("teacherPendingCheckinsCount");
  if(pendingCount) pendingCount.textContent=`${pending.length} PENDENTE${pending.length===1?"":"S"}`;

  if(validationList){
    const studentMap=new Map(students.map(s=>[String(s.id),s]));
    validationList.innerHTML=pending.length
      ? pending.map(c=>{
          const st=studentMap.get(String(c.student_id));
          const time=String(c.checked_in_at||"").slice(11,16);
          return `
            <article class="teacher-validation-card">
              <div class="teacher-validation-photo">
                <img data-checkin-photo-path="${c.photo_url}" alt="Selfie de ${st?.full_name||"aluno"}">
              </div>
              <div class="teacher-validation-content">
                <span class="teacher-validation-kicker">AGUARDANDO VALIDAÇÃO</span>
                <h5>${st?.full_name||"Aluno"}</h5>
                <p>${time||"--:--"} • ${classes.find(x=>String(x.id)===String(c.class_id))?.name||"Turma"}</p>
                <div class="teacher-validation-actions">
                  <button type="button" class="btn btn-success" data-validate-checkin="${c.id}" data-status="approved">CONFIRMAR PRESENÇA</button>
                  <button type="button" class="btn btn-danger" data-validate-checkin="${c.id}" data-status="rejected">RECUSAR</button>
                </div>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="teacher-empty-state">Nenhum check-in com selfie aguardando validação.</div>';

    window.hidratarFotosCheckinV30?.(validationList);
  }

  const studentsMap = new Map(students.map(s=>[String(s.id),s]));
  const weekdays = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const list = document.getElementById("teacherScheduleList");
  if (!list) return;

  if (!classes.length) {
    list.innerHTML = '<div class="teacher-empty-state">Nenhuma turma vinculada ao professor.</div>';
    return;
  }

  list.innerHTML = classes
    .slice()
    .sort((a,b)=>(Number(a.weekday||0)-Number(b.weekday||0)) || String(a.start_time||"").localeCompare(String(b.start_time||"")))
    .map(cls=>{
      const ids = classStudents.filter(x=>String(x.class_id)===String(cls.id)).map(x=>String(x.student_id));
      const presentToday = new Set(
        checkinsToday
          .filter(x=>String(x.class_id)===String(cls.id))
          .map(x=>String(x.student_id))
      );

      const names = ids
        .map(id=>studentsMap.get(id)?.full_name)
        .filter(Boolean)
        .slice(0,5);

      return `
        <article class="teacher-class-card">
          <div class="teacher-class-main">
            <div>
              <span class="teacher-class-day">${weekdays[Number(cls.weekday||0)] || "Dia"}</span>
              <h5>${cls.name || "Turma"}</h5>
              <p>${String(cls.start_time||"").slice(0,5)} → ${String(cls.end_time||"").slice(0,5)} • ${cls.level || "Todos os níveis"}</p>
            </div>
            <div class="teacher-class-count">
              <strong>${presentToday.size}/${ids.length}</strong>
              <span>presentes hoje</span>
            </div>
          </div>
          <div class="teacher-class-students">
            ${names.length ? names.map(n=>`<span>${n}</span>`).join("") : '<span class="muted">Sem alunos vinculados</span>'}
            ${ids.length > names.length ? `<span>+${ids.length-names.length}</span>` : ""}
          </div>
        </article>
      `;
    }).join("");
};

document.addEventListener("click", async (event)=>{
  const button=event.target.closest("[data-validate-checkin]");
  if(!button) return;

  const checkinId=button.dataset.validateCheckin;
  const statusValue=button.dataset.status;
  if(!checkinId || !statusValue) return;

  button.disabled=true;
  try{
    await window.supabaseValidarCheckin(checkinId,statusValue);
    mostrarAlerta(
      statusValue==="approved" ? "Presença confirmada." : "Check-in recusado.",
      statusValue==="approved" ? "success" : "error"
    );
  }catch(e){
    mostrarAlerta(e.message || "Não foi possível validar o check-in.","error");
  }finally{
    button.disabled=false;
  }
});

/* =========================================================
   SUPABASE NORMALIZADO — V28
   Fonte de verdade: tabelas PostgreSQL
========================================================= */
(function(){
  "use strict";

  if(window.__CHAMPION_SUPABASE_V27__) return;
  window.__CHAMPION_SUPABASE_V27__ = true;

  const cfg = window.CHAMPION_SUPABASE_CONFIG || {};
  let client = null;
  let user = null;
  let profile = null;
  let academy = null;
  let channels = [];
  let loginPromise = null;

  const legacyKeys = window.CHAMPION_SUPABASE_KEYS || [];

  const roleToLegacy = {
    master_admin: "gestor",
    owner: "gestor",
    teacher: "professor",
    student: "aluno"
  };

  const roleFromLegacy = {
    gestor: "owner",
    professor: "teacher",
    aluno: "student"
  };

  function status(type,message){
    window.atualizarStatusSupabase?.(type,message);
  }

  function err(error){
    const m = String(error?.message || error || "");
    if(/invalid login credentials/i.test(m)) return "E-mail ou senha inválidos.";
    if(/email not confirmed/i.test(m)) return "O e-mail ainda não foi confirmado.";
    if(/row level security|permission/i.test(m)) return "O Supabase bloqueou esta operação por segurança.";
    if(/fetch|network/i.test(m)) return "Falha de conexão com o Supabase.";
    return m || "Erro no Supabase.";
  }

  function init(){
    if(client) return client;

    if(!window.supabase?.createClient){
      throw new Error("SDK do Supabase não carregou.");
    }

    if(!/^https:\/\/.+\.supabase\.co$/.test(String(cfg.url || ""))){
      throw new Error("URL do Supabase inválida.");
    }

    if(!cfg.anonKey){
      throw new Error("Chave pública do Supabase não configurada.");
    }

    client = window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storageKey:"champion-team-v27-auth"
      }
    });

    return client;
  }

  const ativoTexto = v => v === false || v === "inactive" || v === "cancelled" ? "Inativo" : "Ativo";
  const statusMembership = v => {
    const map = {active:"Ativo",inactive:"Inativo",suspended:"Suspensa",cancelled:"Cancelada"};
    return map[v] || "Ativo";
  };
  const statusMembershipDb = v => {
    const s = String(v||"").toLowerCase();
    if(s.includes("cancel")) return "cancelled";
    if(s.includes("susp")) return "suspended";
    if(s.includes("inat")) return "inactive";
    return "active";
  };

  function legacyStudent(r){
    return {
      id:r.id,
      nome:r.full_name,
      cpf:r.cpf || "",
      telefone:r.phone || "",
      email:r.email || "",
      nascimento:r.birth_date || "",
      status:ativoTexto(r.active !== false && r.status === "active"),
      authUid:r.profile_id || "",
      faixa:r.belt || "Branca",
      grau:Number(r.degree || 0)
    };
  }

  function legacyTeacher(r){
    return {
      id:r.id,
      nome:r.full_name,
      cpf:r.cpf || "",
      cref:r.cref || "",
      especialidade:r.specialty || "Jiu-Jitsu",
      status:r.active ? "Ativo" : "Inativo",
      telefone:r.phone || "",
      email:r.email || "",
      turno:r.shift || "",
      admissao:r.admission_date || "",
      authUid:r.profile_id || ""
    };
  }

  function legacyPlan(r){
    return {
      id:r.id,
      nome:r.name,
      valor:Number(r.price || 0),
      duracao:Number(r.duration_months || 1),
      status:r.active ? "Ativo" : "Inativo"
    };
  }

  function legacyMembership(r){
    return {
      id:r.id,
      alunoId:r.student_id,
      planoId:r.plan_id,
      inicio:r.start_date,
      vencimento:r.next_due_date || "",
      pagamento:r.payment_method || "PIX",
      status:statusMembership(r.status)
    };
  }

  function legacyCheckin(r){
    return {
      id:r.id,
      alunoId:r.student_id,
      turmaId:r.class_id || "",
      data:String(r.checkin_date || r.checked_in_at || "").slice(0,10),
      horario:String(r.checked_in_at || "").slice(11,16),
      hora:String(r.checked_in_at || "").slice(11,16),
      fotoUrl:r.photo_url || "",
      origem:r.source || "student",
      validationStatus:r.validation_status || "approved",
      validatedAt:r.validated_at || "",
      validationNotes:r.validation_notes || ""
    };
  }

  function legacyProduct(r){
    return {
      id:r.id,
      nome:r.name,
      descricao:r.description || "",
      categoria:r.category || "",
      preco:Number(r.price || 0),
      precoPromocional:Number(r.promotional_price || 0),
      estoque:Number(r.stock || 0),
      imagem:r.image_url || "",
      imagePath:r.image_storage_path || "",
      status:r.active ? "Ativo" : "Inativo",
      destaque:!!r.featured
    };
  }

  function legacyNotification(r){
    const audience=String(r.audience||"student").toLowerCase();
    return {
      id:r.id,
      alunoId:r.student_id || "",
      publico: audience==="admin" ? "Administrador" : (r.student_id ? "Aluno específico" : "Todos os alunos"),
      titulo:r.title,
      mensagem:r.message,
      tipo:r.type || "info",
      criadaEm:r.created_at,
      criadoEm:r.created_at,
      lida:!!r.read_at,
      lidaEm:r.read_at || ""
    };
  }

  function legacyGraduation(r){
    return {
      id:r.id,
      alunoId:r.student_id,
      faixa:r.belt,
      grau:Number(r.degree || 0),
      data:r.graduated_at,
      observacoes:r.notes || ""
    };
  }

  function legacyRecommendation(r){
    return {
      id:r.id,
      alunoId:r.student_id,
      professorId:r.teacher_id,
      faixaSugerida:r.suggested_belt,
      grauSugerido:Number(r.suggested_degree || 0),
      observacao:r.justification || "",
      status:r.status === "approved" ? "Aprovada" : r.status === "rejected" ? "Recusada" : "Pendente",
      criadaEm:r.created_at
    };
  }

  async function getProfile(authUser){
    const {data,error} = await client
      .from("profiles")
      .select("*")
      .eq("id",authUser.id)
      .single();
    if(error) throw error;
    if(!data.active) throw new Error("Este acesso está desativado.");
    return data;
  }

  async function getAcademy(){
    if(academy) return academy;

    if(profile?.academy_id){
      const {data,error} = await client
        .from("academies")
        .select("*")
        .eq("id",profile.academy_id)
        .single();
      if(error) throw error;
      academy = data;
      return academy;
    }

    const {data,error} = await client
      .from("academies")
      .select("*")
      .eq("slug",cfg.academySlug)
      .single();
    if(error) throw error;
    academy = data;
    return academy;
  }

  async function fetchAppData(key){
    const a = await getAcademy();
    const {data,error} = await client
      .from("app_data")
      .select("items")
      .eq("academy_id",a.id)
      .eq("key",key)
      .maybeSingle();
    if(error) throw error;
    return Array.isArray(data?.items) ? data.items : [];
  }

  async function loadNormalized(){
    const a = await getAcademy();

    const [
      studentsRes, teachersRes, plansRes, membershipsRes, checkinsRes,
      productsRes, ordersRes, notificationsRes, gradRes, recRes,
      trainingPlansRes, trainingItemsRes, paymentsRes, billingEventsRes
    ] = await Promise.all([
      client.from("students").select("*").eq("academy_id",a.id),
      client.from("teachers").select("*").eq("academy_id",a.id),
      client.from("plans").select("*").eq("academy_id",a.id),
      client.from("memberships").select("*").eq("academy_id",a.id),
      client.from("checkins").select("*").eq("academy_id",a.id),
      client.from("products").select("*").eq("academy_id",a.id),
      client.from("orders").select("*,order_items(*)").eq("academy_id",a.id),
      client.from("notifications").select("*").eq("academy_id",a.id),
      client.from("graduation_history").select("*").eq("academy_id",a.id),
      client.from("belt_recommendations").select("*").eq("academy_id",a.id),
      client.from("training_plans").select("*").eq("academy_id",a.id),
      client.from("training_items").select("*"),
      client.from("payments").select("*").eq("academy_id",a.id).order("due_date",{ascending:true}),
      client.from("billing_events").select("*").eq("academy_id",a.id).order("created_at",{ascending:false}).limit(100)
    ]);

    const results = [
      studentsRes,teachersRes,plansRes,membershipsRes,checkinsRes,
      productsRes,ordersRes,notificationsRes,gradRes,recRes,
      trainingPlansRes,trainingItemsRes,paymentsRes,billingEventsRes
    ];

    const failed = results.find(x => x.error);
    if(failed) throw failed.error;

    const itemsByPlan = new Map();
    (trainingItemsRes.data||[]).forEach(item=>{
      if(!itemsByPlan.has(item.training_plan_id)) itemsByPlan.set(item.training_plan_id,[]);
      itemsByPlan.get(item.training_plan_id).push(item);
    });

    const fichas = (trainingPlansRes.data||[]).map(p=>({
      id:p.id,
      alunoId:p.student_id,
      professorId:p.teacher_id || "",
      objetivo:p.objective || "",
      nivel:p.level || "Iniciante",
      inicio:p.valid_from || "",
      validade:p.valid_until || "",
      diasSemana:Number(p.days_per_week || 3),
      status:p.active ? "Ativa" : "Inativa",
      observacoes:p.notes || "",
      exercicios:(itemsByPlan.get(p.id)||[])
        .sort((a,b)=>a.position-b.position)
        .map(x=>({
          id:x.id,
          nome:x.technique,
          grupo:x.muscle_group || "Jiu-Jitsu",
          series:Number(x.sets || 1),
          repeticoes:x.repetitions || "",
          carga:x.load || "",
          descanso:x.rest || "",
          videoUrl:x.video_url || ""
        }))
    }));

    const orders = (ordersRes.data||[]).map(o=>({
      id:o.id,
      codigo:o.code || ("PED-"+String(o.id).slice(0,8).toUpperCase()),
      alunoId:o.student_id,
      status:o.status,
      total:Number(o.total || 0),
      pagamento:o.payment_method || "PIX",
      paymentOption:o.payment_option||"pix_full",
      valorPix:Number(o.amount_due_now||o.total||0),
      saldoRetirada:Number(o.remaining_balance||0),
      providerPaymentId:o.provider_payment_id||"",
      pixExpiraEm:o.pix_expires_at||"",
      canceladoEm:o.cancelled_at||"",
      motivoCancelamento:o.cancellation_reason||"",
      estoqueLegadoRestaurado:!!o.legacy_stock_restored,
      criadoEm:o.created_at,
      itens:(o.order_items||[]).map(i=>({
        produtoId:i.product_id,
        nome:i.product_name,
        quantidade:Number(i.quantity || 1),
        valor:Number(i.unit_price || 0)
      }))
    }));

    window.aplicarDadosSupabase("fitcontrol_alunos",(studentsRes.data||[]).map(legacyStudent));
    window.aplicarDadosSupabase("fitcontrol_professores",(teachersRes.data||[]).map(legacyTeacher));
    window.aplicarDadosSupabase("fitcontrol_planos",(plansRes.data||[]).map(legacyPlan));
    window.aplicarDadosSupabase("fitcontrol_matriculas",(membershipsRes.data||[]).map(legacyMembership));
    window.aplicarDadosSupabase("fitcontrol_checkins",(checkinsRes.data||[]).map(legacyCheckin));
    window.aplicarDadosSupabase("fitcontrol_fichas_treino",fichas);
    window.aplicarDadosSupabase("fitcontrol_produtos_loja",(productsRes.data||[]).map(legacyProduct));
    window.aplicarDadosSupabase("fitcontrol_pedidos_loja",orders);
    window.aplicarDadosSupabase("fitcontrol_notificacoes",(notificationsRes.data||[]).map(legacyNotification));
    window.aplicarDadosSupabase("champion_team_historico_graduacao",(gradRes.data||[]).map(legacyGraduation));
    window.aplicarDadosSupabase("champion_team_indicacoes_faixa",(recRes.data||[]).map(legacyRecommendation));

    window.CHAMPION_BILLING_CRM_DATA = {
      students:studentsRes.data||[],
      memberships:membershipsRes.data||[],
      plans:plansRes.data||[],
      payments:paymentsRes.data||[],
      events:billingEventsRes.data||[]
    };
    window.renderBillingCrmV31?.(window.CHAMPION_BILLING_CRM_DATA);

    for(const key of [
      "fitcontrol_videos_jiujitsu",
      "champion_team_graduacoes",
      "champion_team_regras_graduacao",
      "champion_team_exames_graduacao"
    ]){
      try{
        window.aplicarDadosSupabase(key,await fetchAppData(key));
      }catch(e){
        console.warn("app_data indisponível:",key,e);
      }
    }
  }

  async function loadStudentOnly(){
    const {data:student,error:sError}=await client
      .from("students")
      .select("*")
      .eq("profile_id",user.id)
      .single();
    if(sError) throw sError;

    const sid = student.id;

    const [
      membershipsRes, plansRes, paymentsRes, checkinsRes, productsRes,
      ordersRes, notificationsRes, gradRes, recRes, trainingsRes, classStudentsRes
    ] = await Promise.all([
      client.from("memberships").select("*").eq("student_id",sid),
      client.from("plans").select("*").eq("academy_id",student.academy_id),
      client.from("payments").select("*").eq("student_id",sid),
      client.from("checkins").select("*").eq("student_id",sid).order("checked_in_at",{ascending:false}),
      client.from("products").select("*").eq("academy_id",student.academy_id).eq("active",true),
      client.from("orders").select("*,order_items(*)").eq("student_id",sid),
      client.from("notifications").select("*").eq("academy_id",student.academy_id),
      client.from("graduation_history").select("*").eq("student_id",sid),
      client.from("belt_recommendations").select("*").eq("student_id",sid),
      client.from("training_plans").select("*,training_items(*)").eq("student_id",sid),
      client.from("class_students").select("*").eq("student_id",sid)
    ]);

    const failed=[membershipsRes,plansRes,paymentsRes,checkinsRes,productsRes,ordersRes,notificationsRes,gradRes,recRes,trainingsRes,classStudentsRes].find(x=>x.error);
    if(failed) throw failed.error;

    const classIds = (classStudentsRes.data||[]).map(x=>x.class_id).filter(Boolean);
    let studentClasses = [];
    if(classIds.length){
      const {data:classData,error:classError}=await client
        .from("classes")
        .select("*")
        .in("id",classIds)
        .eq("active",true);
      if(classError) throw classError;
      studentClasses = classData || [];
    }

    window.CHAMPION_STUDENT_CHECKIN_DATA = {
      student,
      classes:studentClasses,
      checkins:checkinsRes.data||[]
    };

    window.CHAMPION_STUDENT_PAYMENT_DATA = {
      student,
      payments:paymentsRes.data||[],
      memberships:membershipsRes.data||[],
      plans:plansRes.data||[]
    };

    window.aplicarDadosSupabase("fitcontrol_alunos",[legacyStudent(student)]);
    window.aplicarDadosSupabase("fitcontrol_planos",(plansRes.data||[]).map(legacyPlan));
    window.aplicarDadosSupabase("fitcontrol_matriculas",(membershipsRes.data||[]).map(legacyMembership));
    window.aplicarDadosSupabase("fitcontrol_checkins",(checkinsRes.data||[]).map(legacyCheckin));
    window.aplicarDadosSupabase("fitcontrol_produtos_loja",(productsRes.data||[]).map(legacyProduct));
    window.aplicarDadosSupabase("fitcontrol_pedidos_loja",(ordersRes.data||[]).map(o=>({
      id:o.id,codigo:o.code||("PED-"+String(o.id).slice(0,8).toUpperCase()),alunoId:o.student_id,status:o.status,total:Number(o.total||0),pagamento:o.payment_method||"PIX",paymentOption:o.payment_option||"pix_full",valorPix:Number(o.amount_due_now||o.total||0),saldoRetirada:Number(o.remaining_balance||0),providerPaymentId:o.provider_payment_id||"",pixExpiraEm:o.pix_expires_at||"",criadoEm:o.created_at,
      itens:(o.order_items||[]).map(i=>({produtoId:i.product_id,nome:i.product_name,quantidade:i.quantity,valor:Number(i.unit_price||0)}))
    })));
    window.aplicarDadosSupabase("fitcontrol_notificacoes",(notificationsRes.data||[]).map(legacyNotification));
    window.aplicarDadosSupabase("champion_team_historico_graduacao",(gradRes.data||[]).map(legacyGraduation));
    window.aplicarDadosSupabase("champion_team_indicacoes_faixa",(recRes.data||[]).map(legacyRecommendation));
    window.aplicarDadosSupabase("fitcontrol_fichas_treino",(trainingsRes.data||[]).map(p=>({
      id:p.id,alunoId:p.student_id,professorId:p.teacher_id||"",objetivo:p.objective||"",nivel:p.level||"Iniciante",
      inicio:p.valid_from||"",validade:p.valid_until||"",diasSemana:Number(p.days_per_week||3),status:p.active?"Ativa":"Inativa",
      observacoes:p.notes||"",
      exercicios:(p.training_items||[]).sort((a,b)=>a.position-b.position).map(x=>({
        id:x.id,nome:x.technique,grupo:x.muscle_group||"Jiu-Jitsu",series:Number(x.sets||1),
        repeticoes:x.repetitions||"",carga:x.load||"",descanso:x.rest||"",videoUrl:x.video_url||""
      }))
    })));

    window.renderStudentPaymentHubV31?.(window.CHAMPION_STUDENT_PAYMENT_DATA);
    window.renderStudentSelfieCheckinV30?.(window.CHAMPION_STUDENT_CHECKIN_DATA);
  }

  async function loadTeacherOnly(){
    const {data:teacher,error}=await client
      .from("teachers").select("*").eq("profile_id",user.id).single();
    if(error) throw error;

    const a = await getAcademy();
    const [studentsRes,trainingsRes,recsRes,classesRes,classStudentsRes,checkinsRes] = await Promise.all([
      client.from("students").select("*").eq("academy_id",a.id),
      client.from("training_plans").select("*,training_items(*)").eq("academy_id",a.id),
      client.from("belt_recommendations").select("*").eq("academy_id",a.id),
      client.from("classes").select("*").eq("teacher_id",teacher.id).eq("active",true),
      client.from("class_students").select("*"),
      client.from("checkins").select("*").eq("academy_id",a.id)
    ]);

    if(studentsRes.error) throw studentsRes.error;
    if(trainingsRes.error) throw trainingsRes.error;
    if(recsRes.error) throw recsRes.error;
    if(classesRes.error) throw classesRes.error;
    if(classStudentsRes.error) throw classStudentsRes.error;
    if(checkinsRes.error) throw checkinsRes.error;

    window.renderProfessorOverviewV28?.({
      classes:classesRes.data||[],
      classStudents:classStudentsRes.data||[],
      checkins:checkinsRes.data||[],
      students:studentsRes.data||[]
    });

    window.aplicarDadosSupabase("fitcontrol_professores",[legacyTeacher(teacher)]);
    window.aplicarDadosSupabase("fitcontrol_alunos",(studentsRes.data||[]).map(legacyStudent));
    window.aplicarDadosSupabase("fitcontrol_fichas_treino",(trainingsRes.data||[]).map(p=>({
      id:p.id,alunoId:p.student_id,professorId:p.teacher_id||"",objetivo:p.objective||"",nivel:p.level||"Iniciante",
      inicio:p.valid_from||"",validade:p.valid_until||"",diasSemana:Number(p.days_per_week||3),status:p.active?"Ativa":"Inativa",
      observacoes:p.notes||"",
      exercicios:(p.training_items||[]).sort((a,b)=>a.position-b.position).map(x=>({
        id:x.id,nome:x.technique,grupo:x.muscle_group||"Jiu-Jitsu",series:Number(x.sets||1),
        repeticoes:x.repetitions||"",carga:x.load||"",descanso:x.rest||"",videoUrl:x.video_url||""
      }))
    })));
    window.aplicarDadosSupabase("champion_team_indicacoes_faixa",(recsRes.data||[]).map(legacyRecommendation));
  }

  async function deleteMissing(table,ids,academyId){
    let q = client.from(table).select("id").eq("academy_id",academyId);
    const {data,error}=await q;
    if(error) throw error;
    const keep=new Set(ids.map(String));
    const remove=(data||[]).map(x=>x.id).filter(id=>!keep.has(String(id)));
    if(remove.length){
      const {error:delError}=await client.from(table).delete().in("id",remove);
      if(delError) throw delError;
    }
  }

  async function saveAppData(key,items){
    const a=await getAcademy();
    const {error}=await client.from("app_data").upsert({
      academy_id:a.id,
      key,
      items:Array.isArray(items)?items:[],
      updated_by:user.id,
      updated_at:new Date().toISOString()
    },{onConflict:"academy_id,key"});
    if(error) throw error;
  }

  async function saveCore(key,items){
    const a = await getAcademy();
    items = Array.isArray(items)?items:[];

    if(key==="fitcontrol_alunos"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,profile_id:x.authUid||null,full_name:x.nome,cpf:x.cpf||null,email:x.email||null,
        phone:x.telefone||null,birth_date:x.nascimento||null,belt:x.faixa||"Branca",degree:Number(x.grau||0),
        status:String(x.status).toLowerCase()==="ativo"?"active":"inactive",updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("students").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("students",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_professores"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,profile_id:x.authUid||null,full_name:x.nome,cpf:x.cpf||null,email:x.email||null,
        phone:x.telefone||null,specialty:x.especialidade||"Jiu-Jitsu",cref:x.cref||null,active:x.status!=="Inativo",
        updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("teachers").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("teachers",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_planos"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,name:x.nome,price:Number(x.valor||0),duration_months:Number(x.duracao||1),
        active:x.status!=="Inativo",updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("plans").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("plans",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_matriculas"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,student_id:x.alunoId,plan_id:x.planoId,start_date:x.inicio,
        next_due_date:x.vencimento||null,status:statusMembershipDb(x.status),payment_method:x.pagamento||"PIX",
        updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("memberships").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("memberships",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_checkins"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,class_id:x.turmaId||null,student_id:x.alunoId,
        checkin_date:x.data || new Date().toISOString().slice(0,10),
        checked_in_at:x.data ? `${x.data}T${x.horario||x.hora||"12:00"}:00` : new Date().toISOString(),
        photo_url:x.fotoUrl||null,
        source:x.origem||"admin",
        validation_status:x.validationStatus||"approved",
        validation_notes:x.validationNotes||null
      }));
      if(rows.length){ const {error}=await client.from("checkins").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("checkins",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_produtos_loja"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,name:x.nome,description:x.descricao||null,category:x.categoria||null,
        price:Number(x.preco ?? x.valor ?? 0),
        promotional_price:Number(x.precoPromocional||0) > 0 ? Number(x.precoPromocional) : null,
        stock:Number(x.estoque||0),
        image_url:x.imagem||x.imagemUrl||null,
        image_storage_path:x.imagePath||null,
        active:x.status!=="Inativo",
        featured:!!x.destaque,
        updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("products").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("products",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_notificacoes"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,student_id:x.alunoId||null,title:x.titulo||"Notificação",message:x.mensagem||"",
        type:x.tipo||"info",read_at:x.lidaEm||null
      }));
      if(rows.length){ const {error}=await client.from("notifications").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("notifications",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="champion_team_indicacoes_faixa"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,student_id:x.alunoId,teacher_id:x.professorId,
        suggested_belt:x.faixaSugerida||"Branca",suggested_degree:Number(x.grauSugerido||0),
        justification:x.observacao||"Sem observação",
        status:x.status==="Aprovada"?"approved":x.status==="Recusada"?"rejected":"pending"
      }));
      if(rows.length){ const {error}=await client.from("belt_recommendations").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("belt_recommendations",rows.map(x=>x.id),a.id);
      return;
    }

    if(key==="fitcontrol_fichas_treino"){
      const rows=items.map(x=>({
        id:x.id,academy_id:a.id,student_id:x.alunoId,teacher_id:x.professorId||null,title:x.objetivo||"Treino",
        objective:x.objetivo||null,notes:x.observacoes||null,valid_from:x.inicio||null,valid_until:x.validade||null,
        active:x.status!=="Inativa",level:x.nivel||null,days_per_week:Number(x.diasSemana||3),updated_at:new Date().toISOString()
      }));
      if(rows.length){ const {error}=await client.from("training_plans").upsert(rows,{onConflict:"id"}); if(error)throw error; }
      await deleteMissing("training_plans",rows.map(x=>x.id),a.id);

      for(const ficha of items){
        await client.from("training_items").delete().eq("training_plan_id",ficha.id);
        const exercises=(ficha.exercicios||[]).map((e,i)=>({
          training_plan_id:ficha.id,position:i+1,technique:e.nome||"Técnica",muscle_group:e.grupo||"Jiu-Jitsu",
          sets:Number(e.series||1),repetitions:String(e.repeticoes||""),load:String(e.carga||""),rest:String(e.descanso||""),
          video_url:e.videoUrl||null
        }));
        if(exercises.length){
          const {error}=await client.from("training_items").insert(exercises);
          if(error)throw error;
        }
      }
      return;
    }

    return saveAppData(key,items);
  }



  async function mensagemErroEdgeV375(error,fallback){
    let msg=error?.message||fallback;
    try{
      if(error?.context && typeof error.context.clone==="function"){
        const response=error.context.clone();
        const payload=await response.json();
        if(payload?.error) msg=payload.error;
      }
    }catch{}
    return msg;
  }

  window.supabaseStoreCheckoutV375 = async function(items,paymentOption="pix_full"){
    if(!Array.isArray(items)||!items.length) throw new Error("Carrinho vazio.");
    const {data,error}=await client.functions.invoke("store-checkout",{
      body:{
        action:"checkout",
        payment_option:paymentOption,
        items:items.map(i=>({
          product_id:i.produtoId,
          quantity:Math.max(1,Number(i.quantidade||1))
        }))
      }
    });
    if(error) throw new Error(await mensagemErroEdgeV375(error,"Falha ao gerar o PIX."));
    if(data?.error) throw new Error(data.error);
    return data;
  };

  window.supabaseExpireStoreOrderV37 = async function(orderId){
    if(!orderId) return;
    const {data,error}=await client.functions.invoke("store-checkout",{body:{action:"expire_order",order_id:orderId}});
    if(error) throw new Error(await mensagemErroEdgeV375(error,"Falha ao liberar a reserva."));
    if(data?.error) throw new Error(data.error);
    await loadStudentOnly();
    return data;
  };

  window.supabaseCancelStoreOrderV376 = async function(orderId){
    if(!orderId) throw new Error("Pedido não identificado.");
    if(!profile||!["master_admin","owner"].includes(profile.role)){
      throw new Error("Somente a administração pode cancelar reservas.");
    }
    const {data,error}=await client.functions.invoke("store-checkout",{
      body:{action:"cancel_order",order_id:orderId}
    });
    if(error) throw new Error(await mensagemErroEdgeV375(error,"Falha ao cancelar a reserva."));
    if(data?.error) throw new Error(data.error);
    await loadNormalized();
    renderizarProdutos();
    renderizarPedidos();
    return data;
  };

  window.supabaseGetStoreOrderV375 = async function(orderId){
    const {data,error}=await client.from("orders")
      .select("id,code,status,total,paid_at,pix_expires_at,reservation_expires_at,payment_option,amount_due_now,remaining_balance")
      .eq("id",orderId).single();
    if(error) throw error;
    return data;
  };

  window.supabaseEnsurePixPaymentV31 = async function(paymentId){
    if(!paymentId) throw new Error("Mensalidade não identificada.");
    const {data,error}=await client.functions.invoke("billing-pix",{
      body:{action:"ensure_charge",payment_id:paymentId}
    });
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    await window.supabaseRefreshCurrentUserV30?.();
    return data;
  };

  window.supabaseRunBillingCrmV31 = async function(){
    if(!profile || !["master_admin","owner"].includes(profile.role)){
      throw new Error("Somente a administração pode executar a régua de cobrança.");
    }
    const {data,error}=await client.rpc("run_billing_crm_internal");
    if(error) throw error;
    await loadNormalized();
    return data;
  };


  window.supabaseUploadProductImageV36 = async function(file){
    if(!client || !user || !profile) throw new Error("Sessão do Supabase indisponível.");
    if(!["master_admin","owner"].includes(profile.role)) throw new Error("Somente a administração pode enviar fotos de produtos.");
    if(!file) throw new Error("Selecione uma imagem.");
    if(file.size>10*1024*1024) throw new Error("A imagem deve ter no máximo 10 MB.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Use JPG, PNG ou WEBP.");

    const a=await getAcademy();
    const ext=(file.name?.split(".").pop()||file.type.split("/").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${a.id}/catalog/${crypto.randomUUID()}.${ext}`;

    const {error}=await client.storage.from("products").upload(path,file,{
      cacheControl:"86400",
      upsert:false,
      contentType:file.type
    });
    if(error) throw error;

    const publicUrl=client.storage.from("products").getPublicUrl(path).data?.publicUrl||"";
    return {path,publicUrl};
  };

  window.supabaseUploadTrainingVideoV36 = async function(file){
    if(!client || !user || !profile) throw new Error("Sessão do Supabase indisponível.");
    if(!["master_admin","owner"].includes(profile.role)) throw new Error("Somente a administração pode enviar vídeos.");
    if(!file) throw new Error("Selecione um vídeo.");
    if(file.size>200*1024*1024) throw new Error("O vídeo deve ter no máximo 200 MB.");
    if(!["video/mp4","video/webm","video/quicktime"].includes(file.type)) throw new Error("Use MP4, WEBM ou MOV.");

    const a=await getAcademy();
    const ext=(file.name?.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"")||"mp4";
    const path=`${a.id}/library/${crypto.randomUUID()}.${ext}`;

    const {error}=await client.storage.from("training-videos").upload(path,file,{
      cacheControl:"3600",
      upsert:false,
      contentType:file.type
    });
    if(error) throw error;
    return {path};
  };

  window.supabaseSignedTrainingVideoUrlV36 = async function(path,expiresIn=3600){
    if(!path) return "";
    const {data,error}=await client.storage.from("training-videos").createSignedUrl(path,expiresIn);
    if(error) throw error;
    return data?.signedUrl||"";
  };

  window.supabaseSignedCheckinUrl = async function(path,expiresIn=900){
    if(!path) return "";
    if(/^https?:\/\//i.test(path)) return path;
    const {data,error}=await client.storage
      .from("checkins")
      .createSignedUrl(path,expiresIn);
    if(error) throw error;
    return data?.signedUrl || "";
  };

  window.hidratarFotosCheckinV30 = async function(root=document){
    const nodes=[...root.querySelectorAll("[data-checkin-photo-path]")];
    await Promise.all(nodes.map(async node=>{
      const path=node.dataset.checkinPhotoPath;
      if(!path) return;
      try{
        const url=await window.supabaseSignedCheckinUrl(path,900);
        if(url) node.src=url;
      }catch(e){
        console.warn("Não foi possível assinar foto do check-in",e);
      }
    }));
  };

  window.supabaseRegistrarSelfieCheckin = async function({studentId,classId,file}){
    if(!user || !profile || profile.role!=="student"){
      throw new Error("Somente o aluno pode registrar este check-in.");
    }
    if(!studentId || !classId || !file){
      throw new Error("Turma e selfie são obrigatórias.");
    }

    const {data:allowed,error:allowedError}=await client.rpc("can_student_checkin",{
      p_class_id:classId,
      p_student_id:studentId
    });
    if(allowedError) throw allowedError;
    if(!allowed) throw new Error("Check-in bloqueado: aguarde o horário de início da sua aula.");

    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Belem",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const part=t=>parts.find(p=>p.type===t)?.value||"";
    const today=`${part("year")}-${part("month")}-${part("day")}`;

    const {data:existing,error:existingError}=await client
      .from("checkins")
      .select("id,validation_status")
      .eq("student_id",studentId)
      .eq("class_id",classId)
      .eq("checkin_date",today)
      .maybeSingle();

    if(existingError) throw existingError;
    if(existing) throw new Error("Você já realizou o check-in desta turma hoje.");

    const ext=(file.name?.split(".").pop() || file.type?.split("/").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"") || "jpg";

    const path=`${user.id}/${today}-${crypto.randomUUID()}.${ext}`;

    const {error:uploadError}=await client.storage
      .from("checkins")
      .upload(path,file,{
        cacheControl:"3600",
        upsert:false,
        contentType:file.type || "image/jpeg"
      });
    if(uploadError) throw uploadError;

    const a=await getAcademy();

    const {data:created,error:insertError}=await client
      .from("checkins")
      .insert({
        academy_id:a.id,
        class_id:classId,
        student_id:studentId,
        checkin_date:today,
        checked_in_at:new Date().toISOString(),
        photo_url:path,
        source:"student_selfie",
        validation_status:"pending"
      })
      .select("*")
      .single();

    if(insertError){
      await client.storage.from("checkins").remove([path]).catch(()=>{});
      throw insertError;
    }

    await loadStudentOnly();
    return created;
  };

  window.supabaseValidarCheckin = async function(checkinId,statusValue,notes=""){
    if(!user || !profile || !["master_admin","owner","teacher"].includes(profile.role)){
      throw new Error("Você não possui permissão para validar presença.");
    }
    if(!["approved","rejected"].includes(statusValue)){
      throw new Error("Status de validação inválido.");
    }

    const {error}=await client
      .from("checkins")
      .update({
        validation_status:statusValue,
        validated_by:user.id,
        validated_at:new Date().toISOString(),
        validation_notes:String(notes||"").trim() || null
      })
      .eq("id",checkinId);

    if(error) throw error;

    if(profile.role==="teacher") await loadTeacherOnly();
    else await loadNormalized();

    return true;
  };

  window.supabaseRefreshCurrentUserV30 = async function(){
    if(!profile) return;
    if(profile.role==="student") return loadStudentOnly();
    if(profile.role==="teacher") return loadTeacherOnly();
    return loadNormalized();
  };

  window.supabaseCloudSave = async function(key,data){
    if(!user || !profile) throw new Error("Sessão Supabase ausente.");
    if(roleToLegacy[profile.role]==="aluno") throw new Error("Aluno não pode editar dados administrativos.");

    if(roleToLegacy[profile.role]==="professor" && !["fitcontrol_fichas_treino","champion_team_indicacoes_faixa"].includes(key)){
      throw new Error("Professor pode editar apenas treinos e indicações.");
    }

    status("syncing","Salvando no Supabase...");
    await saveCore(key,data);
    status("online",`Supabase conectado · versão ${window.CHAMPION_APP_VERSION}`);
  };

  window.supabaseCriarUsuario = async function({role,profileId,nome,email,cpf,password}){
    if(!profile || !["master_admin","owner"].includes(profile.role)){
      throw new Error("Somente a administração pode criar acessos.");
    }

    const a=await getAcademy();
    const dbRole=roleFromLegacy[role] || role;
    if(!["teacher","student"].includes(dbRole)){
      throw new Error("Este fluxo cria apenas professor ou aluno.");
    }

    const invitePayload={
      profile_id:profileId,
      full_name:nome,
      cpf:String(cpf||"").replace(/\D/g,""),
      email:String(email||"").trim().toLowerCase()
    };

    const {error:inviteError}=await client.from("access_invites").insert({
      academy_id:a.id,
      email:invitePayload.email,
      role:dbRole,
      payload:invitePayload,
      created_by:user.id
    });
    if(inviteError) throw inviteError;

    const secondary=window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });

    const {data,error}=await secondary.auth.signUp({
      email:invitePayload.email,
      password:String(password||""),
      options:{data:{invite_for:"champion-team"}}
    });
    if(error) throw error;
    if(!data.user) throw new Error("O Supabase não criou o usuário.");

    return {uid:data.user.id,email:invitePayload.email};
  };

  window.supabaseAtualizarPerfilAcesso = async function({authUid,nome,cpf}){
    if(!authUid) return;
    const {error}=await client.from("profiles").update({
      full_name:nome,
      cpf:String(cpf||"").replace(/\D/g,""),
      updated_at:new Date().toISOString()
    }).eq("id",authUid);
    if(error) throw error;
  };

  window.supabaseMigrarAcessoAluno = async ()=>true;
  window.supabaseMigrarProfessor = async ()=>true;

  window.supabaseExcluirPerfilAluno = async function(authUid){
    if(!authUid) return;
    const {error}=await client.from("profiles").update({
      active:false,
      updated_at:new Date().toISOString()
    }).eq("id",authUid);
    if(error) throw error;
  };

  window.supabaseAlterarSenhaUsuario = async function(senhaAtual,novaSenha){
    if(!user) throw new Error("Sessão inválida.");

    const verifier=window.supabase.createClient(cfg.url,cfg.anonKey,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });

    const {error:verifyError}=await verifier.auth.signInWithPassword({
      email:user.email,password:senhaAtual
    });
    if(verifyError) throw new Error("Senha atual incorreta.");

    const {error}=await client.auth.updateUser({password:novaSenha});
    if(error) throw error;
    return true;
  };

  async function openSession(authUser){
    user=authUser;
    profile=await getProfile(user);
    academy=null;

    const legacyRole=roleToLegacy[profile.role];
    if(!legacyRole) throw new Error("Perfil não reconhecido.");

    if(profile.role==="student") await loadStudentOnly();
    else if(profile.role==="teacher") await loadTeacherOnly();
    else await loadNormalized();

    window.CHAMPION_SUPABASE_READY=true;
    window.marcarSupabasePronto?.();

    return {
      user:{uid:user.id,id:user.id,email:user.email},
      perfil:{
        role:legacyRole,
        dbRole:profile.role,
        profileId:profile.role==="student"
          ? (JSON.parse(localStorage.getItem("fitcontrol_alunos")||"[]")[0]?.id || "")
          : profile.role==="teacher"
            ? (JSON.parse(localStorage.getItem("fitcontrol_professores")||"[]")[0]?.id || "")
            : "",
        nome:profile.full_name,
        ativo:profile.active
      }
    };
  }

  window.supabaseLogin = function(identifier,password){
    if(loginPromise) return loginPromise;

    loginPromise=(async()=>{
      try{
        init();
        const email=String(identifier||"").trim().toLowerCase();
        if(!email.includes("@")) throw new Error("Informe o e-mail cadastrado.");

        status("syncing","Autenticando...");
        const {data,error}=await client.auth.signInWithPassword({
          email,password:String(password||"")
        });
        if(error) throw error;

        const session=await openSession(data.user);
        status("online",`Supabase conectado · versão ${window.CHAMPION_APP_VERSION}`);
        return session;
      }catch(e){
        status("error",err(e));
        throw new Error(err(e));
      }finally{
        loginPromise=null;
      }
    })();

    return loginPromise;
  };

  window.supabaseLogout = async function(){
    if(client) await client.auth.signOut();
    user=null; profile=null; academy=null;
  };

  window.supabaseReconectar = async function(){
    init();
    const {data,error}=await client.auth.getUser();
    if(error) throw error;
    if(!data.user) return;
    await openSession(data.user);
    status("online","Supabase reconectado");
  };

  function setupRealtime(){
    if(!academy || !profile || profile.role==="student") return;

    channels.forEach(ch=>client.removeChannel(ch));
    channels=[];

    const tables=[
      "students","teachers","plans","memberships","checkins","classes","class_students",
      "training_plans","training_items","products","orders",
      "order_items","notifications","graduation_history","belt_recommendations"
    ];

    for(const table of tables){
      const ch=client
        .channel(`v27-${table}-${Date.now()}-${Math.random()}`)
        .on("postgres_changes",{event:"*",schema:"public",table},()=>{
          clearTimeout(window.__CHAMPION_RT_TIMER__);
          window.__CHAMPION_RT_TIMER__=setTimeout(()=>{
            if(profile?.role==="teacher") loadTeacherOnly().catch(console.error);
            else loadNormalized().catch(console.error);
          },350);
        })
        .subscribe();
      channels.push(ch);
    }
  }

  try{
    init();

    client.auth.getSession().then(async({data})=>{
      if(!data.session?.user) return;
      try{
        const restored=await openSession(data.session.user);
        window.dispatchEvent(new CustomEvent("champion-auth-restored",{detail:restored}));
        setupRealtime();
        status("online",`Supabase conectado · versão ${window.CHAMPION_APP_VERSION}`);
      }catch(e){
        console.error(e);
        await client.auth.signOut();
        status("error",err(e));
      }
    });

    client.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){
        user=null;profile=null;academy=null;
      }
    });
  }catch(e){
    status("error",err(e));
  }

  const oldLogin=window.supabaseLogin;
  window.supabaseLogin=async function(identifier,password){
    const result=await oldLogin(identifier,password);
    setupRealtime();
    return result;
  };
})();


/* =========================================================
   MENU HAMBÚRGUER MOBILE — V27
========================================================= */
(function configurarMenuMobileChampionTeam(){
  const sidebar=document.getElementById("appSidebar");
  const openButton=document.getElementById("mobileMenuButton");
  const closeButton=document.getElementById("mobileMenuClose");
  const backdrop=document.getElementById("mobileMenuBackdrop");
  const mobileNotification=document.getElementById("mobileNotificationButton");
  const mobileLogout=document.getElementById("mobileLogoutButton");

  if(!sidebar || !openButton || !backdrop)return;

  function menuAberto(){
    return sidebar.classList.contains("mobile-open");
  }

  function abrirMenu(){
    sidebar.classList.add("mobile-open");
    backdrop.classList.add("show");
    document.body.classList.add("mobile-menu-open");
    openButton.classList.add("active");
    openButton.setAttribute("aria-expanded","true");
    closeButton?.focus();
  }

  function fecharMenu({restaurarFoco=true}={}){
    sidebar.classList.remove("mobile-open");
    backdrop.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
    openButton.classList.remove("active");
    openButton.setAttribute("aria-expanded","false");
    if(restaurarFoco && window.innerWidth<=860)openButton.focus();
  }

  function alternarMenu(){
    menuAberto()?fecharMenu():abrirMenu();
  }

  openButton.addEventListener("click",alternarMenu);
  closeButton?.addEventListener("click",()=>fecharMenu());
  backdrop.addEventListener("click",()=>fecharMenu());

  sidebar.querySelectorAll('.menu button[data-view]').forEach(button=>{
    button.addEventListener("click",()=>{
      if(window.innerWidth<=860)fecharMenu({restaurarFoco:false});
    });
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && menuAberto())fecharMenu();
  });

  window.addEventListener("resize",()=>{
    if(window.innerWidth>860 && menuAberto())fecharMenu({restaurarFoco:false});
  });

  mobileNotification?.addEventListener("click",()=>{
    document.getElementById("topNotificationButton")?.click();
  });

  mobileLogout?.addEventListener("click",()=>{
    document.getElementById("logoutButton")?.click();
  });

  const observer=new MutationObserver(()=>{
    const source=document.getElementById("topNotificationBadge");
    const target=document.getElementById("mobileNotificationBadge");
    if(!source || !target)return;
    target.textContent=source.textContent||"0";
    target.classList.toggle("show",source.classList.contains("show") || Number(source.textContent||0)>0);
  });

  const sourceBadge=document.getElementById("topNotificationBadge");
  if(sourceBadge){
    observer.observe(sourceBadge,{subtree:true,childList:true,attributes:true,characterData:true});
  }
})();

/* =========================================================
   PREMIUM MOTION UI — V29
========================================================= */
(function(){
  "use strict";

  document.documentElement.classList.add("champion-premium-v29");

  function animateView(view){
    if(!view) return;
    view.classList.remove("view-enter");
    void view.offsetWidth;
    view.classList.add("view-enter");
  }

  document.addEventListener("click", (event)=>{
    const trigger = event.target.closest("[data-view], [data-go-view]");
    if(!trigger) return;

    requestAnimationFrame(()=>{
      const active = document.querySelector(".view.active");
      animateView(active);
    });
  });

  window.addEventListener("champion-auth-restored", ()=>{
    requestAnimationFrame(()=>{
      animateView(document.querySelector(".view.active"));
    });
  });

  // Microinterações somente para dispositivos com ponteiro preciso.
  if(window.matchMedia("(hover:hover) and (pointer:fine)").matches){
    document.addEventListener("pointermove",(event)=>{
      const card = event.target.closest(".card,.panel,.teacher-class-card,.product-card,.video-card");
      if(!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX-rect.left}px`);
      card.style.setProperty("--my", `${event.clientY-rect.top}px`);
    });
  }
})();


/* =========================================================
   CRM DE COBRANÇAS + PIX — V31
========================================================= */
(function(){
  "use strict";
  const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const todayIso=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
  const diffDays=s=>{if(!s)return 0;const a=new Date(todayIso()+"T12:00:00");const b=new Date(s+"T12:00:00");return Math.round((b-a)/86400000)};

  function meta(p){
    if(p.status==="paid")return{label:"PAGO",cls:"paid",stage:"Recebido"};
    const d=diffDays(p.due_date);
    if(p.status==="overdue"||d<0){const x=Math.abs(d);return{label:`${x} DIA${x===1?"":"S"} EM ATRASO`,cls:"overdue",stage:x>=7?"Cobrança reforçada":"Cobrança de atraso"}}
    if(d===0)return{label:"VENCE HOJE",cls:"today",stage:"Vencimento"};
    if(d<=7)return{label:`VENCE EM ${d}D`,cls:"upcoming",stage:d<=1?"Lembrete final":"Pré-vencimento"};
    return{label:"EM ABERTO",cls:"open",stage:"Aguardando"};
  }

  function openPayment(list){
    return (list||[]).filter(p=>!["paid","cancelled","refunded"].includes(p.status)).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))[0]||null;
  }

  window.renderStudentPaymentHubV31=function(payload={}){
    const content=document.getElementById("studentPaymentContent");
    const badge=document.getElementById("studentPaymentStatusBadge");
    if(!content||!badge)return;
    const p=openPayment(payload.payments||[]);
    if(!p){
      badge.textContent="SEM PENDÊNCIAS";badge.className="student-payment-status paid";
      content.innerHTML=`<div class="student-payment-clear"><span>✓</span><div><strong>TUDO EM DIA</strong><p>Não existe mensalidade pendente no momento.</p></div></div>`;
      return;
    }
    const m=meta(p);
    badge.textContent=m.label;badge.className=`student-payment-status ${m.cls}`;
    const qr=p.pix_qr_code_base64?`<img class="student-pix-qr" src="data:image/png;base64,${p.pix_qr_code_base64}" alt="QR Code Pix">`:`<div class="student-pix-placeholder"><span>PIX</span><small>Gere o código para pagar</small></div>`;
    content.innerHTML=`
      <div class="student-payment-summary">
        <div><span>VALOR</span><strong>${money(p.amount)}</strong></div>
        <div><span>VENCIMENTO</span><strong>${formatarData(p.due_date)}</strong></div>
        <div><span>SITUAÇÃO</span><strong class="payment-text-${m.cls}">${m.label}</strong></div>
      </div>
      <div class="student-pix-layout">
        <div class="student-pix-visual">${qr}</div>
        <div class="student-pix-actions">
          <span class="section-kicker">PIX</span><h4>PAGUE EM SEGUNDOS</h4>
          <p>Depois do pagamento, o sistema recebe a confirmação automaticamente pelo provedor.</p>
          ${p.pix_copy_paste?`<div class="pix-copy-box"><input id="studentPixCopyInput" readonly value="${String(p.pix_copy_paste).replace(/"/g,"&quot;")}"><button type="button" data-copy-pix>COPIAR PIX</button></div>`:""}
          <button type="button" class="btn btn-primary student-generate-pix" data-generate-pix="${p.id}">${p.pix_copy_paste?"ATUALIZAR PIX":"GERAR PIX PARA PAGAR"}</button>
          ${p.invoice_url?`<a class="student-invoice-link" href="${p.invoice_url}" target="_blank" rel="noopener">ABRIR COBRANÇA COMPLETA ↗</a>`:""}
        </div>
      </div>`;
  };

  window.renderBillingCrmV31=function(payload={}){
    const table=document.getElementById("billingCrmTable");if(!table)return;
    const students=payload.students||[], payments=payload.payments||[], events=payload.events||[];
    const studentMap=new Map(students.map(s=>[String(s.id),s]));
    const search=(document.getElementById("billingCrmSearch")?.value||"").trim().toLowerCase();
    const filter=document.getElementById("billingCrmFilter")?.value||"all";
    const month=todayIso().slice(0,7);
    const overdue=payments.filter(p=>p.status==="overdue"||(p.status==="pending"&&diffDays(p.due_date)<0));
    const today=payments.filter(p=>p.status==="pending"&&diffDays(p.due_date)===0);
    const upcoming=payments.filter(p=>p.status==="pending"&&diffDays(p.due_date)>0&&diffDays(p.due_date)<=7);
    const paid=payments.filter(p=>p.status==="paid"&&String(p.paid_at||"").slice(0,7)===month);
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set("billingMetricOverdueCount",overdue.length);set("billingMetricOverdueValue",money(overdue.reduce((s,p)=>s+Number(p.amount||0),0)));
    set("billingMetricTodayCount",today.length);set("billingMetricTodayValue",money(today.reduce((s,p)=>s+Number(p.amount||0),0)));
    set("billingMetricUpcomingCount",upcoming.length);set("billingMetricUpcomingValue",money(upcoming.reduce((s,p)=>s+Number(p.amount||0),0)));
    set("billingMetricPaidCount",paid.length);set("billingMetricPaidValue",money(paid.reduce((s,p)=>s+Number(p.amount||0),0)));
    const badge=document.getElementById("menuBillingBadge");if(badge){badge.textContent=overdue.length;badge.style.display=overdue.length?"":"none"}
    let rows=payments.slice().sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).filter(p=>{
      const st=studentMap.get(String(p.student_id)), name=String(st?.full_name||"").toLowerCase(), d=diffDays(p.due_date);
      if(search&&!name.includes(search))return false;
      if(filter==="overdue")return p.status==="overdue"||(p.status==="pending"&&d<0);
      if(filter==="today")return p.status==="pending"&&d===0;
      if(filter==="upcoming")return p.status==="pending"&&d>0&&d<=7;
      if(filter==="paid")return p.status==="paid";
      return true;
    });
    table.innerHTML=rows.length?rows.map(p=>{const st=studentMap.get(String(p.student_id)),m=meta(p);return`
      <tr><td><strong>${st?.full_name||"Aluno"}</strong><small>${st?.phone||st?.email||""}</small></td>
      <td>${formatarData(p.due_date)}</td><td><strong>${money(p.amount)}</strong></td>
      <td><span class="billing-status ${m.cls}">${m.label}</span></td><td><span class="billing-stage">${m.stage}</span></td>
      <td><button type="button" class="btn btn-secondary billing-pix-button" data-generate-pix="${p.id}">${p.pix_copy_paste?"PIX GERADO":"GERAR PIX"}</button></td></tr>`}).join(""):'<tr><td colspan="6" class="empty">Nenhuma mensalidade encontrada.</td></tr>';
    const tl=document.getElementById("billingCrmTimeline");
    if(tl)tl.innerHTML=events.length?events.slice(0,30).map(e=>`<article class="billing-timeline-item"><span class="billing-timeline-dot"></span><div><strong>${e.title||"Automação de cobrança"}</strong><p>${e.message||""}</p><small>${new Date(e.created_at).toLocaleString("pt-BR")}</small></div></article>`).join(""):'<div class="empty">Nenhuma ação de cobrança registrada.</div>';
  };

  document.addEventListener("click",async e=>{
    const g=e.target.closest("[data-generate-pix]");
    if(g){const id=g.dataset.generatePix,old=g.textContent;g.disabled=true;g.textContent="GERANDO PIX...";try{await window.supabaseEnsurePixPaymentV31(id);mostrarAlerta("Pix pronto para pagamento.");}catch(err){mostrarAlerta(err.message||"Falha ao gerar Pix.","error");}finally{g.disabled=false;g.textContent=old}return}
    if(e.target.closest("[data-copy-pix]")){const input=document.getElementById("studentPixCopyInput");if(!input)return;try{await navigator.clipboard.writeText(input.value)}catch{input.select();document.execCommand("copy")}mostrarAlerta("Código Pix copiado.");}
  });

  document.getElementById("billingCrmRunNow")?.addEventListener("click",async()=>{const b=document.getElementById("billingCrmRunNow");b.disabled=true;b.textContent="PROCESSANDO...";try{await window.supabaseRunBillingCrmV31();mostrarAlerta("Régua de cobrança processada.");}catch(e){mostrarAlerta(e.message||"Falha ao processar.","error")}finally{b.disabled=false;b.textContent="EXECUTAR RÉGUA AGORA"}});
  document.getElementById("billingCrmRefresh")?.addEventListener("click",()=>window.supabaseRefreshCurrentUserV30?.().catch(e=>mostrarAlerta(e.message,"error")));
  document.getElementById("billingCrmSearch")?.addEventListener("input",()=>window.renderBillingCrmV31?.(window.CHAMPION_BILLING_CRM_DATA||{}));
  document.getElementById("billingCrmFilter")?.addEventListener("change",()=>window.renderBillingCrmV31?.(window.CHAMPION_BILLING_CRM_DATA||{}));
})();


/* =========================================================
   PORTAL DO ALUNO — NAVEGAÇÃO INTERNA MOBILE — V32
========================================================= */
(function configurarNavegacaoInternaAlunoV32(){
  const nav = document.getElementById("studentPortalNav");
  if(!nav) return;

  const links = [...nav.querySelectorAll("[data-student-target]")];
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  const mobileButton = document.getElementById("mobileMenuButton");

  function fecharMenuAluno(){
    if(window.innerWidth > 860) return;
    sidebar?.classList.remove("mobile-open");
    backdrop?.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
    mobileButton?.classList.remove("active");
    mobileButton?.setAttribute("aria-expanded","false");
  }

  function marcarAtivo(targetId){
    links.forEach(link=>{
      const ativo = link.dataset.studentTarget === targetId;
      link.classList.toggle("active", ativo);
      if(ativo) link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    });
  }

  links.forEach(link=>{
    link.addEventListener("click",event=>{
      event.preventDefault();
      const id = link.dataset.studentTarget;
      const target = document.getElementById(id);
      if(!target) return;

      marcarAtivo(id);
      fecharMenuAluno();

      requestAnimationFrame(()=>{
        const headerOffset = window.innerWidth <= 860 ? 76 : 18;
        const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({top, behavior:"smooth"});

        target.classList.remove("student-section-pulse");
        void target.offsetWidth;
        target.classList.add("student-section-pulse");
        window.setTimeout(()=>target.classList.remove("student-section-pulse"),900);
      });
    });
  });

  const sections = links.map(link=>document.getElementById(link.dataset.studentTarget)).filter(Boolean);

  if("IntersectionObserver" in window && sections.length){
    const observer = new IntersectionObserver(entries=>{
      const visible = entries
        .filter(entry=>entry.isIntersecting)
        .sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];

      if(visible?.target?.id) marcarAtivo(visible.target.id);
    },{
      root:null,
      rootMargin:"-18% 0px -62% 0px",
      threshold:[0,.08,.2,.4,.7]
    });

    sections.forEach(section=>observer.observe(section));
  }

  marcarAtivo("studentPaymentSection");
})();

/* MENU MOBILE DO PROFESSOR — V34 */
(function(){
  const nav=document.getElementById("teacherPortalNav");
  if(!nav)return;
  const links=[...nav.querySelectorAll("[data-teacher-target]")];
  const sidebar=document.getElementById("appSidebar");
  const backdrop=document.getElementById("mobileMenuBackdrop");
  const mobileButton=document.getElementById("mobileMenuButton");

  function closeMenu(){
    if(window.innerWidth>860)return;
    sidebar?.classList.remove("mobile-open");
    backdrop?.classList.remove("show");
    document.body.classList.remove("mobile-menu-open");
    mobileButton?.classList.remove("active");
    mobileButton?.setAttribute("aria-expanded","false");
  }

  function active(id){
    links.forEach(link=>{
      const on=link.dataset.teacherTarget===id;
      link.classList.toggle("active",on);
      on?link.setAttribute("aria-current","location"):link.removeAttribute("aria-current");
    });
  }

  links.forEach(link=>{
    link.addEventListener("click",e=>{
      e.preventDefault();
      const id=link.dataset.teacherTarget;
      const target=document.getElementById(id)||document.getElementById("treinos");
      if(!target)return;
      active(id);
      closeMenu();
      requestAnimationFrame(()=>{
        const offset=window.innerWidth<=860?76:18;
        window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-offset,behavior:"smooth"});
        target.classList.remove("teacher-section-pulse");
        void target.offsetWidth;
        target.classList.add("teacher-section-pulse");
        setTimeout(()=>target.classList.remove("teacher-section-pulse"),900);
      });
    });
  });

  const sections=links.map(l=>document.getElementById(l.dataset.teacherTarget)).filter(Boolean);
  if("IntersectionObserver"in window){
    const observer=new IntersectionObserver(entries=>{
      const v=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(v?.target?.id)active(v.target.id);
    },{rootMargin:"-18% 0px -62% 0px",threshold:[0,.08,.2,.4,.7]});
    sections.forEach(s=>observer.observe(s));
  }
})();


/* =========================================================
   HOTFIX DE NAVEGAÇÃO — V36.3
   Evita quebra global quando uma view não possui título mapeado.
========================================================= */
window.addEventListener("error", (event) => {
  const msg = String(event?.error?.message || event?.message || "");
  if (msg.includes("textosPaginas") || msg.includes("can't access property 0")) {
    console.error("Falha de navegação capturada sem interromper o app:", msg);
  }
});
