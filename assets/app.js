(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid");
  const empty = $("#empty");
  const search = $("#search");
  const sort = $("#sort");
  const lb = $("#lightbox");
  const lbImg = $("#lb-img");

  let all = [];        // every monster from the manifest
  let view = [];       // currently visible (filtered + sorted)
  let plan = "all";
  let current = -1;    // index in `view` shown in the lightbox

  const url = (p) => p.split("/").map(encodeURIComponent).join("/");

  fetch("manifest.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      for (const p of data.plans) {
        for (const it of p.items) all.push({ ...it, plan: p.id, label: p.label, folder: p.folder });
        document.querySelector(`[data-count="${p.id}"]`).textContent = p.items.length;
      }
      document.querySelector('[data-count="all"]').textContent = all.length;
      $("#stats").textContent = all.length
        ? `${all.length} monster · ${data.plans.map((p) => `${p.label}: ${p.items.length}`).join(" · ")}`
        : "Belum ada gambar. Upload PNG ke folder Monster_Detail / Monster_Detail1.";
      readHash();
      render();
    })
    .catch(() => { $("#stats").textContent = "Gagal memuat manifest.json"; });

  function render() {
    const q = search.value.trim().toLowerCase();
    view = all.filter((m) =>
      (plan === "all" || m.plan === plan) &&
      (!q || m.name.toLowerCase().includes(q) || m.file.toLowerCase().includes(q)));
    const dir = sort.value === "za" ? -1 : 1;
    view.sort((a, b) => dir * a.name.localeCompare(b.name, "id", { numeric: true, sensitivity: "base" }));

    const frag = document.createDocumentFragment();
    view.forEach((m, i) => {
      const card = document.createElement("button");
      card.className = "card";
      card.dataset.plan = m.plan;
      card.dataset.i = i;
      card.style.animationDelay = `${Math.min(i, 24) * 25}ms`;
      card.innerHTML = `
        <span class="badge">${m.label}</span>
        <div class="thumb"><img loading="lazy" decoding="async" alt=""></div>
        <div class="info"><h3></h3><p></p></div>`;
      const img = card.querySelector("img");
      img.onload = () => img.classList.add("loaded");
      img.onerror = () => { if (img.src.indexOf(url(m.src)) < 0) img.src = url(m.src); };
      img.src = url(m.thumb);
      img.alt = m.name;
      card.querySelector("h3").textContent = m.name;
      card.querySelector("p").textContent = m.file;
      card.title = `${m.name} — ${m.file}`;
      frag.appendChild(card);
    });
    grid.replaceChildren(frag);
    empty.hidden = view.length > 0 || all.length === 0;
  }

  /* ---------- filters ---------- */
  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    setPlan(t.dataset.plan);
    history.replaceState(null, "", plan === "all" ? location.pathname : `#plan-${plan}`);
    render();
  });
  function setPlan(p) {
    plan = p;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.plan === p;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on);
    });
  }
  function readHash() {
    const m = location.hash.match(/^#plan-([AB])$/i);
    if (m) setPlan(m[1].toUpperCase());
  }
  let debounce;
  search.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 120); });
  sort.addEventListener("change", render);

  /* ---------- lightbox ---------- */
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) open(+card.dataset.i);
  });

  function open(i) {
    if (!view.length) return;
    current = (i + view.length) % view.length;
    const m = view[current];
    lb.style.setProperty("--glow", m.plan === "A" ? "var(--a)" : "var(--b)");
    lbImg.src = url(m.thumb);          // show the light thumb instantly…
    const full = new Image();          // …then swap in the original when ready
    full.onload = () => { if (view[current] === m) lbImg.src = full.src; };
    full.src = url(m.src);
    lbImg.alt = m.name;
    $("#lb-name").textContent = m.name;
    $("#lb-file").textContent = `${m.folder}/${m.path}`;
    $("#lb-badge").textContent = m.label;
    $("#lb-badge").style.background = `var(--${m.plan.toLowerCase()})`;
    $("#lb-pos").textContent = `${current + 1} / ${view.length}`;
    $("#lb-open").href = url(m.src);
    if (!lb.open) lb.showModal();
    // preload neighbours' thumbs for snappy navigation
    [current + 1, current - 1].forEach((j) => {
      const n = view[(j + view.length) % view.length];
      if (n) new Image().src = url(n.thumb);
    });
  }

  lb.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close" || e.target === lb) lb.close();
    else if (act === "prev") open(current - 1);
    else if (act === "next") open(current + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.open) return;
    if (e.key === "ArrowRight") open(current + 1);
    if (e.key === "ArrowLeft") open(current - 1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) open(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
})();
