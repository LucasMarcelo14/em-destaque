const mockProducts = [
  { id: 101, title: "Notebook Gamer",   price: 4500,      highlight: true  },
  { id: 102, title: "Mouse RGB",        price: "200",     highlight: "true" },
  { id: 103, title: null,               price: 150,       highlight: true  },
  { id: 104,                            price: 900,       highlight: false },
  { id: 105, title: "Monitor 4K",       price: -3000,     highlight: true  },
  { id: 106, title: "Teclado Mecânico", price: undefined, highlight: true  },
];

const API_URL      = "https://backend-node-nmze.onrender.com/featured";
const MAX_RETRIES  = 5;
const CACHE_KEY    = "featuredProducts_cache";
const CACHE_TTL_MS = 2 * 60 * 1000;

let allProducts = [];

function normalizeProduct(p) {
  return {
    id:        p.id,
    title:     p.title || p.nome || "Sem nome",
    price:     Number(p.price ?? p.preco),
    highlight: p.highlight === true || p.highlight === "true" || p.isHighlighted === true || p.isHighlighted === "true",
  };
}

function validateProduct(p) {
  return p.price > 0 && !isNaN(p.price);
}

function prepareProducts(data, filterHighlight = true) {
  let result = data.map(normalizeProduct).filter(validateProduct);
  if (filterHighlight) result = result.filter(p => p.highlight);
  return result;
}

function renderProducts(products) {
  const container = document.getElementById("featuredProducts");

  if (!products || products.length === 0) {
    container.innerHTML = '<p class="empty-state">Nenhum produto encontrado.</p>';
    return;
  }

  container.innerHTML = products
    .map(p => `
      <div class="card">
        <span class="card-badge">Destaque</span>
        <h3 class="cardTitle">${p.title}</h3>
        <p class="cardPrice">R$ ${p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
      </div>
    `)
    .join("");
}

function applyFilters() {
  const nameFilter  = document.getElementById("filterName").value.toLowerCase().trim();
  const priceFilter = parseFloat(document.getElementById("filterMaxPrice").value);

  let filtered = allProducts.filter(p => {
    const matchName  = !nameFilter  || p.title.toLowerCase().includes(nameFilter);
    const matchPrice = isNaN(priceFilter) || p.price <= priceFilter;
    return matchName && matchPrice;
  });

  renderProducts(filtered);
}

function clearFilters() {
  document.getElementById("filterName").value     = "";
  document.getElementById("filterMaxPrice").value = "";
  renderProducts(allProducts);
}

function showLoading(visible) {
  document.getElementById("loading").classList.toggle("hidden", !visible);
}

function showError(message) {
  const el = document.getElementById("errorMsg");
  if (message) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

function saveCache(data) {
  const payload = { timestamp: Date.now(), data };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function extractProducts(rawData) {
  if (Array.isArray(rawData)) return rawData;
  if (!rawData || typeof rawData !== 'object') return [];
  const keys = ['items', 'data', 'products', 'featured', 'result', 'results', 'list', 'records'];
  for (const key of keys) {
    if (Array.isArray(rawData[key])) return rawData[key];
  }
  const arrays = Object.values(rawData).filter(Array.isArray);
  if (arrays.length > 0) return arrays[0];
  const allNumericKeys = Object.keys(rawData).length > 0 && Object.keys(rawData).every(k => !isNaN(k));
  if (allNumericKeys) return Object.values(rawData);
  return [];
}

async function fetchWithRetry(url, maxRetries) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastError;
}

async function init() {
  showLoading(true);
  showError(null);

  try {
    const rawData = await fetchWithRetry(API_URL, MAX_RETRIES);
    const items = extractProducts(rawData);
    const prepared = prepareProducts(items, false);
    if (prepared.length === 0) throw new Error("API retornou 0 produtos válidos");
    allProducts = prepared;
    saveCache(allProducts);
    showError(null);
  } catch (err) {
    const cached = loadCache();
    if (cached && cached.length > 0) {
      allProducts = cached;
      showError("Não foi possível conectar à API. Exibindo dados salvos anteriormente (cache).");
    } else {
      allProducts = prepareProducts(mockProducts);
      showError("Não foi possível conectar à API e não há cache disponível. Exibindo dados locais de demonstração.");
    }
  } finally {
    showLoading(false);
    renderProducts(allProducts);
  }
}

init();
