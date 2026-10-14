import React, { useEffect, useState } from "react";
import { api, refreshSession, getToken, setToken, setStoredUser } from "./api";
import { Routes, Route, Link, NavLink, useNavigate, useLocation, useSearchParams, Navigate } from "react-router-dom";
import { LangContext, translations, translateService, translateArea, localizeNumber, useLang } from "./i18n";

const homeFor = (role) => role === "admin" ? "/admin" : role === "worker" ? "/worker-dashboard" : "/bookings";

const services = [
  { id:"plumbing", icon:"🔧", name:"Plumbing", bn:"প্লাম্বিং", desc:"Leaks, pipes, taps & bathroom repairs", descBn:"পানি লিক, পাইপ, কল ও বাথরুম মেরামত", price:"৳500+" },
  { id:"electrical", icon:"⚡", name:"Electrical", bn:"ইলেকট্রিক", desc:"Wiring, switches, fans & electrical repairs", descBn:"ওয়্যারিং, সুইচ, ফ্যান ও ইলেকট্রিক মেরামত", price:"৳400+" },
  { id:"cleaning", icon:"🧹", name:"Cleaning", bn:"পরিষ্কার", desc:"Home, kitchen & deep cleaning", descBn:"ঘর, রান্নাঘর ও গভীর পরিষ্কার", price:"৳700+" },
  { id:"ac", icon:"❄️", name:"AC Service", bn:"এসি সার্ভিস", desc:"AC servicing, gas & installation", descBn:"এসি সার্ভিসিং, গ্যাস ও ইনস্টলেশন", price:"৳800+" },
  { id:"appliance", icon:"🔌", name:"Appliance Repair", bn:"যন্ত্রপাতি", desc:"Fridge, washing machine & appliances", descBn:"ফ্রিজ, ওয়াশিং মেশিন ও যন্ত্রপাতি", price:"৳600+" },
  { id:"painting", icon:"🎨", name:"Painting", bn:"রং করা", desc:"Room painting and wall touch-ups", descBn:"ঘর রং করা ও দেয়ালের টাচ-আপ", price:"৳1,200+" }
];

const serviceIdToKeyword = { plumbing:"plumb", electrical:"electr", cleaning:"clean", ac:"ac", appliance:"appliance", painting:"paint" };

const workers = [
  {id:1,name:"Md. Rahim Uddin",service:"Plumber",area:"Mirpur",rating:4.9,reviews:128,price:"৳500",verified:true,avatar:"RU",jobs:312},
  {id:2,name:"Abdul Karim",service:"Electrician",area:"Uttara",rating:4.8,reviews:96,price:"৳450",verified:true,avatar:"AK",jobs:241},
  {id:3,name:"Shila Akter",service:"Home Cleaner",area:"Dhanmondi",rating:4.9,reviews:84,price:"৳700",verified:true,avatar:"SA",jobs:198},
  {id:4,name:"Hasan Mahmud",service:"AC Technician",area:"Mohammadpur",rating:4.7,reviews:73,price:"৳800",verified:true,avatar:"HM",jobs:176},
  {id:5,name:"Rashed Mia",service:"Electrician",area:"Mirpur",rating:4.8,reviews:64,price:"৳500",verified:true,avatar:"RM",jobs:154},
  {id:6,name:"Nusrat Jahan",service:"Home Cleaner",area:"Banani",rating:4.9,reviews:55,price:"৳750",verified:true,avatar:"NJ",jobs:143}
];

function App(){
  const [lang,setLang] = useState(() => localStorage.getItem("sheboyhaat_lang") || "EN");
  const [bookings,setBookings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sheboyhaat_bookings")) || []; }
    catch { return []; }
  });
  const [user,setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sheboyhaat_user")) || null; } catch { return null; }
  });
  const [authReady,setAuthReady] = useState(false);

  useEffect(() => { localStorage.setItem("sheboyhaat_lang", lang); document.documentElement.lang = lang === "বাংলা" ? "bn" : "en"; }, [lang]);

  const saveBookings = (next) => { setBookings(next); localStorage.setItem("sheboyhaat_bookings", JSON.stringify(next)); };
  const login = (u) => { setUser(u); setStoredUser(u); };
  const navigate = useNavigate();
  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setUser(null); setToken(null); setStoredUser(null); navigate("/");
  };

  const T = translations[lang] || translations.EN;
  const n = (value) => localizeNumber(lang, value);

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

  return <LangContext.Provider value={{ lang, setLang, T, n }}>
    <div className={"app" + (lang === "বাংলা" ? " lang-bn" : "")}>
    <Header user={user} logout={logout}/>
    <Routes>
      <Route path="/" element={<Home user={user}/>}/>
      <Route path="/services" element={<Services/>}/>
      <Route path="/workers" element={<Workers user={user}/>}/>
      <Route path="/worker/:id" element={<WorkerDetails user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/book/:workerId" element={<Booking user={user} bookings={bookings} saveBookings={saveBookings}/>}/>
      <Route path="/bookings" element={<RequireAuth user={user} ready={authReady}><Bookings bookings={bookings} user={user}/></RequireAuth>}/>
      <Route path="/login" element={<Login login={login}/>}/>
      <Route path="/register" element={<Register login={login}/>}/>
      <Route path="/worker-dashboard" element={<RequireAuth user={user} role="worker" ready={authReady}><WorkerDashboard bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
      <Route path="/admin" element={<RequireAuth user={user} role="admin" ready={authReady}><Admin bookings={bookings} saveBookings={saveBookings}/></RequireAuth>}/>
      <Route path="/profile" element={<RequireAuth user={user} ready={authReady}><Profile user={user} bookings={bookings} logout={logout}/></RequireAuth>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
    <Footer/>
    </div>
  </LangContext.Provider>
}

function RequireAuth({user,role,ready,children}){
  const {T}=useLang();
  const location = useLocation();
  if(!ready) return <main className="page"><div className="container empty"><p>{T.restore}</p></div></main>;
  if(!user) return <Navigate to="/login" replace state={{from:location.pathname}}/>;
  if(role && user.role!==role) return <Navigate to={homeFor(user.role)} replace/>;
  return children;
}

function LogoutIcon(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}

function LangToggle(){
  const {lang,setLang}=useLang();
  return <div className="lang-toggle" role="group" aria-label="Language">
    <button type="button" className={lang==="EN"?"active":""} onClick={()=>setLang("EN")}>EN</button>
    <button type="button" className={lang==="বাংলা"?"active":""} onClick={()=>setLang("বাংলা")}>বাংলা</button>
  </div>
}

function Header({user,logout}){
  const {T}=useLang();
  const [open,setOpen]=useState(false);
  const nav = [
    ["/",T.nav.home],["/services",T.nav.services],["/workers",T.nav.workers],["/bookings",T.nav.bookings]
  ];
  return <header className="header">
    <div className="container nav-wrap">
      <Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link>
      <button className="mobile-menu" onClick={()=>setOpen(!open)}>☰</button>
      <nav className={open?"nav open":"nav"}>
        {nav.map(([path,label])=><NavLink key={path} to={path} end={path==="/"} onClick={()=>setOpen(false)}>{label}</NavLink>)}
      </nav>
      <div className="nav-actions">
        <LangToggle/>
        {user ? <div className="user-menu">
          <Link to="/profile" className="user-chip" title={T.profile.eyebrow}>
            <span className="avatar small">{user.name?.slice(0,1) || "U"}</span>
            <span className="user-chip-name">{user.name}</span>
          </Link>
          <button className="btn btn-logout btn-sm" onClick={logout}><LogoutIcon/><span>{T.header.logout}</span></button>
        </div> : <><Link to="/login" className="login-link">{T.header.login}</Link><Link to="/register" className="btn btn-primary btn-sm">{T.header.getStarted}</Link></>}
      </div>
    </div>
  </header>
}

function Home({user}){
  const {lang,T,n}=useLang();
  const navigate=useNavigate();
  return <>
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span>✓</span> {T.home.eyebrow}</div>
          <h1>{T.home.title}</h1>
          <p>{T.home.subtitle}</p>
          <div className="hero-search">
            <div className="search-icon">⌕</div>
            <input placeholder={T.home.searchPlaceholder}/>
            <button onClick={()=>navigate("/workers")} className="btn btn-primary">{T.home.findWorker}</button>
          </div>
          <div className="popular"><span>{T.home.popular}</span> {services.map(s=>lang==="বাংলা"?s.bn:s.name).join(" · ")}</div>
        </div>
        <div className="hero-card">
          <div className="hero-illustration">
            <div className="sun"></div><div className="house">⌂</div>
            <div className="person p1">👨‍🔧</div><div className="person p2">👩‍🔧</div>
            <div className="tool t1">🔧</div><div className="tool t2">⚡</div>
          </div>
          <div className="trust-card"><span className="trust-icon">✓</span><div><b>{T.home.trustTitle}</b><small>{T.home.trustSub}</small></div></div>
        </div>
      </div>
    </section>

    <section className="stats">
      <div className="container stats-grid">
        <Stat n={n("2,500+")} label={T.home.stats.verifiedWorkers}/>
        <Stat n={n("15,000+")} label={T.home.stats.completedJobs}/>
        <Stat n={n("4.8/5")} label={T.home.stats.avgRating}/>
        <Stat n={n("12")} label={T.home.stats.serviceAreas}/>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker={T.home.servicesKicker} title={T.home.servicesTitle} text={T.home.servicesText}/>
        <div className="service-grid">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div>
        <div className="center"><Link to="/services" className="btn btn-outline">{T.home.viewAll}</Link></div>
      </div>
    </section>

    <section className="section soft">
      <div className="container">
        <SectionTitle kicker={T.home.howKicker} title={T.home.howTitle} text={T.home.howText}/>
        <div className="steps">
          <Step n="01" icon="🔎" title={T.home.step1t} text={T.home.step1d}/>
          <Step n="02" icon="📅" title={T.home.step2t} text={T.home.step2d}/>
          <Step n="03" icon="⭐" title={T.home.step3t} text={T.home.step3d}/>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <SectionTitle kicker={T.home.topKicker} title={T.home.topTitle} text={T.home.topText}/>
        <div className="worker-grid">{workers.slice(0,3).map(w=><WorkerCard key={w.id} w={w} locked={!user}/>)}</div>
        <div className="center"><Link to="/workers" className="btn btn-outline">{T.home.explore}</Link></div>
      </div>
    </section>

    <section className="cta">
      <div className="container cta-inner">
        <div><span className="eyebrow light">{T.home.ctaKicker}</span><h2>{T.home.ctaTitle}</h2><p>{T.home.ctaText}</p></div>
        <Link to="/register" className="btn btn-white">{T.home.ctaJoin}</Link>
      </div>
    </section>
  </>
}

function SectionTitle({kicker,title,text}){return <div className="section-title"><span>{kicker}</span><h2>{title}</h2><p>{text}</p></div>}
function Stat({n,label}){return <div><strong>{n}</strong><span>{label}</span></div>}
function Step({n,icon,title,text}){return <div className="step"><div className="step-top"><span>{n}</span><div>{icon}</div></div><h3>{title}</h3><p>{text}</p></div>}
function ServiceCard({s}){
  const {lang,T,n}=useLang();
  return <Link to={`/workers?service=${s.id}`} className="service-card"><div className="service-icon">{s.icon}</div><div><h3>{lang==="বাংলা"?s.bn:s.name}</h3><small>{lang==="বাংলা"?s.name:s.bn}</small><p>{lang==="বাংলা"?s.descBn:s.desc}</p><b>{T.home.from} {n(s.price)}</b></div><span className="arrow">→</span></Link>
}

function Workers({user}){
  const {lang,T,n}=useLang();
  const serviceOptions = [
    { label:T.findServices.all, value:"" },
    { label:T.findServices.plumber, value:"plumb" },
    { label:T.findServices.electrician, value:"electr" },
    { label:T.findServices.cleaner, value:"clean" },
    { label:T.findServices.ac, value:"ac" },
    { label:T.findServices.appliance, value:"appliance" },
    { label:T.findServices.painting, value:"paint" }
  ];
  const areaList = ["Mirpur","Uttara","Dhanmondi","Mohammadpur","Banani"];
  const [searchParams]=useSearchParams();
  const requestedService=(searchParams.get("service")||"").toLowerCase();
  const [query,setQuery]=useState("");
  const [apiWorkers,setApiWorkers]=useState([]);
  const [locked,setLocked]=useState(!user);
  const [service,setService]=useState(serviceIdToKeyword[requestedService] ?? "");
  const [area,setArea]=useState("All areas");
  useEffect(()=>{
    let active=true;
    api("/workers").then(d=>{ if(!active)return; setApiWorkers(d.workers||[]); setLocked(typeof d.locked==="boolean"?d.locked:!user); })
      .catch(()=>{ if(active){ setApiWorkers([]); setLocked(!user); } });
    return ()=>{ active=false; };
  },[user]);
  useEffect(()=>{ setService(serviceIdToKeyword[requestedService] ?? ""); },[requestedService]);
  const filtered=apiWorkers.filter(w=>(!service||w.service.toLowerCase().includes(service))&&(locked||area==="All areas"||w.area===area)&&(w.name.toLowerCase().includes(query.toLowerCase())||w.service.toLowerCase().includes(query.toLowerCase())));
  return <main className="page">
    <div className="container">
      <div className="page-heading"><div><span className="eyebrow">{T.workers.eyebrow}</span><h1>{T.workers.title}</h1><p>{locked?T.workers.textLocked:T.workers.text}</p></div></div>
      <div className="filters">
        <div className="filter-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={T.workers.searchPlaceholder}/></div>
        <select value={service} onChange={e=>setService(e.target.value)}>{serviceOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {!locked&&<select value={area} onChange={e=>setArea(e.target.value)}><option value="All areas">{T.workers.allAreas}</option>{areaList.map(a=><option key={a} value={a}>{translateArea(lang,a)}</option>)}</select>}
      </div>
      <div className="results-bar"><b>{n(filtered.length)} {T.workers.foundMany}</b>{locked?<span>🔒 <Link to="/login">{T.header.login}</Link> — {T.workers.lockNote}</span>:<span>✓ {T.workers.verifiedNote}</span>}</div>
      <div className="worker-grid">{filtered.map(w=><WorkerCard key={w.id} w={w} locked={locked}/>)} </div>
      {!filtered.length && <div className="empty"><div>🔎</div><h3>{T.workers.none}</h3><p>{T.workers.noneText}</p></div>}
    </div>
  </main>
}

function WorkerCard({w,locked}){
  const {lang,T,n}=useLang();
  if(locked) return <div className="worker-card">
    <div className="worker-head"><div className="avatar">{w.avatar}</div>{w.verified&&<span className="verified">✓ {T.workerCard.verified}</span>}</div>
    <h3>{w.name}</h3><p className="role">{translateService(lang,w.service)}</p>
    <div className="rating"><span>🔒 {T.workerCard.lockedNote}</span></div>
    <div className="worker-bottom"><Link to={`/worker/${w.id}`} className="btn btn-primary btn-sm">{T.workerCard.viewProfile}</Link></div>
  </div>;
  return <div className="worker-card">
    <div className="worker-head"><div className="avatar">{w.avatar}</div><span className="verified">✓ {T.workerCard.verified}</span></div>
    <h3>{w.name}</h3><p className="role">{translateService(lang,w.service)} · {translateArea(lang,w.area)}</p>
    <div className="rating"><b>★ {n(w.rating)}</b><span>({n(w.reviews)} {T.workerCard.reviews})</span><span>· {n(w.jobs)} {T.workerCard.jobs}</span></div>
    <div className="worker-bottom"><div><small>{T.workerCard.starting}</small><strong>{n(w.price)}</strong></div><Link to={`/worker/${w.id}`} className="btn btn-primary btn-sm">{T.workerCard.viewProfile}</Link></div>
  </div>
}

function WorkerDetails({user}){
  const {lang,T,n}=useLang();
  const {id}=useParamsCompat();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    api(`/workers/${id}`)
      .then(d=>{ if(active){ setData(d); setLoading(false); } })
      .catch(()=>{ if(active){ setData(null); setLoading(false); } });
    return ()=>{ active=false; };
  },[id,user]);

  const sample=workers.find(x=>x.id===Number(id))||workers[0];
  const w=data?.worker||sample;
  const locked=data?data.locked:!user;

  if(loading&&!data) return <main className="page"><div className="container narrow"><div className="empty"><p>{T.workerDetails.loading}</p></div></div></main>;

  if(locked) return <main className="page"><div className="container narrow">
    <Link to="/workers" className="back">{T.workerDetails.back}</Link>
    <div className="profile-card">
      <div className="profile-top"><div className="avatar xl">{w.avatar}</div><div>{w.verified&&<div className="verified">✓ {T.workerDetails.nidVerified}</div>}<h1>{w.name}</h1><p>{translateService(lang,w.service)}</p></div></div>
      <div className="profile-body">
        <h2>{T.workerDetails.privateTitle}</h2>
        <p>{T.workerDetails.privateText}</p>
        <div className="notice">🔒 {T.workerDetails.privateNotice}</div>
      </div>
      <div className="profile-action"><Link to="/login" state={{from:`/worker/${id}`}} className="btn btn-primary btn-lg">{T.workerDetails.loginView}</Link><Link to="/register" className="btn btn-outline">{T.workerDetails.createAccount}</Link></div>
    </div>
  </div></main>;

  return <main className="page"><div className="container narrow">
    <Link to="/workers" className="back">{T.workerDetails.back}</Link>
    <div className="profile-card">
      <div className="profile-top"><div className="avatar xl">{w.avatar}</div><div>{w.verified?<div className="verified">✓ {T.workerDetails.nidVerified}</div>:<div className="pending">⏳ {T.workerDash.nidPending}</div>}<h1>{w.name}</h1><p>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</p><div className="rating"><b>★ {n(w.rating)}</b><span>{n(w.reviews)} {T.workerCard.reviews}</span></div></div><div className="profile-price"><small>{T.workerCard.starting}</small><strong>{n(w.price)}</strong></div></div>
      <div className="profile-stats"><div><b>{n(w.jobs)}</b><span>{T.workerDetails.jobsCompleted}</span></div><div><b>{n(w.rating)}</b><span>{T.workerDetails.avgRating}</span></div><div><b>{n(w.experience||"—")}</b><span>{T.workerDetails.yearsExp}</span></div><div><b>{w.phone||T.workerDetails.private}</b><span>{T.workerDetails.contact}</span></div></div>
      <div className="profile-body"><h2>{T.workerDetails.about}</h2><p>{data?.bio||w.bio||T.workerDetails.bio}</p><h2>{T.workerDetails.recentReviews}</h2>{data?.reviews?.length?data.reviews.map((rv,i)=><Review key={i} name={rv.customerName} text={rv.comment||T.workerDetails.noComment} stars={"★".repeat(rv.rating)}/>):<p>{T.workerDetails.noReviews}</p>}</div>
      <div className="profile-action"><Link to={`/book/${w.id}`} className="btn btn-primary btn-lg">{T.workerDetails.bookWorker}</Link></div>
    </div>
  </div></main>;
}
function Review({name,text,stars}){return <div className="review"><div className="avatar mini">{name.slice(0,1)}</div><div><b>{name}</b><span className="stars">{stars}</span><p>{text}</p></div></div>}
function useParamsCompat(){ const loc=useLocation(); return {id:loc.pathname.split("/").pop()}; }

function Booking({user,bookings,saveBookings}){
  const {lang,T,n}=useLang();
  const {id}=useParamsCompat(); const navigate=useNavigate(); const w=workers.find(x=>x.id===Number(id))||workers[0];
  const [form,setForm]=useState({date:"",time:"",address:"",note:""});
  const [done,setDone]=useState(false);
  const submit=async(e)=>{e.preventDefault(); const b={id:"SH-"+Math.floor(1000+Math.random()*8999),service:w.service,worker:w.name,date:form.date,time:form.time,area:form.address,status:"Requested",amount:w.price}; try { const d=await api("/bookings",{method:"POST",body:JSON.stringify({workerId:w.id,service:w.service,date:form.date,time:form.time,address:form.address,note:form.note})}); saveBookings([d.booking || b,...bookings]); } catch(err) { alert(T.booking.demoAlert + " " + err.message); saveBookings([b,...bookings]); } setDone(true);};
  if(done) return <main className="page"><div className="container narrow"><div className="success-card"><div className="success-icon">✓</div><h1>{T.booking.sentTitle}</h1><p>{T.booking.sent(w.name)}</p><div className="success-actions"><Link to="/bookings" className="btn btn-primary">{T.booking.viewBookings}</Link><Link to="/workers" className="btn btn-outline">{T.booking.findAnother}</Link></div></div></div></main>;
  return <main className="page"><div className="container narrow">
    <Link to={`/worker/${w.id}`} className="back">{T.booking.backProfile}</Link>
    <div className="booking-layout">
      <form className="form-card" onSubmit={submit}><span className="eyebrow">{T.booking.eyebrow}</span><h1>{T.booking.titlePrefix} {w.name}</h1><p className="muted">{T.booking.subtitle}</p>
        <label>{T.booking.date}<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>{T.booking.time}<select required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}><option value="">{T.booking.selectTime}</option><option value="09:00 AM">{n("09:00 AM")}</option><option value="10:00 AM">{n("10:00 AM")}</option><option value="12:00 PM">{n("12:00 PM")}</option><option value="02:00 PM">{n("02:00 PM")}</option><option value="04:00 PM">{n("04:00 PM")}</option><option value="06:00 PM">{n("06:00 PM")}</option></select></label>
        <label>{T.booking.address}<input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder={T.booking.addressPlaceholder}/></label>
        <label>{T.booking.note} <span>{T.booking.optional}</span><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder={T.booking.notePlaceholder}/></label>
        <button className="btn btn-primary btn-lg full">{T.booking.send}</button>
        <small className="form-note">{T.booking.formNote}</small>
      </form>
      <div className="summary-card"><div className="summary-worker"><div className="avatar">{w.avatar}</div><div><b>{w.name}</b><span>{translateService(lang,w.service)}</span><span>★ {n(w.rating)} · {n(w.reviews)} {T.workerCard.reviews}</span></div></div><hr/><div className="summary-row"><span>{T.booking.startingPrice}</span><b>{n(w.price)}</b></div><div className="info-box">🛡️ <span>{T.booking.secure}</span></div></div>
    </div>
  </div></main>
}

function Bookings({bookings,user}){
  const {lang,T,n}=useLang();
  const [remoteBookings,setRemoteBookings]=useState(bookings);
  useEffect(()=>{ api("/bookings").then(d=>setRemoteBookings(d.bookings || bookings)).catch(()=>setRemoteBookings(bookings)); },[]);
  const shownBookings=remoteBookings.length ? remoteBookings : bookings;
  return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">{T.bookings.eyebrow}</span><h1>{T.bookings.title}</h1><p>{T.bookings.text}</p></div><Link to="/workers" className="btn btn-primary">{T.bookings.new}</Link></div>
    {!shownBookings.length?<div className="empty"><div>📅</div><h3>{T.bookings.empty}</h3><p>{T.bookings.emptyText}</p><Link to="/workers" className="btn btn-primary">{T.bookings.findWorker}</Link></div>:
    <div className="booking-list">{shownBookings.map(b=><div className="booking-row" key={b.id}><div className="booking-id">{n(b.id)}</div><div className="booking-main"><h3>{translateService(lang,b.service)}</h3><p>{b.worker} · {translateArea(lang,b.area)}</p></div><div><b>{n(b.date)}</b><span>{n(b.time)}</span></div><Status s={b.status}/><strong>{n(b.amount)}</strong></div>)}</div>}
  </div></main>
}
function Status({s}){
  const {T}=useLang();
  const label=(T.status && T.status[s]) || s;
  return <span className={"status "+String(s).toLowerCase()}>{label}</span>
}
function isNidImage(w){ return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(w?.nidFileName||"") || /^data:image\//i.test(w?.nidUrl||""); }

function Login({login}){
  const {T}=useLang();
  const navigate=useNavigate(); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const submit=async e=>{e.preventDefault(); try { const d=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password})}); setToken(d.token||d.accessToken); login(d.user); navigate(homeFor(d.user.role)); } catch(err) { alert(err.message+T.login.fail); return; }};
  return <main className="auth-page"><div className="auth-card"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>{T.login.title}</h1><p>{T.login.subtitle}</p><form onSubmit={submit}><label>{T.login.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T.register.emailPlaceholder}/></label><label>{T.login.password}<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label><button className="btn btn-primary btn-lg full">{T.login.button}</button></form><div className="divider">{T.login.or}</div><Link to="/register" className="btn btn-outline full">{T.login.create}</Link><small className="demo-note">{T.login.note}</small></div></main>
}

function Register({login}){
  const {T}=useLang();
  const navigate=useNavigate();
  const [role,setRole]=useState("customer"),[name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [phone,setPhone]=useState(""),[service,setService]=useState(""),[area,setArea]=useState(""),[experience,setExperience]=useState(""),[price,setPrice]=useState("500"),[nid,setNid]=useState(null),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();if(role==="worker"&&nid&&nid.size>5*1024*1024){alert(T.register.nidTooLarge);return;}setBusy(true);try{const d=await api("/auth/register",{method:"POST",body:JSON.stringify({name,email,password,role,phone,service,area,experience,price,nidFileName:nid?.name||"",nidData:nid?await fileToDataUrl(nid):""})});setToken(d.token||d.accessToken);login(d.user);navigate(homeFor(role));}catch(err){alert(err.message);}finally{setBusy(false);}};
  return <main className="auth-page"><div className="auth-card wide"><Link to="/" className="logo center-logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><h1>{T.register.title}</h1><p>{T.register.subtitle}</p><div className="role-toggle"><button type="button" className={role==="customer"?"active":""} onClick={()=>setRole("customer")}>{T.register.customer}</button><button type="button" className={role==="worker"?"active":""} onClick={()=>setRole("worker")}>{T.register.worker}</button></div>
  <form onSubmit={submit}><label>{T.register.fullName}<input required value={name} onChange={e=>setName(e.target.value)} placeholder={T.register.namePlaceholder}/></label><label>{T.register.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={T.register.emailPlaceholder}/></label><label>{T.register.password}<input required type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} placeholder={T.register.passwordPlaceholder}/></label>
  {role==="worker"&&<><label>{T.register.phone}<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="01XXXXXXXXX"/></label><label>{T.register.category}<input required value={service} onChange={e=>setService(e.target.value)} placeholder={T.register.categoryPlaceholder}/></label><label>{T.register.area}<input required value={area} onChange={e=>setArea(e.target.value)} placeholder={T.register.areaPlaceholder}/></label><label>{T.register.experience}<input required type="number" min="0" value={experience} onChange={e=>setExperience(e.target.value)}/></label><label>{T.register.price}<input required type="number" min="0" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>{T.register.nid}<input required type="file" accept="image/*,application/pdf" onChange={e=>setNid(e.target.files?.[0]||null)}/></label><div className="notice">{T.register.notice}</div></>}
  <button disabled={busy} className="btn btn-primary btn-lg full">{busy?T.register.creating:T.register.createBtn}</button></form><p className="auth-switch">{T.register.switch} <Link to="/login">{T.register.login}</Link></p></div></main>
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);})}

function WorkerDashboard({bookings,saveBookings}){
  const {lang,T,n}=useLang();
  const user=JSON.parse(localStorage.getItem("sheboyhaat_user")||"null");
  const [myBookings,setMyBookings]=useState([]);
  const [me,setMe]=useState(null);
  const [nid,setNid]=useState(null);
  const [form,setForm]=useState({phone:"",service:"",area:"",experience:"",price:""});
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const loadMe=()=>api("/workers/me").then(d=>{const w=d.worker;setMe(w);setForm({phone:w.phone||"",service:w.service||"",area:w.area||"",experience:w.experience||"",price:String(w.price||"").replace(/[^0-9]/g,"")});}).catch(()=>setMe(null));
  useEffect(()=>{api("/bookings").then(d=>setMyBookings(d.bookings||[])).catch(()=>setMyBookings(bookings));loadMe();},[]);
  const requests=(myBookings.length?myBookings:bookings).filter(b=>b.status==="Requested");
  const accept=(id)=>{const next=bookings.map(b=>b.id===id?{...b,status:"Accepted"}:b);saveBookings(next);api(`/bookings/${id}/status`,{method:"PATCH",body:JSON.stringify({status:"Accepted"})}).catch(()=>{});};
  const verified=!!me?.verified;
  const rejected=!!me?.rejected;
  const setF=(k,v)=>setForm(f=>({...f,[k]:v}));
  const resubmit=async e=>{e.preventDefault();if(nid&&nid.size>5*1024*1024){alert(T.register.nidTooLarge);return;}setBusy(true);setNotice("");try{const d=await api("/workers/me/resubmit",{method:"POST",body:JSON.stringify({...form,nidFileName:nid?.name||"",nidData:nid?await fileToDataUrl(nid):""})});setMe(d.worker);setNid(null);setNotice(T.workerDash.resubmitted);}catch(err){setNotice(err.message);}finally{setBusy(false);}};
  return <main className="page"><div className="container"><div className="dashboard-head"><div><span className="eyebrow">{T.workerDash.eyebrow}</span><h1>{T.workerDash.welcome} {user?.name||T.workerDash.fallback}</h1><p>{T.workerDash.subtitle}</p></div>{me?(verified?<span className="verified large">✓ {T.workerDash.nidVerified}</span>:rejected?<span className="rejected large">✕ {T.workerDash.rejected}</span>:<span className="pending large">⏳ {T.workerDash.nidPending}</span>):null}</div>
    {me&&!verified&&!rejected&&<div className="notice">{T.workerDash.pendingNote}</div>}
    {me&&rejected&&<>
      <div className="notice">{T.workerDash.rejectedNote}</div>
      {(me.rejectionReasonEn||me.rejectionReasonBn)&&<div className="reason-card"><h4>{T.workerDash.adminComment}</h4>{me.rejectionReasonEn&&<p><b>EN:</b> {me.rejectionReasonEn}</p>}{me.rejectionReasonBn&&<p><b>বাংলা:</b> {me.rejectionReasonBn}</p>}</div>}
      <section className="panel resubmit-card"><div className="panel-title"><h2>{T.workerDash.resubmitTitle}</h2><span>{T.workerDash.adminManaged}</span></div><p>{T.workerDash.resubmitText}</p>
        <form onSubmit={resubmit}>
          <label>{T.workerDash.newNid}<input type="file" accept="image/*,application/pdf" onChange={e=>setNid(e.target.files?.[0]||null)}/></label>
          <div className="field-grid">
            <div><label>{T.register.phone}</label><input value={form.phone} onChange={e=>setF("phone",e.target.value)}/></div>
            <div><label>{T.register.category}</label><input value={form.service} onChange={e=>setF("service",e.target.value)}/></div>
            <div><label>{T.register.area}</label><input value={form.area} onChange={e=>setF("area",e.target.value)}/></div>
            <div><label>{T.register.experience}</label><input type="number" min="0" value={form.experience} onChange={e=>setF("experience",e.target.value)}/></div>
            <div><label>{T.register.price}</label><input type="number" min="0" value={form.price} onChange={e=>setF("price",e.target.value)}/></div>
          </div>
          <p><small>{T.workerDash.keepNote}</small></p>
          <button disabled={busy} className="btn btn-primary">{busy?T.workerDash.resubmitting:T.workerDash.submitResubmit}</button>
        </form>
      </section>
    </>}
    {notice&&<div className="notice">{notice}</div>}
    <div className="dash-stats"><Stat n={n("৳18,450")} label={T.workerDash.thisMonth}/><Stat n={n("24")} label={T.workerDash.jobsCompleted}/><Stat n={n("4.9")} label={T.workerDash.rating}/><Stat n={n("98%")} label={T.workerDash.acceptance}/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>{T.workerDash.requests}</h2><span>{n(requests.length)} {T.workerDash.pending}</span></div>{requests.length?requests.map(b=><div className="request" key={b.id}><div className="avatar mini">C</div><div><b>{translateService(lang,b.service)}</b><span>{n(b.date)} · {n(b.time)}</span><small>{translateArea(lang,b.area)}</small></div><button onClick={()=>accept(b.id)} className="btn btn-primary btn-sm">{T.workerDash.accept}</button></div>):<div className="empty small-empty"><div>✓</div><p>{T.workerDash.noRequests}</p></div>}</section>
    <section className="panel"><div className="panel-title"><h2>{T.workerDash.profilePreview}</h2><span>{T.workerDash.adminManaged}</span></div><div className="worker-preview"><div className="avatar">{me?.avatar||(user?.name||"W").slice(0,2).toUpperCase()}</div><div><h3>{me?.name||user?.name||T.workerDash.yourProfile}</h3><p>{me?translateService(lang,me.service):T.workerDash.registered}</p><div className="rating">{me&&(verified?<span className="verified">{T.workerDash.nidVerified}</span>:rejected?<span className="rejected">{T.workerDash.rejected}</span>:<span className="pending">{T.workerDash.nidPending}</span>)}<span>{T.workerDash.ratingLater}</span></div></div></div><div className="profile-progress"><div><span>{T.workerDash.completion}</span><b>{n("85%")}</b></div><div className="progress"><i style={{width:"85%"}}></i></div></div></section></div>
  </div></main>
}

function Admin({bookings,saveBookings}){
  const {lang,T,n}=useLang();
  const [overview,setOverview]=useState({workers:6,pendingVerification:0,bookings:bookings.length,openReports:0});
  const [pending,setPending]=useState([]);
  const [rejected,setRejected]=useState([]);
  const [dbData,setDbData]=useState(null);
  const [error,setError]=useState("");
  const [openReject,setOpenReject]=useState(null);
  const [reasonEn,setReasonEn]=useState("");
  const [reasonBn,setReasonBn]=useState("");
  const load=()=>Promise.all([api("/admin/overview"),api("/admin/workers"),api("/admin/database")]).then(([o,w,d])=>{const all=w.workers||[];setOverview(o);setPending(all.filter(x=>!x.verified&&!x.rejected));setRejected(all.filter(x=>x.rejected));setDbData(d);setError("");}).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const verify=async(id)=>{try{await api(`/admin/workers/${id}/verify`,{method:"PATCH"});setOpenReject(null);await load();}catch(e){setError(e.message);}};
  const openRejectFor=(id)=>{setOpenReject(id);setReasonEn("");setReasonBn("");};
  const sendReject=async(id)=>{if(!reasonEn.trim()&&!reasonBn.trim()){setError(T.admin.reasonRequired);return;}try{await api(`/admin/workers/${id}/reject`,{method:"PATCH",body:JSON.stringify({reasonEn,reasonBn})});setOpenReject(null);await load();}catch(e){setError(e.message);}};
  const nidLink=(w)=>w.nidUrl?(isNidImage(w)?<a className="nid-preview" href={w.nidUrl} target="_blank" rel="noreferrer" title={T.admin.viewNid}><img src={w.nidUrl} alt={T.admin.viewNid}/><span>📄 {T.admin.viewNid}</span></a>:<a className="nid-link" href={w.nidUrl} target="_blank" rel="noreferrer">📄 {T.admin.viewNid}{w.nidFileName?` · ${w.nidFileName}`:""}</a>):<small>{T.admin.nidNotAvailable}</small>;
  const workerInfo=(w)=><div><b>{w.name}</b><span>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</span><small>{w.phone||T.admin.noPhone} · {w.experience?n(w.experience):T.admin.expNotGiven} {T.admin.years}</small>{nidLink(w)}</div>;
  return <main className="page"><div className="container"><div className="dashboard-head"><div><span className="eyebrow">{T.admin.eyebrow}</span><h1>{T.admin.title}</h1><p>{T.admin.subtitle}</p></div><span className="admin-badge">{T.admin.badge}</span></div>
    {error&&<div className="notice">{error} {T.admin.errorNote}</div>}
    <div className="dash-stats"><Stat n={n(overview.workers)} label={T.admin.workers}/><Stat n={n(overview.pendingVerification)} label={T.admin.pendingVerification}/><Stat n={n(overview.bookings)} label={T.admin.totalBookings}/><Stat n={n(overview.openReports)} label={T.admin.openReports}/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>{T.admin.verification}</h2><span>{n(pending.length)} {T.admin.pending}</span></div>{pending.length?pending.map(w=><div className="request-wrap" key={w.id}><div className="request"><div className="avatar mini">{w.avatar}</div>{workerInfo(w)}<button onClick={()=>verify(w.id)} className="btn btn-primary btn-sm">{T.admin.approve}</button><button onClick={()=>openRejectFor(w.id)} className="btn btn-outline btn-sm">{T.admin.reject}</button></div>{openReject===w.id&&<div className="reject-box"><label>{T.admin.reasonEnLabel}<textarea rows="2" value={reasonEn} onChange={e=>setReasonEn(e.target.value)} placeholder={T.admin.reasonEnPlaceholder}/></label><label>{T.admin.reasonBnLabel}<textarea rows="2" value={reasonBn} onChange={e=>setReasonBn(e.target.value)} placeholder={T.admin.reasonBnPlaceholder}/></label><div className="reject-actions"><button onClick={()=>sendReject(w.id)} className="btn btn-primary btn-sm">{T.admin.sendReject}</button><button onClick={()=>setOpenReject(null)} className="btn btn-outline btn-sm">{T.admin.cancel}</button></div></div>}</div>):<div className="empty small-empty"><div>✓</div><p>{T.admin.noPending}</p></div>}</section>
    <section className="panel"><div className="panel-title"><h2>{T.admin.quickActions}</h2></div><div className="admin-actions"><button onClick={()=>api("/admin/reports").then(d=>alert(T.admin.reportFound(n((d.reports||[]).length)))).catch(e=>alert(e.message))}>{T.admin.reviewReports}</button><button onClick={()=>alert(T.admin.mapMsg)}>{T.admin.map}</button><button onClick={()=>alert(T.admin.settingsMsg)}>{T.admin.settings}</button><button onClick={()=>alert(T.admin.analyticsMsg(n(overview.workers),n(overview.bookings)))}>{T.admin.analytics}</button></div></section></div>
    {rejected.length>0&&<section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>{T.admin.rejectedWorkers}</h2><span>{n(rejected.length)} {T.admin.rejected}</span></div>{rejected.map(w=><div className="request" key={w.id}><div className="avatar mini">{w.avatar}</div><div><b>{w.name}</b><span>{translateService(lang,w.service)} · {translateArea(lang,w.area)}</span>{w.rejectionReasonEn&&<small>EN · {w.rejectionReasonEn}</small>}{w.rejectionReasonBn&&<small>BN · {w.rejectionReasonBn}</small>}{nidLink(w)}</div><button onClick={()=>verify(w.id)} className="btn btn-outline btn-sm">{T.admin.reapprove}</button></div>)}</section>}
    <section className="panel" style={{marginTop:24}}><div className="panel-title"><h2>{T.admin.dbRecords}</h2><button className="btn btn-outline btn-sm" onClick={load}>{T.admin.refresh}</button></div>{dbData?<><p>{T.admin.dbText}</p>{Object.entries(dbData).map(([table,rows])=><details key={table} style={{margin:"12px 0"}}><summary style={{cursor:"pointer",fontWeight:700,textTransform:"capitalize"}}>{table} ({n(rows.length)})</summary><div style={{overflowX:"auto",marginTop:10}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>{rows.length ? <><thead><tr>{Object.keys(rows[0]).map(k=><th key={k} style={{textAlign:"left",padding:8,borderBottom:"1px solid #ddd"}}>{k}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j} style={{padding:8,borderBottom:"1px solid #eee"}}>{n(String(v??""))}</td>)}</tr>)}</tbody></> : <tbody><tr><td>{T.admin.noRecords}</td></tr></tbody>}</table></div></details>)}</>:<p>{T.admin.dbFail}</p>}</section>
  </div></main>
}

function Profile({user,bookings,logout}){
  const {lang,T,n}=useLang();
  const [me,setMe]=useState(null);
  useEffect(()=>{if(user?.role==="worker")api("/workers/me").then(d=>setMe(d.worker)).catch(()=>setMe(null));},[user?.role]);
  const list=bookings||[];
  const total=list.length;
  const completed=list.filter(b=>b.status==="Completed").length;
  const upcoming=list.filter(b=>b.status!=="Completed").length;
  const spent=list.reduce((sum,b)=>{const n=parseInt(String(b.amount||"").replace(/[^0-9]/g,""),10);return sum+(isNaN(n)?0:n);},0);
  const roleLabel=user?.role==="worker"?T.profile.worker:user?.role==="admin"?T.profile.admin:T.profile.customer;
  const recent=list.slice(0,4);
  return <main className="page"><div className="container">
    <div className="dashboard-head">
      <div><span className="eyebrow">{T.profile.eyebrow}</span><h1>{user?.name||T.profile.titleFallback}</h1><p>{user?.email||T.profile.emailFallback}</p></div>
      <span className="role-pill">{roleLabel}</span>
    </div>
    <div className="dash-stats">
      <Stat n={n(total)} label={T.profile.stats.total}/>
      <Stat n={n(upcoming)} label={T.profile.stats.upcoming}/>
      <Stat n={n(completed)} label={T.profile.stats.completed}/>
      <Stat n={n("৳"+spent.toLocaleString("en-US"))} label={T.profile.stats.spent}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-title"><h2>{T.profile.recent}</h2><Link to="/bookings">{T.profile.viewAll}</Link></div>
        {recent.length?recent.map(b=><div className="request" key={b.id}><div className="avatar mini">{(b.service||"?")[0]}</div><div><b>{translateService(lang,b.service)}</b><span>{n(b.date)} · {n(b.time)}</span><small>{b.worker} · {translateArea(lang,b.area)}</small></div><Status s={b.status}/></div>):<div className="empty small-empty"><div>📅</div><p>{T.profile.noBookings}</p></div>}
        <div className="profile-actions"><Link to="/workers" className="btn btn-primary btn-sm">{T.profile.newBooking}</Link><Link to="/bookings" className="btn btn-outline btn-sm">{T.profile.viewAll}</Link></div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>{T.profile.settings}</h2></div>
        <div className="settings-row"><span>{T.profile.language}</span><LangToggle/></div>
        <div className="settings-row"><span>{T.profile.email}</span><b>{user?.email||T.profile.emailFallback}</b></div>
        {user?.phone&&<div className="settings-row"><span>{T.profile.phone}</span><b>{user.phone}</b></div>}
        {user?.area&&<div className="settings-row"><span>{T.profile.area}</span><b>{translateArea(lang,user.area)}</b></div>}
        <div className="settings-row"><span>{T.profile.notifications}</span><b>{T.profile.enabled}</b></div>
        {user?.role==="worker"&&<div className="settings-row"><span>{T.profile.verification}</span>{me?(me.verified?<span className="verified">{T.workerDash.nidVerified}</span>:me.rejected?<span className="rejected">✕ {T.workerDash.rejected}</span>:<span className="pending">⏳ {T.workerDash.nidPending}</span>):<b>…</b>}</div>}
        {me?.rejected&&(me.rejectionReasonEn||me.rejectionReasonBn)&&<div className="reason-card"><h4>{T.workerDash.adminComment}</h4>{me.rejectionReasonEn&&<p><b>EN:</b> {me.rejectionReasonEn}</p>}{me.rejectionReasonBn&&<p><b>বাংলা:</b> {me.rejectionReasonBn}</p>}</div>}
        <button onClick={logout} className="btn btn-logout btn-lg full profile-logout"><LogoutIcon/> {T.profile.logout}</button>
      </section>
    </div>
  </div></main>
}

function NotFound(){const {T}=useLang();return <main className="page"><div className="container empty"><div>404</div><h1>{T.notFound.title}</h1><Link to="/" className="btn btn-primary">{T.notFound.home}</Link></div></main>}
function Footer(){const {T}=useLang();return <footer><div className="container footer-grid"><div><Link to="/" className="logo"><span className="logo-mark">শ</span><span>Sheboy<span>Haat</span></span></Link><p>{T.footer.tagline}<br/>{T.footer.tagline2}</p></div><div><b>{T.footer.platform}</b><Link to="/services">{T.nav.services}</Link><Link to="/workers">{T.nav.workers}</Link><Link to="/bookings">{T.nav.bookings}</Link></div><div><b>{T.footer.forWorkers}</b><Link to="/register">{T.footer.join}</Link><Link to="/worker-dashboard">{T.footer.workerDashboard}</Link></div><div><b>{T.footer.demoAdmin}</b><Link to="/admin">{T.footer.adminPanel}</Link><span>support@sheboyhaat.demo</span></div></div><div className="footer-bottom"><div className="container">{T.footer.copyright}</div></div></footer>}

function Services(){const {T}=useLang();return <main className="page"><div className="container"><div className="page-heading"><div><span className="eyebrow">{T.services.eyebrow}</span><h1>{T.services.title}</h1><p>{T.services.text}</p></div></div><div className="service-grid large">{services.map(s=><ServiceCard key={s.id} s={s}/>)}</div></div></main>}
function ServicesDummy(){return null}

export default App;
