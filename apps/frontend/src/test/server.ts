import { setupServer } from 'msw/node';

/** Shared MSW server; each test registers the handlers it needs via server.use(). */
export const server = setupServer();
