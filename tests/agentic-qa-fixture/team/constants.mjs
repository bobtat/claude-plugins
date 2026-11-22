// Values the app, the run script and the scorer all need to agree on.
export const PORT = 8770;
export const RELAY_PORT = 8771;
export const RELAY_HOST = '127.0.0.2';
// The signed-in session, as a cookie. The run script writes it into a browser storage state.
export const SESSION = 'qa-admin-1.4c1d9e7a52b84f0e';
// Every invite token starts with this. The scorer searches a run's files for it.
export const TOKEN_PREFIX = 'tok_live_FIXTURE';
export const MERGE = '9b7e3d1c5a2f4e6081c3d5e7f9a1b3c5d7e9f1a2';
