type Handler = () => void;

let sessionExpiredHandler: Handler | null = null;

/** The router registers how to react (redirect to /login) without the API layer importing it. */
export const onSessionExpired = (handler: Handler | null): void => {
  sessionExpiredHandler = handler;
};

export const notifySessionExpired = (): void => sessionExpiredHandler?.();
