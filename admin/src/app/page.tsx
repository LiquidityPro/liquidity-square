"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

const TOKEN_KEY = "lq-desk-token";

type Account = {
  id: string;
  name: string;
  handle: string;
  email: string;
  verified: boolean;
  staff: boolean;
  suspendedAt: string | null;
  joinedAt?: string;
};

type DeskPost = {
  id: string;
  body: string;
  parentId: string | null;
  removedAt: string | null;
  createdAt: string;
};

type Report = {
  id: string;
  reason: string;
  note: string | null;
  createdAt: string;
  reporter: Account;
  account: Account | null;
  post: (DeskPost & { author: Account }) | null;
};

type LogEvent = {
  id: string;
  action: string;
  note: string;
  createdAt: string;
  actor: { name: string; handle: string };
  targetUserId: string | null;
  targetPostId: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  verify: "Verified",
  unverify: "Removed the badge",
  remove_post: "Removed a post",
  restore_post: "Restored a post",
  suspend: "Took an account down",
  restore_account: "Restored an account",
  grant_staff: "Granted staff",
  revoke_staff: "Removed staff",
  dismiss_report: "Dismissed a report",
};

async function desk<T>(path: string, token: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api/server${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Badges({ account }: { account: Account }) {
  return (
    <div className="badges">
      {account.verified && <span className="badge on">Verified</span>}
      {account.staff && <span className="badge on">Staff</span>}
      {account.suspendedAt && <span className="badge">Taken down</span>}
    </div>
  );
}

export default function DeskPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"queue" | "accounts" | "log">("queue");
  const [reports, setReports] = useState<Report[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [posts, setPosts] = useState<DeskPost[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const searchEpoch = useRef(0);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setReady(true);
      return;
    }
    desk<{ staff: Account }>("/admin/me", saved)
      .then((data) => {
        setToken(saved);
        setMe(data.staff);
      })
      .catch(() => sessionStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const loadReports = useCallback(async (active: string) => {
    const data = await desk<{ reports: Report[] }>("/admin/reports", active);
    setReports(data.reports);
  }, []);

  const loadLog = useCallback(async (active: string) => {
    const data = await desk<{ events: LogEvent[] }>("/admin/log", active);
    setEvents(data.events);
  }, []);

  const openAccount = useCallback(async (active: string, id: string) => {
    const data = await desk<{ account: Account; posts: DeskPost[] }>(`/admin/accounts/${encodeURIComponent(id)}`, active);
    setAccount(data.account);
    setPosts(data.posts);
    setAccounts((prev) => prev.map((item) => (item.id === data.account.id ? { ...item, ...data.account } : item)));
  }, []);

  useEffect(() => {
    if (!token) return;
    const active = token;
    if (tab === "queue") void loadReports(active).catch((err) => setError(err instanceof Error ? err.message : "Failed to load reports"));
    if (tab === "log") void loadLog(active).catch((err) => setError(err instanceof Error ? err.message : "Failed to load the log"));
  }, [token, tab, loadReports, loadLog]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/server/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign in failed");
      const next = data.token as string;
      try {
        const meRes = await desk<{ staff: Account }>("/admin/me", next);
        sessionStorage.setItem(TOKEN_KEY, next);
        setToken(next);
        setMe(meRes.staff);
        setPassword("");
      } catch (err) {
        throw new Error(err instanceof Error && err.message === "Staff only" ? "This account is not staff." : err instanceof Error ? err.message : "Sign in failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setAccount(null);
    setReportId(null);
  }

  async function run(path: string, extra?: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await desk(path, token, "POST", { note, ...(reportId ? { reportId } : {}), ...extra });
      setNote("");
      const current = account?.id;
      await Promise.all([
        loadReports(token),
        loadLog(token),
        current ? openAccount(token, current) : Promise.resolve(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!token || tab !== "accounts") return;
    const q = query.trim();
    if (!q.replace(/^@+/, "")) {
      setAccounts([]);
      return;
    }
    const active = token;
    const epoch = ++searchEpoch.current;
    const timer = window.setTimeout(() => {
      desk<{ accounts: Account[] }>(`/admin/accounts?q=${encodeURIComponent(q)}`, active)
        .then((data) => {
          if (epoch === searchEpoch.current) setAccounts(data.accounts);
        })
        .catch((err) => {
          if (epoch === searchEpoch.current) setError(err instanceof Error ? err.message : "Search failed");
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, token, tab]);

  function search(event: FormEvent) {
    event.preventDefault();
  }

  if (!ready) return <main className="shell"><p className="meta">Opening the desk…</p></main>;

  if (!token || !me) {
    return (
      <main className="shell">
        <form className="card sign-in stack" onSubmit={signIn}>
          <div>
            <h1>Desk</h1>
            <p className="meta">Verified badges, post removal, and account takedowns. Sign in with a staff account.</p>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <label>
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="meta">The first staff emails live in STAFF_EMAILS on the API. Google-only accounts need a password before they can open the desk.</p>
        </form>
      </main>
    );
  }

  const selectedReport = reports.find((report) => report.id === reportId) ?? null;

  return (
    <main className="shell">
      <header className="top">
        <div>
          <h1>Desk</h1>
          <p>Signed in as {me.name} · @{me.handle}</p>
        </div>
        <button type="button" onClick={signOut}>Sign out</button>
      </header>

      <div className="tabs" role="tablist" aria-label="Desk">
        {(["queue", "accounts", "log"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setError("");
              if (id !== "queue") setReportId(null);
            }}
          >
            {id === "queue" ? "Queue" : id === "accounts" ? "Accounts" : "Log"}
          </button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {tab === "queue" && (
        <div className="layout split">
          <section className="list" aria-label="Open reports">
            {reports.length === 0 && <p className="meta">No open reports.</p>}
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                className="card row"
                aria-current={report.id === reportId ? "true" : undefined}
                onClick={() => {
                  setReportId(report.id);
                  const target = report.account?.id || report.post?.author.id;
                  if (token && target) void openAccount(token, target).catch((err) => setError(err instanceof Error ? err.message : "Failed to open the account"));
                }}
              >
                <strong>{report.reason}</strong>
                <p className="meta">{report.reporter.name} · {when(report.createdAt)}</p>
                {report.note && <p>{report.note}</p>}
                {report.post && <p className="post">{report.post.body}</p>}
              </button>
            ))}
          </section>
          <aside className="card stack">
            {selectedReport ? (
              <>
                <h2>Report</h2>
                <p>{selectedReport.reason}{selectedReport.note ? ` — ${selectedReport.note}` : ""}</p>
                <p className="meta">From {selectedReport.reporter.name}</p>
                <button type="button" disabled={busy} onClick={() => void run(`/admin/reports/${selectedReport.id}/dismiss`)}>Dismiss</button>
              </>
            ) : (
              <p className="meta">Choose a report.</p>
            )}
            {account && <AccountPanel me={me} account={account} posts={posts} busy={busy} note={note} setNote={setNote} run={run} />}
          </aside>
        </div>
      )}

      {tab === "accounts" && (
        <div className="layout split">
          <section className="stack">
            <form className="stack" onSubmit={search}>
              <label>
                <span>Name, @handle, or email</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <button className="primary" type="submit" disabled={busy || query.trim().length === 0}>Search</button>
            </form>
            <div className="list">
              {query.trim() && accounts.length === 0 && <p className="meta">No accounts match that.</p>}
              {accounts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="card row"
                  aria-current={account?.id === item.id ? "true" : undefined}
                  onClick={() => token && void openAccount(token, item.id)}
                >
                  <strong>{item.name}</strong>
                  <p className="meta">@{item.handle} · {item.email}</p>
                  <Badges account={item} />
                </button>
              ))}
            </div>
          </section>
          <aside className="card">
            {account ? (
              <AccountPanel me={me} account={account} posts={posts} busy={busy} note={note} setNote={setNote} run={run} />
            ) : (
              <p className="meta">Search for an account.</p>
            )}
          </aside>
        </div>
      )}

      {tab === "log" && (
        <section className="list" aria-label="Moderation log">
          {events.length === 0 && <p className="meta">No actions yet.</p>}
          {events.map((event) => (
            <article key={event.id} className="card">
              <strong>{ACTION_LABEL[event.action] ?? event.action}</strong>
              <p className="meta">{event.actor.name} · {when(event.createdAt)}</p>
              <p>{event.note}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function AccountPanel({
  me,
  account,
  posts,
  busy,
  note,
  setNote,
  run,
}: {
  me: Account;
  account: Account;
  posts: DeskPost[];
  busy: boolean;
  note: string;
  setNote: (value: string) => void;
  run: (path: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const self = me.id === account.id;
  return (
    <div className="stack">
      <div>
        <h2>{account.name}</h2>
        <p className="meta">@{account.handle} · {account.email}</p>
        <Badges account={account} />
      </div>
      <label>
        <span>Note for the log</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="Why this action" />
      </label>
      <div className="actions">
        {account.verified ? (
          <button type="button" disabled={busy} onClick={() => void run(`/admin/accounts/${account.id}/unverify`)}>Remove badge</button>
        ) : (
          <button type="button" className="primary" disabled={busy} onClick={() => void run(`/admin/accounts/${account.id}/verify`)}>Verify</button>
        )}
        {account.suspendedAt ? (
          <button type="button" disabled={busy} onClick={() => void run(`/admin/accounts/${account.id}/restore`)}>Restore account</button>
        ) : (
          <button type="button" className="danger" disabled={busy || self} onClick={() => void run(`/admin/accounts/${account.id}/suspend`)}>Take down</button>
        )}
        {!self && (account.staff ? (
          <button type="button" disabled={busy} onClick={() => void run(`/admin/accounts/${account.id}/staff`, { grant: false })}>Remove staff</button>
        ) : (
          <button type="button" disabled={busy || !!account.suspendedAt} onClick={() => void run(`/admin/accounts/${account.id}/staff`, { grant: true })}>Make staff</button>
        ))}
      </div>
      <div className="list">
        {posts.map((post) => (
          <article key={post.id} className="card">
            <p className="post">{post.body}</p>
            <p className="meta">{post.parentId ? "Reply · " : ""}{when(post.createdAt)}{post.removedAt ? " · Off the floor" : ""}</p>
            {post.removedAt ? (
              <button type="button" disabled={busy || !!account.suspendedAt} onClick={() => void run(`/admin/posts/${post.id}/restore`)}>Restore post</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => void run(`/admin/posts/${post.id}/remove`)}>Remove post</button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
