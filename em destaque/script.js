// =============================================
//  MOCK DATA - lista com dados "problemáticos"
// =============================================
const mockProducts = [
  { id: 101, title: "Notebook Gamer",   price: 4500,      highlight: true  },
  { id: 102, title: "Mouse RGB",        price: "200",     highlight: "true" },
  { id: 103, title: null,               price: 150,       highlight: true  },
  { id: 104,                            price: 900,       highlight: false },
  { id: 105, title: "Monitor 4K",       price: -3000,     highlight: true  },
  { id: 106, title: "Teclado Mecânico", price: undefined, highlight: true  },
];

// =============================================
//  CONSTANTES
// =============================================
const API_URL         = "https://backend-node-nmze.onrender.com/featured";
const MAX_RETRIES     = 5;
const CACHE_KEY       = "featuredProducts_cache";
const CACHE_TTL_MS    = 2 * 60 * 1000; // 2 minutos

// Guarda os produtos prontos para filtrar
let allProducts = [];

// =============================================
//  NORMALIZAÇÃO
// =============================================
function normalizeProduct(p) {
  return {
    id:        p.id,
    title:     p.title || "Sem nome",
    price:     Number(p.price),
    highlight: p.highlight === true || p.highlight === "true",
  };
}

// =============================================
//  VALIDAÇÃO
// =============================================
function validateProduct(p) {
  return (
    p.price > 0 &&
    !isNaN(p.price)
  );
}

// =============================================
//  PREPARAR (normalizar + validar + filtrar highlight)
// =============================================
function prepareProducts(data) {
  return data
    .map(normalizeProduct)
    .filter(validateProduct)
    .filter(p => p.highlight);
}

// =============================================
//  RENDERIZAÇÃO
// =============================================
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

// =============================================
//  FILTROS
// =============================================
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
  document.getElementById("filterName").value      = "";
  document.getElementById("filterMaxPrice").value  = "";
  renderProducts(allProducts);
}

// =============================================
//  LOADING / ERRO
// =============================================
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

// =============================================
//  LOCAL STORAGE - CACHE 2 MINUTOS
// =============================================
function saveCache(data) {
  const payload = { timestamp: Date.now(), data };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) return null; // expirado
    return data;
  } catch {
    return null;
  }
}

// =============================================
//  FETCH COM RETRY
// =============================================
async function fetchWithRetry(url, maxRetries) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      lastError = err;
      console.warn(`Tentativa ${attempt}/${maxRetries} falhou:`, err.message);
      // Pequena espera crescente entre tentativas
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastError;
}

// =============================================
//  INICIALIZAÇÃO PRINCIPAL
// =============================================
async function init() {
  showLoading(true);
  showError(null);

  // 1. Tentar buscar da API com retry
  try {
    const rawData = await fetchWithRetry(API_URL, MAX_RETRIES);
    allProducts = prepareProducts(rawData);
    saveCache(allProducts);
    showError(null);
  } catch (err) {
    // 2. API falhou — tentar cache do LocalStorage
    const cached = loadCache();
    if (cached && cached.length > 0) {
      allProducts = cached;
      showError(
        "Não foi possível conectar à API. Exibindo dados salvos anteriormente (cache)."
      );
    } else {
      // 3. Sem API e sem cache — usar MOCK
      allProducts = prepareProducts(mockProducts);
      showError(
        "Não foi possível conectar à API e não há cache disponível. Exibindo dados locais de demonstração."
      );
    }
  } finally {
    showLoading(false);
    renderProducts(allProducts);
  }
}

// Iniciar ao carregar a página
init();
