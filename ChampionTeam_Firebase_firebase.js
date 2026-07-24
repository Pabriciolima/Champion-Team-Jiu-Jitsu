/*
  CHAMPION TEAM — FIREBASE V5
  Base compartilhada entre computador e celular.
  LocalStorage é apenas cache offline.
*/
(function () {
  "use strict";

  const config = {
    apiKey: "AIzaSyBxaunouh9vyEoseDrfgZkpdL1gswlk5wc",
    authDomain: "champion-team-jiu-jitsu.firebaseapp.com",
    projectId: "champion-team-jiu-jitsu",
    storageBucket: "champion-team-jiu-jitsu.firebasestorage.app",
    messagingSenderId: "172574452967",
    appId: "1:172574452967:web:cd64c1a576229f7fb5c642"
  };

  const COLLECTION = "championTeamData";
  const chaves = Array.isArray(window.CHAMPION_FIREBASE_KEYS)
    ? window.CHAMPION_FIREBASE_KEYS
    : [];

  let db = null;
  let auth = null;
  let iniciado = false;
  let conectado = false;
  const listeners = new Map();
  const fila = new Map();

  function status(tipo, mensagem) {
    window.atualizarStatusFirebase?.(tipo, mensagem);
  }

  function erroLegivel(erro) {
    const codigo = erro?.code || "erro-desconhecido";

    const mensagens = {
      "auth/operation-not-allowed":
        "Login Anônimo desativado. Ative em Authentication > Método de login.",
      "auth/unauthorized-domain":
        "Domínio do Vercel não autorizado no Firebase Authentication.",
      "permission-denied":
        "Firestore bloqueou o acesso. Publique o arquivo firestore.rules.txt.",
      "firestore/permission-denied":
        "Firestore bloqueou o acesso. Publique o arquivo firestore.rules.txt.",
      "unavailable":
        "Firestore indisponível. Verifique a internet e tente novamente.",
      "failed-precondition":
        "O Firestore ainda não está pronto ou há outra aba usando o cache."
    };

    return `${mensagens[codigo] || erro?.message || "Falha ao conectar."} [${codigo}]`;
  }

  function falhar(erro) {
    console.error("Firebase Champion Team:", erro);
    status("error", erroLegivel(erro));
  }

  function verificarSdk() {
    if (!window.firebase) {
      throw Object.assign(
        new Error("SDK do Firebase não carregou."),
        { code: "sdk-nao-carregado" }
      );
    }
  }

  function ref(chave) {
    return db.collection(COLLECTION).doc(
      String(chave).replace(/[^a-zA-Z0-9_-]/g, "_")
    );
  }

  function lerLocal(chave) {
    return window.obterDadosLocaisFirebase?.(chave) || [];
  }

  function metaLocal(chave) {
    return Number(localStorage.getItem(`champion_sync_meta_${chave}`) || 0);
  }

  function gravarMeta(chave, valor) {
    localStorage.setItem(
      `champion_sync_meta_${chave}`,
      String(Number(valor) || Date.now())
    );
  }

  function chaveItem(item, indice) {
    if (item && typeof item === "object" && item.id != null) {
      return `id:${String(item.id)}`;
    }
    try {
      return `json:${JSON.stringify(item)}`;
    } catch {
      return `indice:${indice}`;
    }
  }

  function mesclar(remoto, local, preferirLocal) {
    const mapa = new Map();

    (Array.isArray(remoto) ? remoto : []).forEach((item, i) => {
      mapa.set(chaveItem(item, i), item);
    });

    (Array.isArray(local) ? local : []).forEach((item, i) => {
      const chave = chaveItem(item, i);
      if (!mapa.has(chave) || preferirLocal) {
        mapa.set(chave, item);
      }
    });

    return [...mapa.values()];
  }

  async function garantirAutenticacao() {
    if (auth.currentUser) return auth.currentUser;

    const credencial = await auth.signInAnonymously();
    return credencial.user;
  }

  async function testeDeEscrita() {
    const usuario = auth.currentUser;
    if (!usuario) {
      throw Object.assign(
        new Error("Usuário Firebase não autenticado."),
        { code: "auth/usuario-ausente" }
      );
    }

    await db.collection(COLLECTION).doc("_conexao").set(
      {
        sistema: "Champion Team",
        conectado: true,
        ultimaConexao: firebase.firestore.FieldValue.serverTimestamp(),
        ultimaConexaoMs: Date.now(),
        uid: usuario.uid,
        dominio: location.hostname,
        versao: 5
      },
      { merge: true }
    );
  }

  async function gravarNuvem(chave, dados, atualizadoEmMs = Date.now()) {
    const lista = Array.isArray(dados) ? dados : [];

    if (!conectado || !auth?.currentUser) {
      fila.set(chave, { dados: lista, atualizadoEmMs });
      return;
    }

    status("syncing", "Salvando no Firestore...");

    await ref(chave).set(
      {
        chaveOriginal: chave,
        itens: lista,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEmMs: Number(atualizadoEmMs) || Date.now(),
        atualizadoPor: auth.currentUser.uid,
        versao: 5
      },
      { merge: true }
    );

    gravarMeta(chave, atualizadoEmMs);
    status("online", "Firebase conectado · dados sincronizados");
  }

  window.firebaseCloudSave = gravarNuvem;

  async function sincronizar(chave) {
    const documento = ref(chave);
    const snapshot = await documento.get();

    const local = lerLocal(chave);
    const localTs = metaLocal(chave);

    if (!snapshot.exists) {
      const agora = localTs || Date.now();

      await documento.set({
        chaveOriginal: chave,
        itens: local,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        atualizadoEmMs: agora,
        atualizadoPor: auth.currentUser.uid,
        versao: 5
      });

      gravarMeta(chave, agora);
      window.aplicarDadosFirebase?.(chave, local);
    } else {
      const dadosDoc = snapshot.data() || {};
      const remoto = Array.isArray(dadosDoc.itens) ? dadosDoc.itens : [];
      const remotoTs = Number(dadosDoc.atualizadoEmMs || 0);

      let final = remoto;
      let enviar = false;

      if (remoto.length === 0 && local.length > 0) {
        final = local;
        enviar = true;
      } else if (remoto.length > 0 && local.length === 0) {
        final = remoto;
      } else if (remoto.length > 0 && local.length > 0) {
        const localMaisNovo = localTs > remotoTs;
        final = mesclar(remoto, local, localMaisNovo);
        enviar =
          localMaisNovo ||
          JSON.stringify(final) !== JSON.stringify(remoto);
      }

      window.aplicarDadosFirebase?.(chave, final);

      if (enviar) {
        await gravarNuvem(
          chave,
          final,
          Math.max(localTs, remotoTs, Date.now())
        );
      } else {
        gravarMeta(chave, remotoTs || localTs || Date.now());
      }
    }

    listeners.get(chave)?.();

    listeners.set(
      chave,
      documento.onSnapshot(
        snapshotAtual => {
          if (!snapshotAtual.exists) return;

          const dados = snapshotAtual.data() || {};
          const remoto = Array.isArray(dados.itens) ? dados.itens : [];

          window.aplicarDadosFirebase?.(chave, remoto);
          gravarMeta(
            chave,
            Number(dados.atualizadoEmMs || Date.now())
          );

          status("online", "Firebase conectado · dados sincronizados");
        },
        falhar
      )
    );
  }

  async function enviarFila() {
    const itens = [...fila.entries()];
    fila.clear();

    for (const [chave, item] of itens) {
      await gravarNuvem(chave, item.dados, item.atualizadoEmMs);
    }
  }

  async function iniciar() {
    if (iniciado) return;
    iniciado = true;

    status("syncing", "Autenticando no Firebase...");

    verificarSdk();

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    db = firebase.firestore();
    auth = firebase.auth();

    await garantirAutenticacao();
    conectado = true;

    status("syncing", "Testando escrita no Firestore...");
    await testeDeEscrita();

    const ordem = [
      "fitcontrol_alunos",
      ...chaves.filter(chave => chave !== "fitcontrol_alunos")
    ];

    status("syncing", "Enviando a base da academia...");

    for (const chave of ordem) {
      await sincronizar(chave);
    }

    await enviarFila();

    window.marcarFirebasePronto?.();
    status("online", "Firebase conectado · dados sincronizados");
  }

  window.firebaseReconectar = async function () {
    iniciado = false;
    conectado = false;

    try {
      await iniciar();
    } catch (erro) {
      iniciado = false;
      falhar(erro);
    }
  };

  const limite = setTimeout(() => {
    if (!window.CHAMPION_FIREBASE_READY) {
      falhar(
        Object.assign(
          new Error("A conexão excedeu 20 segundos."),
          { code: "timeout-conexao" }
        )
      );
    }
  }, 20000);

  iniciar()
    .then(() => clearTimeout(limite))
    .catch(erro => {
      clearTimeout(limite);
      iniciado = false;
      conectado = false;
      falhar(erro);
    });
})();
