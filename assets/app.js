(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid");
  const empty = $("#empty");
  const status = $("#status");
  const search = $("#search");
  const sort = $("#sort");
  const lb = $("#lightbox");
  const lbImg = $("#lb-img");

  let plans = [];      // plan metadata from the manifest
  let all = [];        // every monster from the manifest
  let view = [];       // currently visible (filtered + sorted)
  let plan = "all";
  let current = -1;    // index in `view` shown in the lightbox

  const color = (id) => `var(--${id.toLowerCase()}, var(--accent))`;
  const url = (p) => p.split("/").map(encodeURIComponent).join("/");
  const num = (n) => n.toLocaleString("id-ID");
  const pad = (n, w) => String(n).padStart(w, "0");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  fetch("manifest.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((data) => {
      plans = data.plans;
      const foot = $("#foot");
      for (const p of plans) {
        for (const it of p.items) all.push({ ...it, plan: p.id, label: p.label, folder: p.folder });

        const tab = el("button", "tab");
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", "false");
        tab.dataset.plan = p.id;
        tab.style.setProperty("--pc", color(p.id));
        tab.append(el("span", null, p.label), el("b", null, num(p.items.length)));
        $("#tabs").appendChild(tab);

        const f = el("span", null, `${p.label} — ${p.folder}/`);
        f.style.setProperty("--pc", color(p.id));
        foot.appendChild(f);
      }
      $('[data-count="all"]').textContent = num(all.length);
      $("#total").textContent = num(all.length);
      $("#plan-count").textContent = plans.length;
      if (!all.length) status.textContent = "Belum ada gambar. Upload PNG ke folder Monster_Detail….";
      readHash();
      render();
    })
    .catch(() => { status.textContent = "Gagal memuat manifest.json"; });

  function render() {
    const q = search.value.trim().toLowerCase();
    view = all.filter((m) =>
      (plan === "all" || m.plan === plan) &&
      (!q || m.name.toLowerCase().includes(q) || m.file.toLowerCase().includes(q)));
    const dir = sort.value === "za" ? -1 : 1;
    view.sort((a, b) => dir * a.name.localeCompare(b.name, "id", { numeric: true, sensitivity: "base" }));

    const width = String(view.length).length < 3 ? 3 : String(view.length).length;
    const frag = document.createDocumentFragment();
    view.forEach((m, i) => {
      const card = el("button", "card");
      card.dataset.i = i;
      card.style.setProperty("--pc", color(m.plan));
      card.title = `${m.name} — ${m.file}`;

      const img = el("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.alt = m.name;
      img.onload = () => img.classList.add("loaded");
      img.onerror = () => { if (img.src.indexOf(url(m.src)) < 0) img.src = url(m.src); };
      img.src = url(m.thumb);
      const thumb = el("div", "thumb");
      thumb.appendChild(img);

      const info = el("div", "info");
      info.append(el("h3", null, m.name), el("p", null, m.file));

      card.append(el("span", "idx", pad(i + 1, width)), el("span", "tag", m.plan), thumb, info);
      frag.appendChild(card);
    });
    grid.replaceChildren(frag);
    empty.hidden = view.length > 0 || all.length === 0;

    if (all.length) {
      const scope = plan === "all" ? "semua plan" : plans.find((p) => p.id === plan).label;
      status.replaceChildren(
        el("b", null, num(view.length)),
        ` entri · ${scope}`,
        q ? ` · cari “${search.value.trim()}”` : "",
      );
    }
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
      if (on) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  function readHash() {
    const m = location.hash.match(/^#plan-(\w+)$/i);
    if (m && all.some((x) => x.plan === m[1].toUpperCase())) setPlan(m[1].toUpperCase());
  }
  let debounce;
  search.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 120); });
  sort.addEventListener("change", render);
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !lb.open && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    }
  });

  /* ---------- lightbox ---------- */
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) open(+card.dataset.i);
  });

  function open(i) {
    if (!view.length) return;
    current = (i + view.length) % view.length;
    const m = view[current];
    lb.style.setProperty("--pc", color(m.plan));
    lbImg.src = url(m.thumb);          // show the light thumb instantly…
    const full = new Image();          // …then swap in the original when ready
    full.onload = () => { if (view[current] === m) lbImg.src = full.src; };
    full.src = url(m.src);
    lbImg.alt = m.name;
    const sub = m.path.includes("/") ? m.path.slice(0, m.path.lastIndexOf("/") + 1) : "";
    $("#lb-name").textContent = m.name;
    $("#lb-plan").textContent = m.label;
    $("#lb-file").textContent = m.file;
    $("#lb-folder").textContent = `${m.folder}/${sub}`;
    $("#lb-size").textContent = m.w ? `${m.w} × ${m.h} px` : "—";
    $("#lb-pos").textContent = `${pad(current + 1, String(view.length).length)} / ${view.length}`;
    $("#lb-open").href = url(m.src);
    if (!lb.open) lb.showModal();
    // preload neighbours' thumbs for snappy navigation
    [current + 1, current - 1].forEach((j) => {
      const n = view[(j + view.length) % view.length];
      if (n) new Image().src = url(n.thumb);
    });
  }

  lb.addEventListener("click", (e) => {
    if (e.target === lbImg) return;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close") lb.close();
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
