import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxaunouh9vyEoseDrfgZkpdL1gswlk5wc",
  authDomain: "champion-team-jiu-jitsu.firebaseapp.com",
  projectId: "champion-team-jiu-jitsu",
  storageBucket: "champion-team-jiu-jitsu.firebasestorage.app",
  messagingSenderId: "172574452967",
  appId: "1:172574452967:web:cd64c1a576229f7fb5c642"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTION_NAME = "championTeamData";
const chaves = window.CHAMPION_FIREBASE_KEYS || [];
const canceladores = new Map();
const pendencias = new Map();

let autenticado = false;
let inicializado = false;

function refDaChave(chave) {
  return doc(
    db,
    COLLECTION_NAME,
    String(chave).replace(/[^a-zA-Z0-9_-]/g, "_")
  );
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
    return `id:${item.id}`;
  }

  try {
    return `json:${JSON.stringify(item)}`;
  } catch {
    return `indice:${indice}`;
  }
}

function mesclar(remoto, local, localMaisNovo) {
  const mapa = new Map();

  (Array.isArray(remoto) ? remoto : []).forEach((item, indice) => {
    mapa.set(assinatura(item, indice), item);
  });

  (Array.isArray(local) ? local : []).forEach((item, indice) => {
    const chave = assinatura(item, indice);
    if (!mapa.has(chave) || localMaisNovo) {
      mapa.set(chave, item);
    }
  });

  return [...mapa.values()];
}

function status(tipo, texto) {
  window.atualizarStatusFirebase?.(tipo, texto);
}

async function gravar(chave, dados, atualizadoEmMs = Date.now()) {
  const lista = Array.isArray(dados) ? dados : [];

  if (!autenticado || !auth.currentUser) {
    pendencias.set(chave, { dados: lista, atualizadoEmMs });
    return;
  }

  status("syncing", "Salvando alterações no Firebase...");

  await setDoc(
    refDaChave(chave),
    {
      chaveOriginal: chave,
      itens: lista,
      atualizadoEm: serverTimestamp(),
      atualizadoEmMs: Number(atualizadoEmMs) || Date.now(),
      atualizadoPor: auth.currentUser.uid,
      versao: 2
    },
    { merge: true }
  );

  salvarMetaLocal(chave, atualizadoEmMs);
  status("online", "Firebase conectado · dados sincronizados");
}

window.firebaseCloudSave = gravar;

async function sincronizarChave(chave) {
  const ref = refDaChave(chave);
  const snap = await getDoc(ref);

  const local = window.obterDadosLocaisFirebase?.(chave) || [];
  const localTimestamp = metaLocal(chave);

  if (!snap.exists()) {
    const agora = localTimestamp || Date.now();

    await setDoc(ref, {
      chaveOriginal: chave,
      itens: local,
      atualizadoEm: serverTimestamp(),
      atualizadoEmMs: agora,
      atualizadoPor: auth.currentUser.uid,
      versao: 2
    });

    salvarMetaLocal(chave, agora);
    window.aplicarDadosFirebase?.(chave, local);
  } else {
    const docData = snap.data() || {};
    const remoto = Array.isArray(docData.itens)
      ? docData.itens
      : [];
    const remotoTimestamp = Number(docData.atualizadoEmMs || 0);

    let final = remoto;
    let enviar = false;

    if (!remoto.length && local.length) {
      // Impede que um celular vazio apague o computador principal.
      final = local;
      enviar = true;
    } else if (remoto.length && !local.length) {
      // Celular novo recebe a base integral do Firestore.
      final = remoto;
    } else if (remoto.length && local.length) {
      const localMaisNovo = localTimestamp > remotoTimestamp;
      final = mesclar(remoto, local, localMaisNovo);
      enviar =
        localMaisNovo ||
        JSON.stringify(final) !== JSON.stringify(remoto);
    }

    window.aplicarDadosFirebase?.(chave, final);

    if (enviar) {
      await gravar(
        chave,
        final,
        Math.max(localTimestamp, remotoTimestamp, Date.now())
      );
    } else {
      salvarMetaLocal(
        chave,
        remotoTimestamp || localTimestamp || Date.now()
      );
    }
  }

  canceladores.get(chave)?.();

  const cancelar = onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) return;

      const dados = snapshot.data() || {};
      const lista = Array.isArray(dados.itens)
        ? dados.itens
        : [];

      window.aplicarDadosFirebase?.(chave, lista);
      salvarMetaLocal(
        chave,
        Number(dados.atualizadoEmMs || Date.now())
      );

      status("online", "Firebase conectado · dados sincronizados");
    },
    (erro) => {
      console.error(`Erro ao ouvir ${chave}:`, erro);
      status(
        "offline",
        "Sem acesso à base. Verifique as regras do Firestore."
      );
    }
  );

  canceladores.set(chave, cancelar);
}

async function autenticar() {
  if (auth.currentUser) {
    autenticado = true;
    return;
  }

  await signInAnonymously(auth);

  await new Promise((resolve, reject) => {
    const parar = onAuthStateChanged(
      auth,
      (usuario) => {
        if (!usuario) return;
        parar();
        autenticado = true;
        resolve();
      },
      (erro) => {
        parar();
        reject(erro);
      }
    );
  });
}

async function iniciar() {
  if (inicializado) {
    window.marcarFirebasePronto?.();
    return;
  }

  status(
    "syncing",
    "Carregando a base compartilhada da academia..."
  );

  try {
    await enableIndexedDbPersistence(db);
  } catch (erro) {
    console.info(
      "Cache offline já ativo ou indisponível:",
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

  for (const [chave, item] of pendencias.entries()) {
    await gravar(chave, item.dados, item.atualizadoEmMs);
  }
  pendencias.clear();

  inicializado = true;
  window.marcarFirebasePronto?.();

  status("online", "Firebase conectado · dados sincronizados");
}

window.firebaseReconectar = async function() {
  if (!navigator.onLine) return;

  try {
    await autenticar();

    for (const [chave, item] of pendencias.entries()) {
      await gravar(chave, item.dados, item.atualizadoEmMs);
    }
    pendencias.clear();

    status("online", "Firebase reconectado · dados sincronizados");
  } catch (erro) {
    console.error("Falha ao reconectar:", erro);
    status("offline", "Não foi possível reconectar ao Firebase.");
  }
};

iniciar().catch((erro) => {
  console.error("Erro ao iniciar Firebase:", erro);

  let mensagem = "Falha ao conectar ao Firebase.";

  if (erro?.code === "auth/operation-not-allowed") {
    mensagem =
      "Ative o provedor Anônimo no Firebase Authentication.";
  } else if (
    erro?.code === "permission-denied" ||
    erro?.code === "firestore/permission-denied"
  ) {
    mensagem =
      "Publique as regras fornecidas no Firestore.";
  }

  status("offline", mensagem);
});