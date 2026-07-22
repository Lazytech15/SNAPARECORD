/**
 * Holds the *live* auth token (e.g. the JWT you get back from /login).
 * Kept separate from AuthDataClient's `jwtSecret`, which only signs the
 * cached AuthData bundle in storage — this is the actual bearer token sent
 * to your API.
 *
 * In-memory by default (safest against XSS reading it back out). Swap the
 * body of get/set/clear for cookies or sessionStorage if that fits your
 * app better.
 */
let token: string | null = null;

export const sessionToken = {
  get: (): string | null => token,
  set: (value: string): void => {
    token = value;
  },
  clear: (): void => {
    token = null;
  },
};
