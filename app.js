/* ============================================================
   O Tesouro do Cavaleiro Yuri — leitura da planilha do Google
   Lê o Google Sheets publicado, esconde itens já comprados,
   agrupa por categoria e mostra com busca + filtros.
   ============================================================ */

/* ---- CONFIGURAÇÃO (troque aqui se mudar a planilha) ---- */
const SHEET_ID   = "1c94jaSPwMC4cWvskXrbxszK8uESZlWNKeXqT3nYX6zc";
const SHEET_NAME = "Pergaminho"; // nome da aba

/* ---- Elementos ---- */
const els = {
  loading:  document.getElementById("loading"),
  error:    document.getElementById("error"),
  errorMsg: document.querySelector("#error small"),
  empty:    document.getElementById("empty"),
  grid:     document.getElementById("grid"),
  search:   document.getElementById("searchInput"),
  chips:    document.getElementById("categoryChips"),
  counter:  document.getElementById("counter"),
  retry:    document.getElementById("retryBtn"),
  filterToggle: document.getElementById("filterToggle"),
  filterPanel:  document.getElementById("filterPanel"),
  filterLabel:  document.querySelector(".filter-toggle__label"),
};

const isMobile = () => window.matchMedia("(max-width: 600px)").matches;

/* ---- Estado ---- */
let ALL_ITEMS = [];       // itens disponíveis (não comprados)
let activeCategory = "Todos";
let searchTerm = "";

/* ============================================================
   1) BUSCAR A PLANILHA (com fallback)
   ============================================================ */
async function fetchWorkbook() {
  const bust = Date.now(); // evita cache -> site sempre atualizado

  // MÉTODO PRINCIPAL: endpoint gviz em CSV.
  // Ele responde direto (sem redirect para googleusercontent), então o CORS
  // funciona de forma confiável no navegador / GitHub Pages.
  const gvizUrl =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&_=${bust}`;
  try {
    const res = await fetch(gvizUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const txt = await res.text();
    if (/^\s*<!doctype html/i.test(txt)) throw new Error("planilha não está pública");
    return XLSX.read(txt, { type: "string", raw: true });
  } catch (err) {
    // FALLBACK: export xlsx (faz redirect, pode ser bloqueado por extensões)
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&_=${bust}`;
    const res = await fetch(xlsxUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buf = await res.arrayBuffer();
    return XLSX.read(buf, { type: "array" });
  }
}

/* ============================================================
   2) NORMALIZAR OS DADOS
   ============================================================ */
function isBought(v) {
  if (v === true) return true;
  const s = String(v).trim().toLowerCase();
  return ["true", "verdadeiro", "sim", "x", "1", "✓", "✔", "yes", "comprado"].includes(s);
}

function parsePrice(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v > 0 ? v : null;
  let s = String(v).replace(/[^\d.,]/g, "").trim();
  if (!s) return null;
  // Formato BR: ponto = milhar, vírgula = decimal -> "1.234,56"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

function findCol(header, ...starts) {
  return header.findIndex((h) => {
    const t = String(h).trim().toLowerCase();
    return starts.some((s) => t.startsWith(s));
  });
}

function parseWorkbook(wb) {
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });

  // Descobre a linha de cabeçalho (a que contém "Item")
  let hIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === "item"));
  if (hIdx === -1) hIdx = 0;
  const header = rows[hIdx];

  const col = {
    item:  findCol(header, "item"),
    cat:   findCol(header, "categoria"),
    qtd:   findCol(header, "qtd", "quant"),
    price: findCol(header, "preço", "preco", "valor"),
    obs:   findCol(header, "observ"),
    bought:findCol(header, "comprado"),
    who:   findCol(header, "quem"),
    link:  findCol(header, "exemplo", "link"),
  };

  const items = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[col.item] ?? "").trim();
    if (!name) continue;                                   // linha vazia
    if (col.bought > -1 && isBought(r[col.bought])) continue; // JÁ COMPRADO -> some

    let link = col.link > -1 ? String(r[col.link] ?? "").trim() : "";
    if (link && !/^https?:\/\//i.test(link)) link = "";     // ignora "Clique aqui" etc.

    items.push({
      name,
      category: col.cat > -1 ? String(r[col.cat] ?? "").trim() || "Outros tesouros" : "Outros tesouros",
      qtd: col.qtd > -1 ? String(r[col.qtd] ?? "").trim() : "",
      price: col.price > -1 ? parsePrice(r[col.price]) : null,
      obs: col.obs > -1 ? String(r[col.obs] ?? "").trim() : "",
      link,
    });
  }
  return items;
}

/* ============================================================
   3) RENDERIZAÇÃO
   ============================================================ */
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildChips() {
  const cats = ["Todos", ...Array.from(new Set(ALL_ITEMS.map((i) => i.category)))];
  els.chips.innerHTML = "";
  cats.forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === activeCategory ? " active" : "");
    b.textContent = c;
    b.type = "button";
    b.addEventListener("click", () => {
      activeCategory = c;
      document.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      updateFilterLabel();
      if (isMobile()) setFilterOpen(false); // fecha o acordeão após escolher
      render();
    });
    els.chips.appendChild(b);
  });
  updateFilterLabel();
}

function updateFilterLabel() {
  if (!els.filterLabel) return;
  els.filterLabel.textContent =
    activeCategory === "Todos" ? "⚔️ Filtrar por categoria" : "⚔️ " + activeCategory;
}

function setFilterOpen(open) {
  if (!els.filterPanel || !els.filterToggle) return;
  els.filterPanel.classList.toggle("open", open);
  els.filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function getFiltered() {
  const term = searchTerm.trim().toLowerCase();
  return ALL_ITEMS.filter((it) => {
    if (activeCategory !== "Todos" && it.category !== activeCategory) return false;
    if (!term) return true;
    return (
      it.name.toLowerCase().includes(term) ||
      it.category.toLowerCase().includes(term) ||
      it.obs.toLowerCase().includes(term)
    );
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function cardHTML(it) {
  const price = it.price ? `<span class="card__badge card__badge--price">💰 ${esc(brl(it.price))}</span>` : "";
  const qtd = it.qtd ? `<span class="card__badge card__badge--qtd">✕ ${esc(it.qtd)}</span>` : "";
  const obs = it.obs ? `<p class="card__obs">📜 ${esc(it.obs)}</p>` : "";
  const link = it.link
    ? `<a class="card__link" href="${esc(it.link)}" target="_blank" rel="noopener">🛡️ Ver exemplo do tesouro</a>`
    : `<span class="card__link card__link--none">✨ Escolha livre do reino</span>`;
  return `
    <span class="card__cat">${esc(it.category)}</span>
    <h3 class="card__title">${esc(it.name)}</h3>
    <div class="card__meta">${qtd}${price}</div>
    ${obs}
    <div class="card__spacer"></div>
    ${link}
  `;
}

function render() {
  const items = getFiltered();
  els.grid.innerHTML = "";

  els.empty.hidden = items.length !== 0;
  els.counter.textContent = `🏆 Mostrando ${items.length} de ${ALL_ITEMS.length} tesouros`;

  items.forEach((it, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = cardHTML(it);
    els.grid.appendChild(card);
    // animação de entrada escalonada
    revealObserver.observe(card);
    card.style.setProperty("--i", idx);
  });
}

/* Animação ao rolar */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add("show"), (i % 8) * 60);
        revealObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.08 }
);

/* ============================================================
   4) INICIALIZAÇÃO
   ============================================================ */
function showState({ loading = false, error = false } = {}) {
  els.loading.hidden = !loading;
  els.error.hidden = !error;
  if (loading || error) {
    els.grid.innerHTML = "";
    els.empty.hidden = true;
  }
}

async function init() {
  showState({ loading: true });
  try {
    const wb = await fetchWorkbook();
    ALL_ITEMS = parseWorkbook(wb);
    showState({});
    buildChips();
    render();
  } catch (err) {
    console.error(err);
    els.errorMsg.textContent = String(err.message || err);
    showState({ error: true });
  }
}

/* Eventos */
els.search.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});
els.retry.addEventListener("click", init);

/* Acordeão de filtros (mobile) */
els.filterToggle?.addEventListener("click", () => {
  const open = els.filterToggle.getAttribute("aria-expanded") !== "true";
  setFilterOpen(open);
});

/* Vai! */
init();
