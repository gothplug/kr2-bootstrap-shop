// Каталог: фильтры, поиск, сортировка и постраничный вывод.
// Карточки уже есть в HTML (их видно и без JavaScript), скрипт только скрывает,
// показывает и переставляет их.

const PAGE_SIZE = 6;

const filtersForm = document.getElementById('filtersForm');
const searchInput = document.getElementById('catalogSearch');
const sortSelect = document.getElementById('catalogSort');
const grid = document.getElementById('productsGrid');
const countLabel = document.getElementById('catalogCount');
const emptyAlert = document.getElementById('catalogEmpty');
const pagination = document.getElementById('catalogPagination');
const activeFilters = document.getElementById('activeFilters');
const priceFrom = document.getElementById('priceFrom');
const priceTo = document.getElementById('priceTo');
const priceError = document.querySelector('.js-price-error');
const applyButton = document.querySelector('.js-filters-apply');

// Колонки с карточками и данные товара для каждой из них.
const columns = Array.from(grid.querySelectorAll('.js-product-col')).map((element, index) => ({
  element,
  index,
  product: findProduct(element.dataset.id)
}));

let currentPage = 1;

// Считывает текущие условия из формы и строки поиска.
function getState() {
  return {
    category: filtersForm.elements.category.value,
    from: priceFrom.value === '' ? null : Number(priceFrom.value),
    to: priceTo.value === '' ? null : Number(priceTo.value),
    inStock: filtersForm.elements.inStock.checked,
    onlyNew: filtersForm.elements.onlyNew.checked,
    onlySale: filtersForm.elements.onlySale.checked,
    query: searchInput.value.trim().toLowerCase(),
    sort: sortSelect.value
  };
}

function matches(product, state) {
  if (state.category !== 'all' && product.category !== state.category) return false;
  if (state.from !== null && product.price < state.from) return false;
  if (state.to !== null && product.price > state.to) return false;
  if (state.inStock && product.stock === 0) return false;
  if (state.onlyNew && product.badge !== 'new') return false;
  if (state.onlySale && !product.oldPrice) return false;
  if (state.query && !product.name.toLowerCase().includes(state.query)) return false;
  return true;
}

const sorters = {
  popular: (a, b) => a.index - b.index,
  'price-asc': (a, b) => a.product.price - b.product.price,
  'price-desc': (a, b) => b.product.price - a.product.price,
  rating: (a, b) => b.product.rating - a.product.rating,
  name: (a, b) => a.product.name.localeCompare(b.product.name, 'ru')
};

// Значки с активными фильтрами; по клику на крестик фильтр снимается.
function renderActiveFilters(state) {
  const chips = [];
  if (state.category !== 'all') chips.push({ key: 'category', text: CATEGORIES[state.category] });
  if (state.from !== null) chips.push({ key: 'from', text: `от ${formatPrice(state.from)}` });
  if (state.to !== null) chips.push({ key: 'to', text: `до ${formatPrice(state.to)}` });
  if (state.inStock) chips.push({ key: 'inStock', text: 'В наличии' });
  if (state.onlyNew) chips.push({ key: 'onlyNew', text: 'Новинки' });
  if (state.onlySale) chips.push({ key: 'onlySale', text: 'Со скидкой' });
  if (state.query) chips.push({ key: 'query', text: `«${state.query}»` });

  activeFilters.innerHTML = chips.map((chip) => `
    <span class="badge rounded-pill text-bg-primary d-inline-flex align-items-center gap-1 filter-chip">
      ${escapeHtml(chip.text)}
      <button class="btn-close btn-close-white js-chip-remove" type="button" data-key="${chip.key}" aria-label="Убрать фильтр ${escapeHtml(chip.text)}"></button>
    </span>
  `).join('');
}

function renderPagination(totalPages) {
  pagination.parentElement.classList.toggle('d-none', totalPages <= 1);
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  const pageItem = (page, text, { disabled = false, active = false, label = '' } = {}) => `
    <li class="page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}">
      <a class="page-link" href="#productsGrid" data-page="${page}"${active ? ' aria-current="page"' : ''}${label ? ` aria-label="${label}"` : ''}${disabled ? ' tabindex="-1" aria-disabled="true"' : ''}>${text}</a>
    </li>`;

  let html = pageItem(currentPage - 1, '&laquo;', { disabled: currentPage === 1, label: 'Предыдущая страница' });
  for (let page = 1; page <= totalPages; page += 1) {
    html += pageItem(page, page, { active: page === currentPage });
  }
  html += pageItem(currentPage + 1, '&raquo;', { disabled: currentPage === totalPages, label: 'Следующая страница' });
  pagination.innerHTML = html;
}

// Сохраняет фильтры в адресе страницы, чтобы ссылкой можно было поделиться.
function updateUrl(state) {
  const params = new URLSearchParams();
  if (state.category !== 'all') params.set('category', state.category);
  if (state.query) params.set('q', searchInput.value.trim());
  if (state.onlyNew) params.append('only', 'new');
  if (state.onlySale) params.append('only', 'sale');
  if (state.sort !== 'popular') params.set('sort', state.sort);
  const query = params.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

function applyFilters({ resetPage = true } = {}) {
  const state = getState();

  // Проверка диапазона цены.
  const badRange = state.from !== null && state.to !== null && state.from > state.to;
  priceTo.classList.toggle('is-invalid', badRange);
  priceError.classList.toggle('d-block', badRange);
  if (badRange) state.to = null;

  if (resetPage) currentPage = 1;

  const found = columns.filter((column) => matches(column.product, state)).sort(sorters[state.sort]);
  const totalPages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const visible = new Set(found.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));

  // Переставляем колонки в порядке сортировки и скрываем лишние.
  found.forEach((column) => grid.appendChild(column.element));
  columns.forEach((column) => column.element.classList.toggle('d-none', !visible.has(column)));

  const word = plural(found.length, 'товар', 'товара', 'товаров');
  countLabel.textContent = `Найдено: ${found.length} ${word}`;
  if (applyButton) applyButton.textContent = found.length ? `Показать ${found.length} ${word}` : 'Ничего не найдено';
  emptyAlert.classList.toggle('d-none', found.length > 0);

  renderActiveFilters(state);
  renderPagination(found.length ? totalPages : 0);
  updateUrl(state);
}

// Начальные условия из адреса: catalog.html?category=audio&q=мышь&only=new
function readUrl() {
  const params = new URLSearchParams(location.search);
  const category = params.get('category');
  if (category && CATEGORIES[category]) {
    filtersForm.querySelector(`input[name="category"][value="${category}"]`).checked = true;
  }
  if (params.get('q')) searchInput.value = params.get('q');
  const only = params.getAll('only');
  filtersForm.elements.onlyNew.checked = only.includes('new');
  filtersForm.elements.onlySale.checked = only.includes('sale');
  if (sorters[params.get('sort')]) sortSelect.value = params.get('sort');
}

function resetAll() {
  filtersForm.reset();
  searchInput.value = '';
  sortSelect.value = 'popular';
  applyFilters();
}

filtersForm.addEventListener('change', () => applyFilters());
filtersForm.addEventListener('input', (event) => {
  if (event.target.type === 'number') applyFilters();
});
filtersForm.addEventListener('submit', (event) => event.preventDefault());
filtersForm.addEventListener('reset', () => setTimeout(() => applyFilters()));

searchInput.addEventListener('input', () => applyFilters());
sortSelect.addEventListener('change', () => applyFilters());
document.querySelector('.js-reset-all').addEventListener('click', resetAll);

pagination.addEventListener('click', (event) => {
  const link = event.target.closest('[data-page]');
  if (!link || link.closest('.disabled')) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  currentPage = Number(link.dataset.page);
  applyFilters({ resetPage: false });
  grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

activeFilters.addEventListener('click', (event) => {
  const button = event.target.closest('.js-chip-remove');
  if (!button) return;

  const key = button.dataset.key;
  if (key === 'category') filtersForm.querySelector('#catAll').checked = true;
  if (key === 'from') priceFrom.value = '';
  if (key === 'to') priceTo.value = '';
  if (key === 'inStock' || key === 'onlyNew' || key === 'onlySale') filtersForm.elements[key].checked = false;
  if (key === 'query') searchInput.value = '';
  applyFilters();
});

readUrl();
applyFilters();
