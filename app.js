const KEY = "office_net_netflix_progress_v1";
const $ = (q) => document.querySelector(q);

let DATA = { featuredCourseId: "", courses: [] };

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function write(v){ localStorage.setItem(KEY, JSON.stringify(v)); }

function getCompleted(courseId){
  const all = read();
  return Array.isArray(all[courseId]) ? all[courseId] : [];
}
function complete(courseId, lessonId){
  const all = read();
  all[courseId] ||= [];
  if(!all[courseId].includes(lessonId)) all[courseId].push(lessonId);
  write(all);
}
function resetCourse(courseId){
  const all = read();
  delete all[courseId];
  write(all);
}
function pct(done, total){ return total ? Math.round((done/total)*100) : 0; }

function ytThumb(videoId){
  // thumb HQ padrão
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}
function ytEmbed(videoId){
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
}

async function loadData(){
  const res = await fetch("./data/courses.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Não consegui carregar data/courses.json");
  DATA = await res.json();
}

function kpis(){
  const all = read();
  const totalLessons = DATA.courses.reduce((s,c)=>s+(c.lessons?.length||0),0);
  const doneLessons = Object.values(all).reduce((s,arr)=>s+(Array.isArray(arr)?arr.length:0),0);
  $("#kpi").textContent = `${doneLessons}/${totalLessons} aulas concluídas`;
}

function groupByCategory(list){
  const m = {};
  for(const c of list){
    const cat = c.category || "Outros";
    (m[cat] ||= []).push(c);
  }
  return m;
}

function featuredCourse(){
  const found = DATA.courses.find(c => c.id === DATA.featuredCourseId);
  return found || DATA.courses[0] || null;
}

function renderHome(list){
  const byCat = groupByCategory(list);
  const feat = featuredCourse();

  const featDone = feat ? getCompleted(feat.id).length : 0;
  const featTotal = feat ? (feat.lessons?.length||0) : 0;
  const featPct = pct(featDone, featTotal);

  $("#app").innerHTML = `
    <section class="hero">
      <div class="left">
        <h1>Treinamentos que a equipe realmente assiste.</h1>
        <p>${feat ? feat.description : "Catálogo interno de cursos e tutoriais."}</p>
        <div class="cta">
          <button class="btn primary" id="btnFeatured" ${feat ? "" : "disabled"}>Assistir agora</button>
          <button class="btn ghost" id="btnResetAll">Limpar progresso</button>
        </div>
      </div>

      <div class="right">
        <strong style="display:block">Destaque</strong>
        <small style="color:rgba(234,241,234,.6);font-weight:800">
          ${feat ? feat.title : "—"}
        </small>

        <div class="prog" style="margin-top:12px">
          <div style="width:${featPct}%"></div>
        </div>

        <div class="kpiBox">
          <div class="kpiCard">
            <strong>${featPct}%</strong>
            <small>Do destaque concluído</small>
          </div>
          <div class="kpiCard">
            <strong>${DATA.courses.length}</strong>
            <small>Cursos no catálogo</small>
          </div>
        </div>
      </div>
    </section>

    ${Object.entries(byCat).map(([cat, items]) => `
      <div class="rowHead">
        <h2>${escapeHtml(cat)}</h2>
        <small>${items.length} cursos</small>
      </div>
      <div class="rail">
        ${items.map(card).join("")}
      </div>
    `).join("")}
  `;

  $("#btnFeatured")?.addEventListener("click", () => feat && openCourse(feat.id));

  $("#btnResetAll")?.addEventListener("click", () => {
    if(confirm("Limpar TODO o progresso salvo neste navegador?")){
      localStorage.removeItem(KEY);
      kpis();
      renderHome(DATA.courses);
    }
  });

  document.querySelectorAll("[data-open]").forEach(b => {
    b.addEventListener("click", () => openCourse(b.getAttribute("data-open")));
  });
}

function card(c){
  const done = getCompleted(c.id).length;
  const total = c.lessons?.length || 0;
  const per = pct(done, total);
  const firstVideo = c.lessons?.[0]?.videoId;

  return `
    <div class="tile">
      <div class="thumb">
        ${firstVideo ? `<img src="${ytThumb(firstVideo)}" alt="Capa do curso ${escapeHtml(c.title)}">` : ""}
        <div class="play"><div class="playIcon"></div></div>
      </div>

      <div class="tileBody">
        <span class="title">${escapeHtml(c.title)}</span>

        <div class="meta">
          <small>${escapeHtml(c.level || "—")}</small>
          <small>${done}/${total} aulas</small>
        </div>

        <div class="tags">
          <span class="tag">${escapeHtml(c.category || "Outros")}</span>
          ${(c.tags||[]).slice(0,2).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
        </div>

        <div class="prog"><div style="width:${per}%"></div></div>

        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" data-open="${escapeHtml(c.id)}">Abrir</button>
          <button class="btn ghost" data-open="${escapeHtml(c.id)}">Continuar</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function openCourse(courseId){
  const c = DATA.courses.find(x=>x.id===courseId);
  if(!c) return;

  $("#mTitle").textContent = c.title;
  $("#mMeta").textContent = `${c.category || "Outros"} • ${c.level || "—"}`;

  const completed = new Set(getCompleted(c.id));
  const first = c.lessons?.[0];
  if(first) setVideo(first.videoId);

  $("#btnResetCourse").onclick = () => {
    if(confirm("Limpar o progresso deste curso neste navegador?")){
      resetCourse(c.id);
      kpis();
      openCourse(c.id);
    }
  };

  $("#mLessons").innerHTML = (c.lessons || []).map((l, idx) => {
    const done = completed.has(l.id);
    return `
      <div class="lesson">
        <div>
          <strong>${idx+1}. ${escapeHtml(l.title)}</strong>
          <small>${done ? "✅ Concluída" : "⏳ Pendente"} • ${escapeHtml(l.duration || "--:--")}</small>
        </div>
        <div class="lessonActions">
          <button class="btn ghost" data-play="${escapeHtml(l.videoId)}">Assistir</button>
          <button class="btn primary" data-done="${escapeHtml(l.id)}" ${done ? "disabled":""}>
            ${done ? "Concluída" : "Concluir"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  const doneCount = completed.size;
  const total = (c.lessons || []).length;
  const per = pct(doneCount, total);

  $("#mSide").innerHTML = `
    <div class="notice">
      <p><strong>Progresso:</strong> ${doneCount}/${total} aulas (${per}%).<br>
      Marque como concluída pra salvar. Sem servidor: fica salvo só neste navegador.</p>
      <div class="prog" style="margin-top:12px"><div style="width:${per}%"></div></div>
    </div>
  `;

  $("#modal").setAttribute("aria-hidden","false");

  document.querySelectorAll("[data-play]").forEach(b=>{
    b.addEventListener("click", ()=> setVideo(b.getAttribute("data-play")));
  });

  document.querySelectorAll("[data-done]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const lessonId = b.getAttribute("data-done");
      complete(c.id, lessonId);
      kpis();
      openCourse(c.id);
    });
  });
}

function setVideo(videoId){
  $("#mFrame").src = ytEmbed(videoId);
}

function closeModal(){
  $("#modal").setAttribute("aria-hidden","true");
  $("#mFrame").src = "";
}

document.addEventListener("click", (e) => {
  if(e.target.matches("[data-close]")) closeModal();
});

function setupSearch(){
  $("#q").addEventListener("input", () => {
    const q = $("#q").value.trim().toLowerCase();
    const list = DATA.courses.filter(c => {
      const hay = [
        c.title, c.category, c.level,
        (c.tags||[]).join(" "),
        c.description,
        (c.lessons||[]).map(l=>l.title).join(" ")
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
    renderHome(list);
  });

  $("#btnClear").addEventListener("click", () => {
    $("#q").value = "";
    renderHome(DATA.courses);
  });
}

(async function init(){
  await loadData();
  setupSearch();
  kpis();
  renderHome(DATA.courses);
})().catch(err => {
  $("#app").innerHTML = `
    <div class="notice">
      <p><strong>Erro ao iniciar:</strong> ${escapeHtml(err.message || String(err))}</p>
      <p style="margin-top:10px;color:rgba(234,241,234,.70)">
        Verifique se existe <strong>plataforma/data/courses.json</strong> e se o JSON está válido.
      </p>
    </div>
  `;
});
