import React, { useEffect, useState } from "react";
import { api, refreshSession, getToken, setToken, setStoredUser } from "./api";
import { Routes, Route, Link, NavLink, useNavigate, useLocation, useSearchParams, Navigate } from "react-router-dom";

const homeFor = (role) => role === "admin" ? "/admin" : role === "worker" ? "/worker-dashboard" : "/bookings";

const services = [
  { id:"plumbing", icon:"🔧", name:"Plumbing", bn:"প্লাম্বিং", desc:"Leaks, pipes, taps & bathroom repairs", price:"৳500+" },
  { id:"electrical", icon:"⚡", name:"Electrical", bn:"ইলেকট্রিক", desc:"Wiring, switches, fans & electrical repairs", price:"৳400+" },
  { id:"cleaning", icon:"🧹", name:"Cleaning", bn:"পরিষ্কার", desc:"Home, kitchen & deep cleaning", price:"৳700+" },
  { id:"ac", icon:"❄️", name:"AC Service", bn:"এসি সার্ভিস", desc:"AC servicing, gas & installation", price:"৳800+" },
  { id:"appliance", icon:"🔌", name:"Appliance Repair", bn:"যন্ত্রপাতি", desc:"Fridge, washing machine & appliances", price:"৳600+" },
  { id:"painting", icon:"🎨", name:"Painting", bn:"রং করা", desc:"Room painting and wall touch-ups", price:"৳1,200+" }
];

const serviceIdToKeyword = { plumbing:"plumb", electrical:"electr", cleaning:"clean", ac:"ac", appliance:"appliance", painting:"paint" };
const serviceOptions = [
  { label:"All services", value:"" },
  { label:"Plumber", value:"plumb" },
  { label:"Electrician", value:"electr" },
  { label:"Home Cleaner", value:"clean" },
  { label:"AC Technician", value:"ac" },
  { label:"Appliance Repair", value:"appliance" },
  { label:"Painting", value:"paint" }
];

const workers = [
  {id:1,name:"Md. Rahim Uddin",service:"Plumber",area:"Mirpur",rating:4.9,reviews:128,price:"৳500",verified:true,avatar:"RU",jobs:312},
  {id:2,name:"Abdul Karim",service:"Electrician",area:"Uttara",rating:4.8,reviews:96,price:"৳450",verified:true,avatar:"AK",jobs:241},
  {id:3,name:"Shila Akter",service:"Home Cleaner",area:"Dhanmondi",rating:4.9,reviews:84,price:"৳700",verified:true,avatar:"SA",jobs:198},
  {id:4,name:"Hasan Mahmud",service:"AC Technician",area:"Mohammadpur",rating:4.7,reviews:73,price:"৳800",verified:true,avatar:"HM",jobs:176},
  {id:5,name:"Rashed Mia",service:"Electrician",area:"Mirpur",rating:4.8,reviews:64,price:"৳500",verified:true,avatar:"RM",jobs:154},
  {id:6,name:"Nusrat Jahan",service:"Home Cleaner",area:"Banani",rating:4.9,reviews:55,price:"৳750",verified:true,avatar:"NJ",jobs:143}
];

const initialBookings = [
  {id:"SH-1048",service:"AC Service",worker:"Hasan Mahmud",date:"02 Sep 2026",time:"10:00 AM",area:"Mirpur 10",status:"Accepted",amount:"৳800"},
  {id:"SH-1039",service:"Plumbing",worker:"Md. Rahim Uddin",date:"30 Aug 2026",time:"04:00 PM",area:"Mirpur 2",status:"Completed",amount:"৳650"}
];

function App(){
  const [lang,setLang] = useState("EN");
  const [bookings,setBookings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sheboyhaat_bookings")) || []; }
    catch { return []; }
  });
  const [user,setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sheboyhaat_user")) || null; } catch { return null; }
  });
  const [authReady,setAuthReady] = useState(false);

  const saveBookings = (next) => { setBookings(next); localStorage.setItem("sheboyhaat_bookings", JSON.stringify(next)); };
  const login = (u) => { setUser(u); setStoredUser(u); };
  const navigate = useNavigate();
  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null); setToken(null); setStoredUser(null); navigate("/");
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (getToken()) {
          try {
            const d = await api("/auth/me");
            if (active) { setUser(d.user); setStoredUser(d.user); }
            return;
          } catch { /* access token invalid or expired, try refresh cookie below */ }
        }
        try {
          const d = await refreshSession();
          if (!active) return;
          if (d?.user) { setUser(d.user); setStoredUser(d.user); }
          else { setUser(null); setStoredUser(null); }
        } catch {
          if (active) { setUser(null); setStoredUser(null); }
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  return <div className="app">
    <Header lang={lang} setLang={setLang} user={user} logout={logout}/>
    <Routes>
      <Route path="/" element={<Home lang={lang}/>}/>
      <Route path="/services" element={<Services lang={lang}/>}/>
      <Route path="/workers" element={<Workers/>}/>
      <Route path="/worker/:id" element={<WorkerDetails user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/book/:workerId" element={<Booking user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/bookings" element={<RequireAuth user={user} ready={authReady}><Bookings bookings={bookings} user={user}/></RequireAuth>}/>
      <Route path="/login" element={<Login login={login}/>}/>
      <Route path="/register" element={<Register login={login}/>}/>
      <Route path="/worker-dashboard" element={<RequireAuth user={user} role="worker" ready={authReady}><WorkerDashboard bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
      <Route path="/admin" element={<RequireAuth user={user} role="admin" ready={authReady}><Admin bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
      <Route path="/profile" element={<RequireAuth user={user} ready={authReady}><Profile user={user} logout={logout}/></RequireAuth>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
    <Footer/>
  </div>
}

function RequireAuth({user,role,ready,children}){
  const location = useLocation();
  if(!ready) return <main className="page"><div className="container empty"><p>Restoring your session…</p></div></main>;
  if(!user) return <Navigate to="/login" replace state={{from:location.pathname}}/>;
  if(role && user.role!==role) return <Navigate to={homeFor(user.role)} replace/>;
  return children;
}

function Header({lang,setLang,user,logout}){
  const [open,setOpen]=useState(false);
  const nav = [
    ["/","Home"],["/services","Services"],["/workers","Find Workers"],["/bookings","My Bookings"]
  ];
  return <header className="header">
    <div className="container nav-wrap">
      <Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link>
      <button className="mobile-menu" onClick={()=>setOpen(!open)}>☰</button>
      <nav className={open?"nav open":"nav"}>
        {nav.map(([path,label])=><NavLink key={path} to={path} end={path==="/"} onClick={()=>setOpen(false)}>{label}</NavLink>)}
      </nav>
      <div className="nav-actions">
        <button className="lang-btn" onClick={()=>setLang(lang==="EN"?"বাংলা":"EN")}>{lang==="EN"?"বাংলা":"EN"}</button>
        {user ? <div className="user-menu">
          <Link to={homeFor(user.role)} className="text-btn">Dashboard</Link>
          <Link to="/profile" className="avatar small">{user.name?.slice(0,1) || "U"}</Link>
          <button className="text-btn" onClick={logout}>Logout</button>
        </div> : <><Link to="/login" className="login-link">Log in</Link><Link to="/register" className="btn btn-primary btn-sm">Get Started</Link></>}
      </div>
    </div>
  </header>
}

function Home({lang}){
  const navigate=useNavigate();
  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span>✓</span> Verified workers you can trust</div>
          <h1>{lang==="বাংলা"?"বিশ্বস্ত কর্মী, সহজ সেবা।":"Trusted workers. Simple service."}</h1>
          <p>{lang==="বাংলা"?"আপনার এলাকার যাচাইকৃত হোম-সার্ভিস কর্মী খুঁজুন এবং সহজেই বুক করুন।":"Find verified home-service workers in your area and book them with confidence."}</p>
          <div className="hero-search">
            <div className="search-icon">⌕</div>
            <input placeholder="What service do you need?"/>
            <button onClick={()=>navigate("/workers")} className="btn btn-primary">Find a Worker</button>
          </div>
          <div className="popular"><span>Popular:</span> Plumbing · Electrical · Cleaning · AC Service</div>
        </div>
        <div className="hero-card">
          <div className="hero-illustration">
            <div className="sun"></div><div className="house">⌂</div>
            <div className="person p1">👨‍🔧</div><div className="person p2">👩‍🔧</div>
            <div className="tool t1">🔧</div><div className="tool t2">⚡</div>
          </div>
          <div className="trust-card"><span className="trust-icon">✓</span><div><b>100% Verified</b><small>NID checked workers</small></div></div>
        </div>
      </div>
    </section>

    <section className="stats">
      <div className="container stats-grid">
        <Stat n="2,500+" label="Verified Workers"/>
        <Stat n="15,000+" label="Completed Jobs"/>
        <Stat n="4.8/5" label="Average Rating"/>
        <Stat n="12" label="Service Areas"/>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker="OUR SERVICES" title="What do you need help with?" text="Choose a service and find a trusted worker near you."/>
        <div className="service-grid">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div>
        <div className="center"><Link to="/services" className="btn btn-outline">View all services →</Link></div>
      </div>
    </section>

    <section className="section soft">
      <div className="container">
        <SectionTitle kicker="HOW IT WORKS" title="Getting help is easy" text="Three simple steps from problem to solution."/>
        <div className="steps">
          <Step n="01" icon="🔎" title="Find a worker" text="Search by service and area. Compare ratings, prices and experience."/>
          <Step n="02" icon="📅" title="Book a time" text="Choose a convenient date and time and send your booking request."/>
          <Step n="03" icon="⭐" title="Get it done" text="Track the job, pay the worker and leave a review after completion."/>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker="TOP-RATED WORKERS" title="People your neighbors trust" text="Verified professionals with real booking histories and reviews."/>
        <div className="worker-grid">{workers.slice(0,3).map(w=><WorkerCard key={w.id} w={w}/>)}</div>
        <div className="center"><Link to="/workers" className="btn btn-outline">Explore workers →</Link></div>
      </div>
    </section>

    <section className="cta">
      <div className="container cta-inner">
        <div><span className="eyebrow light">FOR SERVICE WORKERS</span><h2>Get more jobs. Build your reputation.</h2><p>Join SheboyHaat and connect with households looking for trusted local professionals.</p></div>
        <Link to="/register" className="btn btn-white">Join as a Worker →</Link>
      </div>
    </section>
  </>
}

function SectionTitle({kicker,title,text}){return <div className="section-title"><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>}
function Stat({n,label}){return <div><strong>{n}</strong><span>{label}</span></div>}
function Step({n,icon,title,text}){return <div className="step"><div className="step-top"><span>{n}</span><div>{icon}</div></div><h3>{title}</h3><p>{text}</p></div>}
function ServiceCard({s}){return <Link to={`/workers?service=${s.id}`} className="service-card"><div className="service-icon">{s.icon}</div><div><h3>{s.name}</h3><small>{s.bn}</small><p>{s.desc}</p><b>From {s.price}</b></div><span className="arrow">→</span></Link>}

function Workers(){
  const [searchParams]=useSearchParams();
  const requestedService=(searchParams.get("service")||"").toLowerCase();
  const [query,setQuery]=useState("");
  const [apiWorkers,setApiWorkers]=useState([]);
  useEffect(()=>{ api("/workers").then(d=>setApiWorkers(d.workers || [])).catch(()=>setApiWorkers([])); },[]);
  const [service,setService]=useState(serviceIdToKeyword[requestedService] ?? "");
  const [area,setArea]=useState("All areas");
  useEffect(()=>{ setService(serviceIdToKeyword[requestedService] ?? ""); },[requestedService]);
  const filtered=apiWorkers.filter(w=>(!service||w.service.toLowerCase().includes(service))&&(area==="All areas"||w.area===area)&&(w.name.toLowerCase().includes(query.toLowerCase())||w.service.toLowerCase().includes(query.toLowerCase())));
  return <main className="page">
    <div className="container">
      <div className="page-heading"><div><span className="eyebrow">FIND A WORKER</span><h1>Verified workers near you</h1><p>Compare trusted professionals by service, area and rating.</p></div></div>
      <div className="filters">
        <div className="filter-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search worker or service"/></div>
        <select value={service} onChange={e=>setService(e.target.value)}>{serviceOptions.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}</select>
        <select value={area} onChange={e=>setArea(e.target.value)}><option>All areas</option><option>Mirpur</option><option>Uttara</option><option>Dhanmondi</option><option>Mohammadpur</option><option>Banani</option></select>
      </div>
      <div className="results-bar"><b>{filtered.length} workers found</b><span>✓ All profiles are NID-verified</span></div>
      <div className="worker-grid">{filtered.map(w=><WorkerCard key={w.id} w={w}/>)} </div>
      {!filtered.length && <div className="empty"><div>🔎</div><h3>No workers found</h3><p>Try another service, area or search term.</p></div>}
    </div>
  </main>
}

function WorkerCard({w}){
  return <div className="worker-card">
    <div className="worker-head"><div className="avatar">{w.avatar}</div><span className="verified">✓ Verified</span></div>
    <h3>{w.name}</h3><p className="role">{w.service} · {w.area}</p>
    <div className="rating"><b>★ {w.rating}</b><span>({w.reviews} reviews)</span><span>· {w.jobs} jobs</span></div>
    <div className="worker-bottom"><div><small>Starting from</small><strong>{w.price}</strong></div><Link to={`/worker/${w.id}`} className="btn btn-primary btn-sm">View Profile</Link></div>
  </div>
}

function WorkerDetails({user,bookings,saveBookings}){
  const {id}=useParamsCompat();
  const w=workers.find(x=>x.id===Number(id))||workers[0];
  return <main className="page"><div className="container narrow">
    <Link to="/workers" className="back">← Back to workers</Link>
    <div className="profile-card">
      <div className="profile-top"><div className="avatar xl">{w.avatar}</div><div><div className="verified">✓ NID Verified</div><h1>{w.name}</h1><p>{w.service} · {w.area}</p><div className="rating"><b>★ {w.rating}</b><span>{w.reviews} reviews</span></div></div><div className="profile-price"><small>Starting from</small><strong>{w.price}</strong></div></div>
      <div className="profile-stats"><div><b>{w.jobs}</b><span>Jobs completed</span></div><div><b>{w.rating}</b><span>Average rating</span></div><div><b>2 yrs</b><span>On platform</span></div><div><b>98%</b><span>Acceptance</span></div></div>
      <div className="profile-body"><h2>About this worker</h2><p>Experienced local professional providing reliable home services. Profile identity has been verified by SheboyHaat administration. Customers can review workers only after a completed booking.</p><h2>Recent reviews</h2><p>Reviews from completed bookings will appear here.</p></div>
      <div className="profile-action"><Link to={`/book/${w.id}`} className="btn btn-primary btn-lg">Book this worker</Link></div>
    </div>
  </div></main>
}
function Review({name,text,stars}){return <div className="review"><div className="avatar mini">{name.slice(0,1)}</div><div><b>{name}</b><span className="stars">{stars}</span><p>{text}</p></div></div>}
function useParamsCompat(){ const loc=useLocation(); return {id:loc.pathname.split("/").pop()}; }

function Booking({user,bookings,saveBookings}){
  const {id}=useParamsCompat(); const navigate=useNavigate(); const w=workers.find(x=>x.id===Number(id))||workers[0];
  const [form,setForm]=useState({date:"",time:"",address:"",note:""});
  const [done,setDone]=useState(false);
  const submit=async(e)=>{e.preventDefault(); const b={id:"SH-"+Math.floor(1000+Math.random()*8999),service:w.service,worker:w.name,date:form.date,time:form.time,area:form.address,status:"Requested",amount:w.price}; try { const d=await api("/bookings",{method:"POST",body:JSON.stringify({workerId:w.id,service:w.service,date:form.date,time:form.time,address:form.address,note:form.note})}); saveBookings([d.booking || b,...bookings]); } catch(err) { alert("Demo booking saved locally. For database booking, log in first and keep the backend running. " + err.message); saveBookings([b,...bookings]); } setDone(true);};
  if(done) return <main className="page"><div className="container narrow"><div className="success-card"><div className="success-icon">✓</div><h1>Booking request sent!</h1><p>Your request has been sent to <b>{w.name}</b>. You can track its status from My Bookings.</p><div className="success-actions"><Link to="/bookings" className="btn btn-primary">View my bookings</Link><Link to="/workers" className="btn btn-outline">Find another worker</Link></div></div></div></main>;
  return <main className="page"><div className="container narrow">
    <Link to={`/worker/${w.id}`} className="back">← Back to profile</Link>
    <div className="booking-layout">
      <form className="form-card" onSubmit={submit}><span className="eyebrow">BOOK A SERVICE</span><h1>Book {w.name}</h1><p className="muted">Choose a date and time that works for you.</p>
        <label>Date<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>Preferred time<select required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}><option value="">Select a time</option><option>09:00 AM</option><option>10:00 AM</option><option>12:00 PM</option><option>02:00 PM</option><option>04:00 PM</option><option>06:00 PM</option></select></label>
        <label>Service address<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="House, road, area"/></label>
        <label>Additional note <span>(optional)</span><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Describe the problem briefly..."/></label>
        <button className="btn btn-primary btn-lg full">Send booking request</button>
        <small className="form-note">No payment is required at booking. Final price is agreed with the worker.</small>
      </form>
      <div className="summary-card"><div className="summary-worker"><div className="avatar">{w.avatar}</div><div><b>{w.name}</b><span>{w.service}</span><span>★ {w.rating} · {w.reviews} reviews</span></div></div><hr/><div className="summary-row"><span>Starting price</span><b>{w.price}</b></div><div className="info-box">🛡️ <span>Every worker is identity-verified and reviewed by real customers.</span></div></div>
    </div>
  </div></main>
}

function Bookings({bookings,user}){
  const [remoteBookings,setRemoteBookings]=useState(bookings);
  useEffect(()=>{ api("/bookings").then(d=>setRemoteBookings(d.bookings || bookings)).catch(()=>setRemoteBookings(bookings)); },[]);
  const shownBookings=remoteBookings.length ? remoteBookings : bookings;
  return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">CUSTOMER AREA</span><h1>My Bookings</h1><p>Track your service requests and booking history.</p></div><Link to="/workers" className="btn btn-primary">+ New booking</Link></div>
    {!shownBookings.length?<div className="empty"><div>📅</div><h3>No bookings yet</h3><p>Find a trusted worker and make your first booking.</p><Link to="/workers" className="btn btn-primary">Find a worker</Link></div>:
    <div className="booking-list">{shownBookings.map(b=><div className="booking-row" key={b.id}><div className="booking-id">{b.id}</div><div className="booking-main"><h3>{b.service}</h3><p>{b.worker} · {b.area}</p></div><div><b>{b.date}</b><span>{b.time}</span></div><Status s={b.status}/><strong>{b.amount}</strong></div>)}</div>}
  </div></main>
}
function Status({s}){return <span className={"status "+s.toLowerCase()}>{s}</span>}

function Login({login}){
  const navigate=useNavigate(); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const submit=async e=>{e.preventDefault(); try { const d=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password})}); setToken(d.token||d.accessToken); login(d.user); navigate(homeFor(d.user.role)); } catch(err) { alert(err.message+". If this is your first visit, register a new account."); return; }};
  return <main className="auth-page"><div className="auth-card"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>Welcome back</h1><p>Log in to manage your bookings.</p><form onSubmit={submit}><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="btn btn-primary btn-lg full">Log in</button></form><div className="divider">or</div><Link to="/register" className="btn btn-outline full">Create an account</Link><small className="demo-note">Your session is verified against the SheboyHaat API.</small></div></main>
}

function Register({login}){
  const navigate=useNavigate();
  const [role,setRole]=useState("customer"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [phone,setPhone]=useState(""),[service,setService]=useState(""),[area,setArea]=useState(""),[experience,setExperience]=useState(""),[price,setPrice]=useState("500"),[nid,setNid]=useState(null),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);try{const d=await api("/auth/register",{method:"POST",body:JSON.stringify({name,email,password,role,phone,service,area,experience,price,nidFileName:nid?.name||"",nidData:nid?await fileToDataUrl(nid):""})});setToken(d.token||d.accessToken);login(d.user);navigate(homeFor(role));}catch(err){alert(err.message);}finally{setBusy(false);}};
  return <main className="auth-page"><div className="auth-card wide"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>Create your account</h1><p>Join Bangladesh's trusted local service platform.</p><div className="role-toggle"><button type="button" className={role==="customer"?"active":""} onClick={()=>setRole("customer")}>Customer</button><button type="button" className={role==="worker"?"active":""} onClick={()=>setRole("worker")}>Service Worker</button></div>
  <form onSubmit={submit}><label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>
  {role==="worker"&&<><label>Phone number<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label><label>Service category<input required value={service} onChange={e=>setService(e.target.value)} placeholder="e.g. Plumber, Electrician"/></label><label>Service area<input required value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. Mirpur, Dhaka"/></label><label>Years of experience<input required type="number" min="0" value={experience} onChange={e=>setExperience(e.target.value)}/></label><label>Starting price (BDT)<input required type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Upload NID card (image or PDF)<input required type="file" accept="image/*,application/pdf" onChange={e=>setNid(e.target.files?.[0]||null)}/></label><div className="notice">Your profile will stay hidden until an admin reviews your NID and verifies your details.</div></>}
  <button disabled={busy} className="btn btn-primary btn-lg full">{busy?"Creating account…":"Create account"}</button></form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p></div></main>
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);})}

function WorkerDashboard({bookings,saveBookings}){
  const user=JSON.parse(localStorage.getItem("sheboyhaat_user")||"null");
  const [myBookings,setMyBookings]=useState([]);
  useEffect(()=>{api("/bookings").then(d=>setMyBookings(d.bookings||[])).catch(()=>setMyBookings(bookings));},[]);
  const requests=(myBookings.length?myBookings:bookings).filter(b=>b.status==="Requested");
  const accept=(id)=>{const next=bookings.map(b=>b.id===id?{...b,status:"Accepted"}:b);saveBookings(next);api(`/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status:"Accepted"})}).catch(()=>{});};
  return <main className="page"><div className="container"><div className="dashboard-head"><div><span className="eyebrow">WORKER DASHBOARD</span><h1>Welcome, {user?.name||"Worker"}</h1><p>Manage your jobs and keep your customers updated.</p></div><span className="verified large">✓ NID Verified</span></div>
    <div className="dash-stats"><Stat n="৳18,450" label="This month"/><Stat n="24" label="Jobs completed"/><Stat n="4.9" label="Rating"/><Stat n="98%" label="Acceptance rate"/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>Booking requests</h2><span>{requests.length} pending</span></div>{requests.length?requests.map(b=><div className="request" key={b.id}><div className="avatar mini">C</div><div><b>{b.service}</b><span>{b.date} · {b.time}</span><small>{b.area}</small></div><button onClick={()=>accept(b.id)} className="btn btn-primary btn-sm">Accept</button></div>):<div className="empty small-empty"><div>✓</div><p>No pending requests.</p></div>}</section>
    <section className="panel"><div className="panel-title"><h2>Profile preview</h2><span>Verification is managed by admin</span></div><div className="worker-preview"><div className="avatar">RU</div><div><h3>{user?.name||"Your worker profile"}</h3><p>Your registered service profile</p><div className="rating"><span>Rating appears after customer reviews</span></div></div></div><div className="profile-progress"><div><span>Profile completion</span><b>85%</b></div><div className="progress"><i style={{width:"85%"}}></i></div></div></section></div>
  </div></main>
}

function Admin({bookings,saveBookings}){
  const [overview,setOverview]=useState({workers:6,pendingVerification:0,bookings:bookings.length,openReports:0});
  const [pending,setPending]=useState([]);
  const [dbData,setDbData]=useState(null);
  const [error,setError]=useState("");
  const load=()=>Promise.all([api("/admin/overview"),api("/admin/workers"),api("/admin/database")]).then(([o,w,d])=>{setOverview(o);setPending((w.workers||[]).filter(x=>!x.verified));setDbData(d);setError("");}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const verify=async(id)=>{try{await api(`/admin/workers/${id}/verify`,{method:"PATCH"});await load();}catch(e){setError(e.message);}};
  return <main className="page"><div className="container"><div className="dashboard-head"><div><span className="eyebrow">ADMIN PANEL</span><h1>Platform overview</h1><p>Manage verification, disputes and platform activity.</p></div><span className="admin-badge">ADMIN</span></div>
    {error&&<div className="notice">{error} Only platform administrators can manage this panel.</div>}
    <div className="dash-stats"><Stat n={overview.workers} label="Workers"/><Stat n={overview.pendingVerification} label="Pending verification"/><Stat n={overview.bookings} label="Total bookings"/><Stat n={overview.openReports} label="Open reports"/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>Worker verification</h2><span>{pending.length} pending</span></div>{pending.length?pending.map(w=><div className="request" key={w.id}><div className="avatar mini">{w.avatar}</div><div><b>{w.name}</b><span>{w.service} · {w.area}</span><small>{w.phone||"No phone"} · {w.experience||"Experience not given"} years · {w.nidFileName||"NID not uploaded"}</small></div><button onClick={()=>verify(w.id)} className="btn btn-primary btn-sm">Verify</button></div>):<div className="empty small-empty"><div>✓</div><p>No pending workers.</p></div>}</section>
    <section className="panel"><div className="panel-title"><h2>Quick actions</h2></div><div className="admin-actions"><button onClick={()=>api("/admin/reports").then(d=>alert(`${(d.reports||[]).length} report(s) found`)).catch(e=>alert(e.message))}>Review reports</button><button onClick={()=>alert("Map integration is a planned feature for a future version.")}>Open map dashboard</button><button onClick={()=>alert("Platform settings will be added in a future version.")}>Platform settings</button><button onClick={()=>alert(`Workers: ${overview.workers} · Bookings: ${overview.bookings}`)}>Activity analytics</button></div></section></div>
    <section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>Database records</h2><button className="btn btn-outline btn-sm" onClick={load}>Refresh data</button></div>{dbData?<><p>Live records from the Neon PostgreSQL database. NID file contents are intentionally not shown in this overview.</p>{Object.entries(dbData).map(([table,rows])=><details key={table} style={{margin:"12px 0"}}><summary style={{cursor:"pointer",fontWeight:700,textTransform:"capitalize"}}>{table} ({rows.length})</summary><div style={{overflowX:"auto",marginTop:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>{rows.length ? <><thead><tr>{Object.keys(rows[0]).map(k=><th key={k} style={{textAlign:"left",padding:8,borderBottom:"1px solid #ddd"}}>{k}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j} style={{padding:8,borderBottom:"1px solid #eee"}}>{String(v??"")}</td>)}</tr>)}</tbody></> : <tbody><tr><td>No records yet.</td></tr></tbody>}</table></div></details>)}</>:<p>Database records could not be loaded. Check admin login and backend connection.</p>}</section>
  </div></main>
}

function Profile({user,logout}){return <main className="page"><div className="container narrow"><div className="profile-card simple"><div className="profile-top"><div className="avatar xl">{user?.name?.slice(0,1)||"U"}</div><div><span className="eyebrow">MY PROFILE</span><h1>{user?.name||"Demo Customer"}</h1><p>{user?.email||"demo@example.com"}</p><span className="role-pill">{user?.role==="worker"?"Service Worker":"Customer"}</span></div></div><div className="profile-body"><h2>Account settings</h2><div className="settings-row"><span>Language</span><b>English / বাংলা</b></div><div className="settings-row"><span>Notifications</span><b>Enabled</b></div><button onClick={logout} className="btn btn-outline">Log out</button></div></div></div></main>}

function NotFound(){return <main className="page"><div className="container empty"><div>404</div><h1>Page not found</h1><Link to="/" className="btn btn-primary">Go home</Link></div></main>}
function Footer(){return <footer><div className="container footer-grid"><div><Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><p>Trusted home services for Bangladesh.<br/>Built around verification, transparency and community.</p></div><div><b>Platform</b><Link to="/services">Services</Link><Link to="/workers">Find Workers</Link><Link to="/bookings">Bookings</Link></div><div><b>For workers</b><Link to="/register">Join SheboyHaat</Link><Link to="/worker-dashboard">Worker dashboard</Link></div><div><b>Demo admin</b><Link to="/admin">Admin panel</Link><span>support@sheboyhaat.demo</span></div></div><div className="footer-bottom"><div className="container">© 2026 SheboyHaat · Software Development-I project prototype</div></div></footer>}

function Services(){return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">SERVICES</span><h1>Home services made simple</h1><p>Browse verified professionals for everyday household needs.</p></div></div><div className="service-grid large">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div></div></main>}
function ServicesDummy(){return null}

export default App;