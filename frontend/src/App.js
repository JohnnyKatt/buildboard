import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import { api, setAuthToken, getBackendUrl } from './api';

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('bb_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('bb_user');
    return raw ? JSON.parse(raw) : null;
  });
  const loggedIn = !!token;

  const login = (t, u) => {
    localStorage.setItem('bb_token', t);
    localStorage.setItem('bb_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    setAuthToken(t);
  };
  const logout = () => {
    localStorage.removeItem('bb_token');
    localStorage.removeItem('bb_user');
    setToken(null);
    setUser(null);
    setAuthToken(null);
  };
  useEffect(() => {
    setAuthToken(token);
  }, [token]);
  return { token, user, loggedIn, login, logout };
}

function TopNav({ user, logout }) {
  return (
    <div className="w-full border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-semibold text-brand">buildboard</Link>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/browse" className="text-sm text-gray-600 hover:text-gray-900">Browse</Link>
          {user ? (
            <>
              {user.role === 'shop' && (
                <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin/leads" className="text-sm text-gray-600 hover:text-gray-900">Admin</Link>
              )}
              <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Login</Link>
              <Link to="/register" className="text-sm text-gray-600 hover:text-gray-900">Register</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Page({ title, children }) {
  useEffect(() => { document.title = title ? `${title} · buildboard` : 'buildboard'; }, [title]);
  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      {children}
    </div>
  );
}

function Login({ onLogin }) {
  const nav = useNavigate();
  const [email, setEmail] = useState('apex@shop.dev');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      onLogin(data.access_token, data.user);
      nav('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Login failed');
    }
  };
  return (
    <Page title="Login">
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full">Login</button>
        <div className="text-xs text-gray-500">Backend: {getBackendUrl()}</div>
      </form>
    </Page>
  );
}

function Register({ onLogin }) {
  const nav = useNavigate();
  const [name, setName] = useState('Demo Shop');
  const [email, setEmail] = useState('demo@shop.dev');
  const [password, setPassword] = useState('password');
  const [role, setRole] = useState('shop');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/register', { name, email, password, role });
      onLogin(data.access_token, data.user);
      nav('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Register failed');
    }
  };
  return (
    <Page title="Register">
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium">Role</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value)}>
            <option value="shop">Shop</option>
            <option value="enthusiast">Enthusiast</option>
          </select>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="btn-primary w-full">Create account</button>
      </form>
    </Page>
  );
}

function Browse() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const load = async () => {
    const { data } = await api.get('/builds', { params: q ? { q } : {} });
    setItems(data.items || []);
  };
  useEffect(() => { load(); }, []);
  return (
    <Page title="Browse Builds">
      <div className="flex items-center gap-2 mb-3">
        <input className="input flex-1" placeholder="Search make/model/title" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn" onClick={load}>Search</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map(b => (
          <Link to={`/build/${b.id}`} key={b.id} className="block border rounded-lg overflow-hidden hover:shadow">
            <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-400">{b.vehicle?.make} {b.vehicle?.model}</div>
            <div className="p-3">
              <div className="font-medium">{b.title}</div>
              <div className="text-xs text-gray-500">{b.vehicle?.year} • {b.status}</div>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}

function BuildDetail() {
  const { pathname } = useLocation();
  const buildId = pathname.split('/').pop();
  const [build, setBuild] = useState(null);
  const [parts, setParts] = useState([]);
  const [lead, setLead] = useState({ contactName: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    api.get(`/builds/${buildId}`).then(res => setBuild(res.data));
    api.get(`/builds/${buildId}/parts`).then(res => setParts(res.data.items || []));
  }, [buildId]);
  const submitLead = async (e) => {
    e.preventDefault();
    await api.post('/leads', { ...lead, buildId, source: 'request_this_build' });
    setSubmitted(true);
  };
  if (!build) return <Page title="Loading"><div>Loading…</div></Page>;
  return (
    <Page title={build.title}>
      <div className="space-y-4">
        <div>
          <div className="text-2xl font-semibold">{build.title}</div>
          <div className="text-sm text-gray-500">{build.vehicle?.year} {build.vehicle?.make} {build.vehicle?.model}</div>
          {build.summary && <p className="mt-2 text-gray-700">{build.summary}</p>}
        </div>
        <div>
          <div className="font-medium mb-2">Gallery</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(build.gallery || []).map((url, idx) => (
              <img src={url} alt="" key={idx} className="h-24 w-40 object-cover rounded" />
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-2">Parts</div>
          <div className="space-y-2">
            {parts.map((bp) => (
              <div key={bp.buildPartId} className="p-3 border rounded">
                <div className="font-medium">{bp.part.brand ? `${bp.part.brand} ` : ''}{bp.part.name}</div>
                <div className="text-xs text-gray-500">{bp.part.category}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(bp.part.vendors || []).map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 border">{v.name || v.site}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Request this build</div>
          {submitted ? (
            <div className="text-green-600 text-sm">Thanks! Well get back to you.</div>
          ) : (
            <form onSubmit={submitLead} className="grid gap-2">
              <input className="input" placeholder="Name" value={lead.contactName} onChange={e => setLead({ ...lead, contactName: e.target.value })} />
              <input className="input" placeholder="Email" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} />
              <input className="input" placeholder="Phone (optional)" value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })} />
              <textarea className="input" placeholder="Message" value={lead.message} onChange={e => setLead({ ...lead, message: e.target.value })} />
              <button className="btn-primary">Send Request</button>
            </form>
          )}
        </div>
      </div>
    </Page>
  );
}

function Dashboard() {
  const [myShop, setMyShop] = useState(null);
  const nav = useNavigate();
  useEffect(() => { api.get('/shops/mine').then(res => setMyShop(res.data)); }, []);
  return (
    <Page title="Dashboard">
      {!myShop ? (
        <div className="border p-4 rounded">
          <div className="font-medium mb-2">Create your Shop</div>
          <CreateShop onCreated={(s) => setMyShop(s)} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-semibold">{myShop.name}</div>
              <div className="text-sm text-gray-500">{myShop.locationCity}, {myShop.locationState}</div>
            </div>
            <button className="btn" onClick={() => nav('/editor')}>New Build</button>
          </div>
          <MyBuilds shopId={myShop.id} />
        </div>
      )}
    </Page>
  );
}

function CreateShop({ onCreated }) {
  const [name, setName] = useState('My Shop');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/shops', { name, locationCity: city, locationState: state });
      const data = res.data;
      onCreated(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-2 max-w-sm">
      <input className="input" placeholder="Shop name" value={name} onChange={e => setName(e.target.value)} />
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
        <input className="input w-32" placeholder="State" value={state} onChange={e => setState(e.target.value)} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button className="btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Shop'}</button>
    </form>
  );
}

function MyBuilds({ shopId }) {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get('/builds', { params: { shopId, status: undefined } }).then(res => setItems(res.data.items || [])); }, [shopId]);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(b => (
        <Link key={b.id} to={`/editor/${b.id}`} className="border rounded p-3 hover:shadow">
          <div className="font-medium">{b.title}</div>
          <div className="text-xs text-gray-500">{b.vehicle?.year} {b.vehicle?.make} {b.vehicle?.model}</div>
        </Link>
      ))}
    </div>
  );
}

function BuildEditor() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const buildId = pathname.startsWith('/editor/') ? pathname.split('/').pop() : null;
  const [step, setStep] = useState('specs');
  const [build, setBuild] = useState({ title: '', vehicle: { year: 2020, make: '', model: '', trim: '' }, summary: '', status: 'in-progress', visibility: 'public', tags: [] });
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (buildId) {
      api.get(`/builds/${buildId}`).then(res => setBuild(res.data));
      api.get(`/builds/${buildId}/parts`).then(res => setParts(res.data.items || []));
    }
  }, [buildId]);

  const create = async () => {
    // Need my shop id
    const { data: my } = await api.get('/shops/mine');
    const payload = { ...build, shopId: my.id };
    const { data } = await api.post('/builds', payload);
    nav(`/editor/${data.id}`);
  };

  const save = async () => {
    await api.put(`/builds/${buildId}`, build);
  };

  const addByUrl = async () => {
    const url = prompt('Paste product URL');
    if (!url) return;
    await api.post(`/builds/${buildId}/parts/link-by-url`, { buildId, url });
    const { data } = await api.get(`/builds/${buildId}/parts`);
    setParts(data.items || []);
  };

  const doSearch = async () => {
    const { data } = await api.get('/parts/search', { params: { q: search } });
    setResults(data.items || []);
  };

  const linkPart = async (partId) => {
    await api.post(`/builds/${buildId}/parts/link`, { buildId, partId, orderIndex: parts.length });
    const { data } = await api.get(`/builds/${buildId}/parts`);
    setParts(data.items || []);
  };

  const uploadInvoice = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/builds/${buildId}/invoice/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setUploading(false);
    const confirm = window.confirm(`Parsed ${data.lineItems.length} lines. Confirm first 2?`);
    if (confirm) {
      const ids = data.lineItems.slice(0, 2).map(li => li.id);
      await api.post(`/invoices/${data.id}/confirm`, { lineItemIds: ids });
      const { data: bp } = await api.get(`/builds/${buildId}/parts`);
      setParts(bp.items || []);
    }
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/builds/${buildId}/gallery/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setBuild({ ...build, gallery: [...(build.gallery || []), data.url] });
  };

  return (
    <Page title="Build Editor">
      {!buildId ? (
        <div className="space-y-3 max-w-xl">
          <div className="font-medium">New Build</div>
          <input className="input" placeholder="Title" value={build.title} onChange={e => setBuild({ ...build, title: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Year" value={build.vehicle.year} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, year: Number(e.target.value) } })} />
            <input className="input" placeholder="Make" value={build.vehicle.make} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, make: e.target.value } })} />
            <input className="input" placeholder="Model" value={build.vehicle.model} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, model: e.target.value } })} />
          </div>
          <textarea className="input" placeholder="Summary" value={build.summary} onChange={e => setBuild({ ...build, summary: e.target.value })} />
          <button className="btn-primary" onClick={create}>Create Build</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['specs','gallery','parts'].map(s => (
              <button key={s} className={`tab ${step===s? 'tab-active':''}`} onClick={() => setStep(s)}>{s}</button>
            ))}
            <div className="ml-auto flex gap-2">
              <button className="btn" onClick={save}>Save</button>
              <label className="btn cursor-pointer">Upload Invoice PDF
                <input type="file" accept="application/pdf" className="hidden" onChange={uploadInvoice} />
              </label>
            </div>
          </div>
          {step === 'specs' && (
            <div className="space-y-2 max-w-xl">
              <input className="input" placeholder="Title" value={build.title || ''} onChange={e => setBuild({ ...build, title: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <input className="input" placeholder="Year" value={build.vehicle?.year || ''} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, year: Number(e.target.value) } })} />
                <input className="input" placeholder="Make" value={build.vehicle?.make || ''} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, make: e.target.value } })} />
                <input className="input" placeholder="Model" value={build.vehicle?.model || ''} onChange={e => setBuild({ ...build, vehicle: { ...build.vehicle, model: e.target.value } })} />
              </div>
              <textarea className="input" placeholder="Summary" value={build.summary || ''} onChange={e => setBuild({ ...build, summary: e.target.value })} />
            </div>
          )}
          {step === 'gallery' && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <label className="btn cursor-pointer">Add Photo
                  <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
                </label>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {(build.gallery || []).map((u, i) => (
                  <img key={i} src={u} alt="" className="h-24 w-40 object-cover rounded" />
                ))}
              </div>
            </div>
          )}
          {step === 'parts' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Search parts" value={search} onChange={e => setSearch(e.target.value)} />
                  <button className="btn" onClick={doSearch}>Search</button>
                </div>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {results.map(p => (
                    <div key={p.id} className="p-2 border rounded flex items-center justify-between">
                      <div>
                        <div className="font-medium">{p.brand ? `${p.brand} ` : ''}{p.name}</div>
                        <div className="text-xs text-gray-500">{p.category}</div>
                      </div>
                      <button className="btn-sm" onClick={() => linkPart(p.id)}>Add</button>
                    </div>
                  ))}
                </div>
                <button className="btn" onClick={addByUrl}>Add by URL</button>
              </div>
              <div className="space-y-2">
                <div className="font-medium">Linked Parts</div>
                <div className="space-y-2">
                  {parts.map(bp => (
                    <div key={bp.buildPartId} className="p-2 border rounded">
                      <div className="font-medium">{bp.part.brand ? `${bp.part.brand} ` : ''}{bp.part.name}</div>
                      <div className="text-xs text-gray-500">{bp.part.category}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(bp.part.vendors || []).map((v, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 border">{v.name || v.site}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

function AdminLeads() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get('/admin/leads').then(res => setItems(res.data.items || [])); }, []);
  return (
    <Page title="Admin: Leads">
      <div className="space-y-2">
        {items.map(l => (
          <div key={l.id} className="p-3 border rounded">
            <div className="font-medium">Lead for build {l.buildId}</div>
            <div className="text-sm text-gray-600">{l.contactName} • {l.email} {l.phone ? `• ${l.phone}` : ''}</div>
            <div className="text-sm">{l.message}</div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function RequireAuth({ user, children }) {
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />
  return children;
}

export default function App() {
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <TopNav user={auth.user} logout={auth.logout} />
      <Routes>
        <Route path="/" element={<Navigate to="/browse" />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/build/:id" element={<BuildDetail />} />
        <Route path="/login" element={<Login onLogin={auth.login} />} />
        <Route path="/register" element={<Register onLogin={auth.login} />} />
        <Route path="/dashboard" element={<RequireAuth user={auth.user}><Dashboard /></RequireAuth>} />
        <Route path="/editor" element={<RequireAuth user={auth.user}><BuildEditor /></RequireAuth>} />
        <Route path="/editor/:id" element={<RequireAuth user={auth.user}><BuildEditor /></RequireAuth>} />
        <Route path="/admin/leads" element={<RequireAuth user={auth.user}><AdminLeads /></RequireAuth>} />
      </Routes>
    </div>
  );
}