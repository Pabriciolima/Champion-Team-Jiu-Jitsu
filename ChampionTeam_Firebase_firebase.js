/*
  CHAMPION TEAM — FIREBASE COMPAT
  Esta versão usa os scripts compatíveis carregados no index.html.
  Ela evita falhas silenciosas de importação do SDK modular.
*/

(function iniciarChampionFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyBxaunouh9vyEoseDrfgZkpdL1gswlk5wc",
    authDomain: "champion-team-jiu-jitsu.firebaseapp.com",
    projectId: "champion-team-jiu-jitsu",
    storageBucket: "champion-team-jiu-jitsu.firebasestorage.app",
    messagingSenderId: "172574452967",
    appId: "1:172574452967:web:cd64c1a576229f7fb5c642"
  };

  const COLLECTION_NAME = "championTeamData";
  const chaves = window.CHAMPION_FIREBASE_KEYS || [];
  const listeners = new Map();
  const pendencias = new Map();

  let authPronto = false;
  let sincronizacaoInicialConcluida = false;

  function status(tipo, mensagem) {
    window.atualizarStatusFirebase?.(tipo, mensagem);
  }

  function falhar(mensagem, erro) {
    console.error(mensagem, erro || "");
    status("error", mensagem);
  }

  function verificarSdk() {
    if (!window.firebase) {
      throw new Error(
        "O SDK do Firebase não carregou. Verifique a internet ou o bloqueio do navegador."
      );
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  }

  function firestore() {
    return firebase.firestore();
  }

  function auth() {
    return firebase.auth();
  }

  function documento(chave) {
    return firestore()
      .collection(COLLECTION_NAME)
      .doc(String(chave).replace(/[^a-zA-Z0-9_-]/g, "_"));
  }

  function metaLocal(chave) {
    return Number(
      localStorage.getItem(`champion_sync_meta_${chave}`) || 0
    );
  }

  function salvarMetaLocal(chave, valor) {
    localStorage.setItem(
      `champion_sync_meta_${chave}`,
      String(Number(valor) || Date.now())
    );
  }

  function assinatura(item, indice) {
    if (item && typeof item === "object" && item.id != null) {
      return `id:${String(item.id)}`;
    }

    try {
      return `json:${JSON.stringify(item)}`;
    } catch {
      return `indice:${indice}`;
    }
  }

  function mesclarListas(remoto, local, preferirLocal) {
    const mapa = new Map();

    (Array.isArray(remoto) ? remoto : []).forEach((item, indice) => {
      mapa.set(assinatura(item, indice), item);
    });

    (Array.isArray(local) ? local : []).forEach((item, indice) => {
      const chave = assinatura(item, indice);

      if (!mapa.has(chave) || preferirLocal) {
        mapa.set(chave, item);
      }
    });

    return [...mapa.values()];
  }

  async function autenticar() {
    if (auth().currentUser) {
      authPronto = true;
      return auth().currentUser;
    }

    const resultado = await auth().signInAnonymously();
    authPronto = true;
    return resultado.user;
  }

  async function gravar(chave, dados, atualizadoEmMs = Date.now()) {
    const lista = Array.isArray(dados) ? dados : [];

    if (!authPronto || !auth().currentUser) {
      pendencias.set(chave, {
        dados: lista,
        atualizadoEmMs
      });
      return;
    }

    status("syncing", "Salvando alterações no Firebase...");

    await documento(chave).set(
      {
        chaveOriginal: chave,
        itens: lista,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEmMs: Number(atualizadoEmMs) || Date.now(),
        atualizadoPor: auth().currentUser.uid,
        versao: 3
      },
      { merge: true }
    );

    salvarMetaLocal(chave, atualizadoEmMs);
    status("online", "Firebase conectado · dados sincronizados");
  }

  window.firebaseCloudSave = gravar;

  async function sincronizarChave(chave) {
    const ref = documento(chave);
    const snapshot = await ref.get();

    const local = window.obterDadosLocaisFirebase?.(chave) || [];
    const localTs = metaLocal(chave);

    if (!snapshot.exists) {
      const agora = localTs || Date.now();

      await ref.set({
        chaveOriginal: chave,
        itens: local,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEmMs: agora,
        atualizadoPor: auth().currentUser.uid,
        versao: 3
      });

      salvarMetaLocal(chave, agora);
      window.aplicarDadosFirebase?.(chave, local);
    } else {
      const dadosDoc = snapshot.data() || {};
      const remoto = Array.isArray(dadosDoc.itens)
        ? dadosDoc.itens
        : [];
      const remotoTs = Number(dadosDoc.atualizadoEmMs || 0);

      let final = remoto;
      let precisaEnviar = false;

      if (!remoto.length && local.length) {
        final = local;
        precisaEnviar = true;
      } else if (remoto.length && !local.length) {
        final = remoto;
      } else if (remoto.length && local.length) {
        const localMaisNovo = localTs > remotoTs;
        final = mesclarListas(remoto, local, localMaisNovo);

        precisaEnviar =
          localMaisNovo ||
          JSON.stringify(final) !== JSON.stringify(remoto);
      }

      window.aplicarDadosFirebase?.(chave, final);

      if (precisaEnviar) {
        await gravar(
          chave,
          final,
          Math.max(localTs, remotoTs, Date.now())
        );
      } else {
        salvarMetaLocal(chave, remotoTs || localTs || Date.now());
      }
    }

    if (listeners.has(chave)) {
      listeners.get(chave)();
    }

    const cancelar = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) return;

        const dadosDoc = snap.data() || {};
        const remoto = Array.isArray(dadosDoc.itens)
          ? dadosDoc.itens
          : [];

        window.aplicarDadosFirebase?.(chave, remoto);
        salvarMetaLocal(
          chave,
          Number(dadosDoc.atualizadoEmMs || Date.now())
        );

        status("online", "Firebase conectado · dados sincronizados");
      },
      (erro) => {
        console.error(`Erro ao sincronizar ${chave}:`, erro);

        if (erro?.code === "permission-denied") {
          falhar(
            "Acesso negado pelo Firestore. Publique as regras fornecidas.",
            erro
          );
          return;
        }

        falhar(
          "Firebase desconectado. Verifique a internet e tente novamente.",
          erro
        );
      }
    );

    listeners.set(chave, cancelar);
  }

  async function enviarPendencias() {
    const lista = [...pendencias.entries()];
    pendencias.clear();

    for (const [chave, item] of lista) {
      await gravar(chave, item.dados, item.atualizadoEmMs);
    }
  }

  async function iniciar() {
    status("syncing", "Carregando dados da academia...");

    verificarSdk();

    try {
      await firestore().enablePersistence({
        synchronizeTabs: true
      });
    } catch (erro) {
      console.info(
        "Cache offline indisponível ou já ativo:",
        erro?.code || erro
      );
    }

    await autenticar();

    const ordem = [
      "fitcontrol_alunos",
      ...chaves.filter((chave) => chave !== "fitcontrol_alunos")
    ];

    for (const chave of ordem) {
      await sincronizarChave(chave);
    }

    await enviarPendencias();

    sincronizacaoInicialConcluida = true;
    window.marcarFirebasePronto?.();

    status("online", "Firebase conectado · dados sincronizados");
  }

  window.firebaseReconectar = async function() {
    if (!navigator.onLine) return;

    try {
      verificarSdk();
      await autenticar();
      await enviarPendencias();

      status("online", "Firebase reconectado · dados sincronizados");
    } catch (erro) {
      falhar("Não foi possível reconectar ao Firebase.", erro);
    }
  };

  const timeout = setTimeout(() => {
    if (!sincronizacaoInicialConcluida) {
      falhar(
        "O Firebase não respondeu. Confira Authentication, Firestore e regras."
      );
    }
  }, 15000);

  iniciar()
    .then(() => clearTimeout(timeout))
    .catch((erro) => {
      clearTimeout(timeout);

      if (erro?.code === "auth/operation-not-allowed") {
        falhar(
          "Ative o login Anônimo no Firebase Authentication.",
          erro
        );
        return;
      }

      if (
        erro?.code === "permission-denied" ||
        erro?.code === "firestore/permission-denied"
      ) {
        falhar(
          "Publique as regras fornecidas no Firestore.",
          erro
        );
        return;
      }

      falhar(
        "Falha ao conectar ao Firebase. Verifique internet e configuração.",
        erro
      );
    });
})();