import { randomBytes } from 'node:crypto';

export const CHALLENGE_MAX_AGE_SECONDS = 10 * 60;
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const challenges = new Map();
const sessions = new Map();

export function saveChallenge(challenge) {
  cleanup(challenges);

  const id = randomId();
  const expiresAt = Date.now() + CHALLENGE_MAX_AGE_SECONDS * 1000;

  challenges.set(id, {
    ...challenge,
    expiresAt
  });

  return id;
}

export function takeChallenge(id) {
  if (!id) {
    return null;
  }

  const challenge = challenges.get(id);
  challenges.delete(id);

  if (!challenge || challenge.expiresAt <= Date.now()) {
    return null;
  }

  return challenge;
}

export function createSession(user) {
  cleanup(sessions);

  const id = randomId();
  const session = {
    user,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };

  sessions.set(id, session);

  return {
    id,
    session
  };
}

export function getSession(id) {
  if (!id) {
    return null;
  }

  const session = sessions.get(id);

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }

  return session;
}

export function deleteSession(id) {
  if (id) {
    sessions.delete(id);
  }
}

function cleanup(store) {
  const now = Date.now();

  for (const [id, value] of store) {
    if (value.expiresAt <= now) {
      store.delete(id);
    }
  }
}

function randomId() {
  return randomBytes(32).toString('base64url');
}
