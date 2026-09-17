export async function verifyIdToken(idToken) {
  if (!idToken) return null;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await response.json().catch(() => ({}));
  const user = data?.users?.[0];
  if (!response.ok || !user?.localId) return null;
  return {
    uid: user.localId,
    email: user.email || "",
    name: user.displayName || ""
  };
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = await verifyIdToken(token);
  if (!user) {
    res.status(401).json({ error: "Inicia sesión para continuar.", status: 401 });
    return;
  }
  req.user = user;
  next();
}
