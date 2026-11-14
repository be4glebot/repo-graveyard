// Minimal Chrome DevTools Protocol client over the global WebSocket (Node 22+).
// Built-ins only. Commands resolve with their result; events go to listeners.

/**
 * Fetch the debugger WebSocket URL of the first page target.
 * @param {number} port
 * @returns {Promise<string>}
 */
export async function getPageWebSocketUrl(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) throw new Error(`CDP target list failed: HTTP ${res.status}`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page) throw new Error("No page target with a debugger URL");
  return page.webSocketDebuggerUrl;
}

export class CdpClient {
  /** @param {string} url */
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    /** @type {Map<number, {resolve: (v: any) => void, reject: (e: Error) => void}>} */
    this.pending = new Map();
    /** @type {Map<string, Set<(params: any) => void>>} */
    this.listeners = new Map();
    /** @type {WebSocket | null} */
    this.ws = null;
  }

  /** Open the socket. Resolves once connected. */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => resolve(this));
      ws.addEventListener("error", () => reject(new Error(`CDP connect failed: ${this.url}`)));
      ws.addEventListener("message", (ev) => this.#onMessage(String(ev.data)));
      ws.addEventListener("close", () => {
        for (const p of this.pending.values()) p.reject(new Error("CDP socket closed"));
        this.pending.clear();
      });
    });
  }

  #onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg.id === "number") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else p.resolve(msg.result ?? {});
      return;
    }
    if (typeof msg.method === "string") {
      for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params ?? {});
    }
  }

  /**
   * Send a command.
   * @param {string} method
   * @param {object} [params]
   * @returns {Promise<any>}
   */
  send(method, params = {}) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return Promise.reject(new Error("CDP socket not open"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   * @param {string} method
   * @param {(params: any) => void} fn
   */
  on(method, fn) {
    const set = this.listeners.get(method) ?? new Set();
    set.add(fn);
    this.listeners.set(method, set);
    return () => set.delete(fn);
  }

  /**
   * Resolve on the next occurrence of an event, or reject after timeoutMs.
   * @param {string} method
   * @param {number} [timeoutMs]
   */
  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const off = this.on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  /**
   * Evaluate an expression in the page and return its value.
   * @param {string} expression
   */
  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  close() {
    this.ws?.close();
  }
}

/**
 * Connect to a page target on a debugging port.
 * @param {number} port
 */
export async function connectToPage(port) {
  const client = new CdpClient(await getPageWebSocketUrl(port));
  await client.connect();
  return client;
}
