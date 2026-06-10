import { useState, useEffect, createContext, useContext } from "react";

const BASE_URL = "https://software-agency-crm-production.up.railway.app";

// ─── API ──────────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 401) throw new Error("401");
  if (!res.ok) throw new Error(`${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("crm_token") || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("crm_user") || "null"); } catch { return null; }
  });

  const login = (accessToken, userData) => {
    setToken(accessToken);
    setUser(userData);
    localStorage.setItem("crm_token", accessToken);
    localStorage.setItem("crm_user", JSON.stringify(userData));
  };
  const logout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
  };
  return (
    <AuthCtx.Provider value={{ token, user, login, logout, isAuth: !!token }}>
      {children}
    </AuthCtx.Provider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = ["#4f46e5","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
function getColor(str) {
  let h = 0;
  for (let c of (str || "")) h = c.charCodeAt(0) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function initials(f, l) { return `${(f||"")[0]||""}${(l||"")[0]||""}`.toUpperCase() || "?"; }

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className={`toast ${type}`}>{msg}</div>;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, text, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>{text}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn-secondary" onClick={onCancel}>Bekor qilish</button>
            <button className="btn-danger" onClick={onConfirm}>Ha, o'chirish</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !pw.trim()) { setError("Email va parol kiritish shart"); return; }
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password: pw }),
      });
      let userData = { email: email.trim(), role: "USER" };
      try {
        const users = await apiFetch("/api/v1/users", {}, data.accessToken);
        const me = Array.isArray(users) ? users.find(u => u.email === email.trim()) : null;
        if (me) userData = me;
      } catch {}
      onLogin(data.accessToken, userData);
    } catch (e) {
      if (e.message === "401") setError("Email yoki parol noto'g'ri");
      else setError("Server bilan bog'lanishda xatolik. Qayta urinib ko'ring.");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">C</div>
          <span className="login-logo-text">CRM System</span>
        </div>
        <h1 className="login-title">Xush kelibsiz!</h1>
        <p className="login-subtitle">Hisobingizga kiring</p>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" placeholder="email@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div className="form-group">
          <label className="form-label">Parol</label>
          <div className="form-input-wrap">
            <input className="form-input has-toggle" type={showPw ? "text" : "password"}
              placeholder="••••••••" value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button className="toggle-pw" onClick={() => setShowPw(!showPw)}>
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? "Kirilmoqda..." : "Kirish"}
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "users", label: "Foydalanuvchilar", icon: "👥" },
    ...(isAdmin ? [{ key: "settings", label: "Sozlamalar", icon: "⚙️" }] : []),
  ];

  return (
    <>
      {!collapsed && (
        <div className="sidebar-overlay" onClick={() => setCollapsed(true)} />
      )}
      <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">C</div>
          {!collapsed && <span className="sidebar-logo-text">CRM System</span>}
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-label">Menyu</div>}
          {navItems.map(item => (
            <div key={item.key}
              className={`nav-item ${page === item.key ? "active" : ""}`}
              onClick={() => setPage(item.key)}
              title={collapsed ? item.label : ""}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && item.label}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar" style={{ background: getColor(user?.firstName || user?.email) }}>
              {user?.firstName ? initials(user.firstName, user.lastName) : (user?.email||"?")[0].toUpperCase()}
            </div>
            {!collapsed && (
              <div className="user-info">
                <div className="user-name">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}
                </div>
                <div className="user-role">{user?.role || "USER"}</div>
              </div>
            )}
            <button className="logout-btn" onClick={logout} title="Chiqish">🚪</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
function MiniBarChart({ data, color = "#4f46e5" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="mini-chart">
      {data.map((d, i) => (
        <div key={i} className="mini-bar-wrap" title={`${d.label}: ${d.value}`}>
          <div className="mini-bar" style={{ height: `${(d.value / max) * 100}%`, background: color }} />
          <div className="mini-bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ users }) {
  const active = users.filter(u => u.active).length;
  const admins = users.filter(u => u.role === "ADMIN").length;
  const managers = users.filter(u => u.role === "MANAGER").length;

  const stats = [
    { label: "Jami foydalanuvchilar", value: users.length, icon: "👥", bg: "#eef2ff", color: "#4f46e5" },
    { label: "Faol", value: active, icon: "✅", bg: "#d1fae5", color: "#059669" },
    { label: "Adminlar", value: admins, icon: "🛡️", bg: "#ede9fe", color: "#7c3aed" },
    { label: "Nofaol", value: users.length - active, icon: "⛔", bg: "#fee2e2", color: "#dc2626" },
  ];

  const roleData = [
    { label: "Admin", value: admins },
    { label: "Manager", value: managers },
    { label: "User", value: users.length - admins - managers },
  ];

  return (
    <div className="page">
      <div className="stats-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Rollar bo'yicha taqsimot</div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            {roleData.map(r => (
              <div key={r.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {r.value} ({users.length ? Math.round(r.value / users.length * 100) : 0}%)
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${users.length ? (r.value / users.length) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Faollik holati</div>
          </div>
          <div style={{ padding: "20px 22px" }}>
            <div className="donut-wrap">
              <svg viewBox="0 0 36 36" className="donut-svg">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                {users.length > 0 && (
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10b981" strokeWidth="3"
                    strokeDasharray={`${(active / users.length) * 100} ${100 - (active / users.length) * 100}`}
                    strokeDashoffset="25" strokeLinecap="round" />
                )}
              </svg>
              <div className="donut-center">
                <div className="donut-value">{users.length ? Math.round(active / users.length * 100) : 0}%</div>
                <div className="donut-label">Faol</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 16 }}>
              <div className="legend-item"><span style={{ background: "#10b981" }} />Faol ({active})</div>
              <div className="legend-item"><span style={{ background: "#ef4444" }} />Nofaol ({users.length - active})</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">So'nggi 5 ta foydalanuvchi</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Ism</th><th>Email</th><th>Rol</th><th>Holat</th></tr>
            </thead>
            <tbody>
              {users.slice(0, 5).map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="cell-user">
                      <div className="table-avatar" style={{ background: getColor(u.firstName), width: 32, height: 32, fontSize: 12 }}>
                        {initials(u.firstName, u.lastName)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{u.email}</td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td>
                    <span className={`status-badge ${u.active ? "status-active" : "status-inactive"}`}>
                      {u.active ? "✓ Faol" : "✗ Nofaol"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────
function UserFormModal({ user, onClose, onSave }) {
  const { token } = useAuth();
  const isEdit = !!user?.id;
  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "USER",
    active: user?.active !== undefined ? user.active : true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Ism, familiya va email majburiy"); return;
    }
    if (!isEdit && !form.password.trim()) {
      setError("Parol majburiy"); return;
    }
    setLoading(true); setError("");
    try {
      const body = { ...form };
      if (isEdit && !body.password) delete body.password;
      if (isEdit) {
        await apiFetch(`/api/v1/users/${user.id}`, { method: "PUT", body: JSON.stringify(body) }, token);
      } else {
        await apiFetch("/api/v1/users", { method: "POST", body: JSON.stringify(body) }, token);
      }
      onSave();
    } catch (e) {
      setError(e.message === "401" ? "Ruxsat yo'q" : "Saqlashda xatolik yuz berdi");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Ism *</label>
              <input className="form-input" placeholder="Ism" value={form.firstName}
                onChange={e => set("firstName", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Familiya *</label>
              <input className="form-input" placeholder="Familiya" value={form.lastName}
                onChange={e => set("lastName", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="email@example.com"
              value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Parol {isEdit ? "(o'zgartirish uchun to'ldiring)" : "*"}</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => set("password", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Rol</label>
              <select className="form-input" value={form.role} onChange={e => set("role", e.target.value)}>
                <option value="USER">USER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Holat</label>
              <select className="form-input" value={form.active ? "true" : "false"}
                onChange={e => set("active", e.target.value === "true")}>
                <option value="true">Faol</option>
                <option value="false">Nofaol</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn-secondary" onClick={onClose}>Bekor qilish</button>
            <button className="btn-primary-sm" onClick={handleSave} disabled={loading}>
              {loading ? "Saqlanmoqda..." : (isEdit ? "Saqlash" : "Qo'shish")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────────────
function UserModal({ user, onClose, onEdit, onDelete, isAdmin }) {
  if (!user) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Foydalanuvchi ma'lumotlari</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="detail-avatar" style={{ background: getColor(user.firstName) }}>
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="detail-fields">
            <div className="detail-field">
              <div className="detail-field-label">To'liq ism</div>
              <div className="detail-field-value">{user.firstName} {user.lastName}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Email</div>
              <div className="detail-field-value">{user.email}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Rol</div>
              <span className={`role-badge role-${user.role}`}>{user.role}</span>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Holat</div>
              <span className={`status-badge ${user.active ? "status-active" : "status-inactive"}`}>
                {user.active ? "✓ Faol" : "✗ Nofaol"}
              </span>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">ID</div>
              <div className="detail-field-value" style={{ fontFamily: "monospace", color: "var(--text-secondary)", fontSize: 12 }}>
                {user.id}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { onClose(); onEdit(user); }}>
                ✏️ Tahrirlash
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={() => { onClose(); onDelete(user); }}>
                🗑️ O'chirish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Users Page ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

function UsersPage({ users, loading, onView, onAdd, onRefresh, isAdmin }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [curPage, setCurPage] = useState(1);

  useEffect(() => { setCurPage(1); }, [search, roleFilter, statusFilter]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = (u.firstName||"").toLowerCase().includes(q) ||
      (u.lastName||"").toLowerCase().includes(q) ||
      (u.email||"").toLowerCase().includes(q) ||
      (u.role||"").toLowerCase().includes(q);
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchStatus = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? u.active : !u.active);
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(curPage, totalPages);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page">
      <div className="card">
        <div className="card-header">
          <div className="card-title">Foydalanuvchilar ro'yxati ({filtered.length})</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input className="search-input" placeholder="Qidirish..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="ALL">Barcha rollar</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="USER">USER</option>
            </select>
            <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">Barcha holat</option>
              <option value="ACTIVE">Faol</option>
              <option value="INACTIVE">Nofaol</option>
            </select>
            {isAdmin && (
              <button className="btn-primary-sm" onClick={onAdd}>+ Qo'shish</button>
            )}
            <button className="btn-icon" onClick={onRefresh} title="Yangilash">🔄</button>
          </div>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /> Yuklanmoqda...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🔍</div>
            Natija topilmadi
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Foydalanuvchi</th><th>Email</th>
                    <th>Rol</th><th>Holat</th><th>Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((u, i) => (
                    <tr key={u.id}>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td>
                        <div className="cell-user">
                          <div className="table-avatar" style={{ background: getColor(u.firstName) }}>
                            {initials(u.firstName, u.lastName)}
                          </div>
                          <div className="cell-name">{u.firstName} {u.lastName}</div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{u.email}</td>
                      <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                      <td>
                        <span className={`status-badge ${u.active ? "status-active" : "status-inactive"}`}>
                          {u.active ? "✓ Faol" : "✗ Nofaol"}
                        </span>
                      </td>
                      <td>
                        <button className="btn-icon" onClick={() => onView(u)}>
                          👁️ Ko'rish
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} / {filtered.length}
                </span>
                <div className="pagination-btns">
                  <button className="page-btn" disabled={page === 1}
                    onClick={() => setCurPage(p => p - 1)}>← Oldingi</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map(p => (
                      <button key={p} className={`page-btn ${p === page ? "active" : ""}`}
                        onClick={() => setCurPage(p)}>{p}</button>
                    ))}
                  <button className="page-btn" disabled={page === totalPages}
                    onClick={() => setCurPage(p => p + 1)}>Keyingi →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 540 }}>
        <div className="card-header">
          <div className="card-title">⚙️ Sozlamalar</div>
        </div>
        <div className="modal-body">
          <div className="detail-avatar" style={{ background: getColor(user?.firstName) }}>
            {user?.firstName ? initials(user.firstName, user.lastName) : (user?.email||"?")[0].toUpperCase()}
          </div>
          <div className="detail-fields" style={{ marginTop: 20 }}>
            <div className="detail-field">
              <div className="detail-field-label">To'liq ism</div>
              <div className="detail-field-value">{user?.firstName} {user?.lastName}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Email</div>
              <div className="detail-field-value">{user?.email}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Rol</div>
              <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">ID</div>
              <div className="detail-field-value" style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                {user?.id}
              </div>
            </div>
          </div>
          <div className="info-box" style={{ marginTop: 20 }}>
            ℹ️ Profilni tahrirlash funksiyasi tez orada qo'shiladi.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function CRMApp() {
  const { isAuth, token, user, login, logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const showToast = (msg, type = "info") => setToast({ msg, type });
  const isAdmin = user?.role === "ADMIN";

  const loadUsers = () => {
    if (!isAuth) return;
    setUsersLoading(true);
    apiFetch("/api/v1/users", {}, token)
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(e => {
        if (e.message === "401") { logout(); showToast("Sessiya tugadi. Qayta kiring.", "error"); }
        else showToast("Foydalanuvchilarni yuklashda xatolik", "error");
      })
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => { loadUsers(); }, [isAuth, token]);

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/v1/users/${deleteUser.id}`, { method: "DELETE" }, token);
      showToast("Foydalanuvchi o'chirildi", "success");
      setDeleteUser(null);
      loadUsers();
    } catch {
      showToast("O'chirishda xatolik", "error");
      setDeleteUser(null);
    }
  };

  if (!isAuth) return <LoginPage onLogin={login} />;

  const pageTitles = { dashboard: "Dashboard", users: "Foydalanuvchilar", settings: "Sozlamalar" };
  const roleBadgeClass = user?.role === "ADMIN" ? "badge-admin" :
                         user?.role === "MANAGER" ? "badge-manager" : "badge-user";

  return (
    <div className="layout">
      <Sidebar page={page} setPage={setPage}
        collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className={`main ${sidebarCollapsed ? "main-collapsed" : ""}`}>
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="hamburger" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>☰</button>
            <div className="topbar-title">{pageTitles[page] || page}</div>
          </div>
          <span className={`badge ${roleBadgeClass}`}>{user?.role || "USER"}</span>
        </div>
        {page === "dashboard" && <Dashboard users={users} />}
        {page === "users" && (
          <UsersPage
            users={users} loading={usersLoading}
            onView={setSelectedUser}
            onAdd={() => setShowAddForm(true)}
            onRefresh={loadUsers}
            isAdmin={isAdmin}
          />
        )}
        {page === "settings" && <SettingsPage />}
      </div>

      {selectedUser && (
        <UserModal user={selectedUser} onClose={() => setSelectedUser(null)}
          onEdit={u => setEditUser(u)}
          onDelete={u => setDeleteUser(u)}
          isAdmin={isAdmin}
        />
      )}
      {(editUser || showAddForm) && (
        <UserFormModal
          user={editUser || null}
          onClose={() => { setEditUser(null); setShowAddForm(false); }}
          onSave={() => {
            showToast(editUser ? "Muvaffaqiyatli yangilandi" : "Foydalanuvchi qo'shildi", "success");
            setEditUser(null); setShowAddForm(false);
            loadUsers();
          }}
        />
      )}
      {deleteUser && (
        <ConfirmModal
          title="Foydalanuvchini o'chirish"
          text={`"${deleteUser.firstName} ${deleteUser.lastName}" ni o'chirishni tasdiqlaysizmi?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <CRMApp />
    </AuthProvider>
  );
}
