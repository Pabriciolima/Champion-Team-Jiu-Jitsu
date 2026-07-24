const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 10,
});

const db = admin.firestore();
const auth = admin.auth();

async function requireManager(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }

  const uid = request.auth.uid;
  const email = String(request.auth.token.email || "").toLowerCase();
  const profileSnapshot = await db.collection("users").doc(uid).get();
  const role = profileSnapshot.exists ? profileSnapshot.data()?.role : null;

  if (role !== "gestor" && email !== "admin@fitcontrol.com") {
    throw new HttpsError(
      "permission-denied",
      "Somente o gestor pode administrar acessos."
    );
  }

  return { uid, email };
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeRole(role) {
  const allowed = new Set(["gestor", "professor", "aluno"]);
  if (!allowed.has(role)) {
    throw new HttpsError("invalid-argument", "Tipo de acesso inválido.");
  }
  return role;
}

function serializeUser(user, profile = {}) {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || profile.nome || "",
    disabled: Boolean(user.disabled),
    role: profile.role || "",
    profileId: profile.profileId || "",
    creationTime: user.metadata.creationTime || null,
    lastSignInTime: user.metadata.lastSignInTime || null,
  };
}

exports.manageAccess = onCall(async (request) => {
  const manager = await requireManager(request);
  const data = request.data || {};
  const action = clean(data.action).toLowerCase();

  if (action === "list") {
    const users = [];
    let pageToken;

    do {
      const result = await auth.listUsers(1000, pageToken);
      const refs = result.users.map((user) => db.collection("users").doc(user.uid));
      const snapshots = refs.length ? await db.getAll(...refs) : [];
      const profiles = new Map(
        snapshots.map((snapshot) => [
          snapshot.id,
          snapshot.exists ? snapshot.data() : {},
        ])
      );

      for (const user of result.users) {
        users.push(serializeUser(user, profiles.get(user.uid) || {}));
      }

      pageToken = result.pageToken;
    } while (pageToken);

    users.sort((a, b) =>
      String(a.displayName || a.email).localeCompare(
        String(b.displayName || b.email),
        "pt-BR"
      )
    );

    return { users };
  }

  if (action === "create") {
    const role = normalizeRole(clean(data.role));
    const email = clean(data.email).toLowerCase();
    const password = clean(data.password);
    const displayName = clean(data.displayName);
    const profileId = clean(data.profileId);
    const disabled = Boolean(data.disabled);

    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
    }

    if (password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "A senha precisa ter pelo menos 6 caracteres."
      );
    }

    if (!displayName) {
      throw new HttpsError("invalid-argument", "Informe o nome do usuário.");
    }

    if (role !== "gestor" && !profileId) {
      throw new HttpsError(
        "invalid-argument",
        "Selecione a pessoa vinculada ao acesso."
      );
    }

    const user = await auth.createUser({
      email,
      password,
      displayName,
      disabled,
      emailVerified: false,
    });

    await db.collection("users").doc(user.uid).set({
      role,
      profileId: profileId || null,
      nome: displayName,
      email,
      ativo: !disabled,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: manager.uid,
    });

    return { user: serializeUser(user, { role, profileId, nome: displayName }) };
  }

  if (action === "update") {
    const uid = clean(data.uid);
    if (!uid) {
      throw new HttpsError("invalid-argument", "UID não informado.");
    }

    const updates = {};
    const profileUpdates = {
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoPor: manager.uid,
    };

    if (data.email !== undefined) {
      const email = clean(data.email).toLowerCase();
      if (!email || !email.includes("@")) {
        throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
      }
      updates.email = email;
      profileUpdates.email = email;
    }

    if (data.password !== undefined && clean(data.password)) {
      const password = clean(data.password);
      if (password.length < 6) {
        throw new HttpsError(
          "invalid-argument",
          "A senha precisa ter pelo menos 6 caracteres."
        );
      }
      updates.password = password;
    }

    if (data.displayName !== undefined) {
      const displayName = clean(data.displayName);
      if (!displayName) {
        throw new HttpsError("invalid-argument", "Informe o nome.");
      }
      updates.displayName = displayName;
      profileUpdates.nome = displayName;
    }

    if (data.disabled !== undefined) {
      updates.disabled = Boolean(data.disabled);
      profileUpdates.ativo = !Boolean(data.disabled);
    }

    if (data.role !== undefined) {
      profileUpdates.role = normalizeRole(clean(data.role));
    }

    if (data.profileId !== undefined) {
      profileUpdates.profileId = clean(data.profileId) || null;
    }

    const user = await auth.updateUser(uid, updates);
    await db.collection("users").doc(uid).set(profileUpdates, { merge: true });

    const profile = (await db.collection("users").doc(uid).get()).data() || {};
    return { user: serializeUser(user, profile) };
  }

  if (action === "delete") {
    const uid = clean(data.uid);
    if (!uid) {
      throw new HttpsError("invalid-argument", "UID não informado.");
    }

    if (uid === request.auth.uid) {
      throw new HttpsError(
        "failed-precondition",
        "Você não pode excluir o próprio acesso enquanto está conectado."
      );
    }

    await auth.deleteUser(uid);

    const batch = db.batch();
    batch.delete(db.collection("users").doc(uid));
    batch.delete(db.collection("studentViews").doc(uid));
    await batch.commit();

    return { success: true };
  }

  throw new HttpsError("invalid-argument", "Operação de acesso desconhecida.");
});
