// Страница товара: заполняет шаблон данными товара из адреса product.html?id=N.
// Без параметра (или без JavaScript) показывается первый товар, который уже размечен в HTML.

const params = new URLSearchParams(location.search);
const requestedId = params.get('id');
let product = requestedId ? findProduct(requestedId) : PRODUCTS[0];

if (!product) {
  product = PRODUCTS[0];
  document.getElementById('productNotFound').classList.remove('d-none');
}

const field = (name) => document.querySelector(`[data-field="${name}"]`);

function reviewsText(count) {
  return `${count} ${plural(count, 'отзыв', 'отзыва', 'отзывов')}`;
}

function badgesHtml(item) {
  let html = '';
  if (item.badge) {
    const badge = BADGES[item.badge];
    html += `<span class="badge ${badge.className} fs-6">${badge.text}</span>`;
  }
  if (item.oldPrice) {
    const discount = Math.round((1 - item.price / item.oldPrice) * 100);
    html += `<span class="badge text-bg-dark fs-6">−${discount}%</span>`;
  }
  return html;
}

// Карточка для блока «Похожие товары» — та же разметка, что и в каталоге.
function cardHtml(item) {
  const badge = item.badge
    ? `<span class="badge ${BADGES[item.badge].className} position-absolute top-0 start-0 m-3">${BADGES[item.badge].text}</span>`
    : '';
  const discount = item.oldPrice
    ? `<span class="badge text-bg-dark position-absolute top-0 end-0 m-3">−${Math.round((1 - item.price / item.oldPrice) * 100)}%</span>`
    : '';
  const oldPrice = item.oldPrice ? `<del class="text-body-secondary small">${formatPrice(item.oldPrice)}</del>` : '';
  const cartButton = item.stock > 0
    ? `<button class="btn btn-primary flex-grow-1 js-add-to-cart" type="button" data-product-id="${item.id}">В корзину</button>`
    : '<button class="btn btn-secondary flex-grow-1" type="button" disabled>Нет в наличии</button>';

  return `
    <div class="col-12 col-sm-6 col-lg-4">
      <article class="card h-100 shadow-sm product-card">
        <a class="product-card__media" href="product.html?id=${item.id}" tabindex="-1" aria-hidden="true">
          <img class="card-img-top" src="${item.image}" alt="" width="600" height="400" loading="lazy">
        </a>${badge}${discount}
        <div class="card-body d-flex flex-column">
          <p class="small text-body-secondary mb-1">${CATEGORIES[item.category]}</p>
          <h3 class="card-title h6"><a class="link-body-emphasis text-decoration-none product-card__link" href="product.html?id=${item.id}">${escapeHtml(item.name)}</a></h3>
          <p class="card-text small text-body-secondary">${escapeHtml(item.short)}</p>
          <p class="small mb-3"><span class="text-warning" aria-hidden="true">★</span> ${item.rating.toFixed(1).replace('.', ',')} <span class="text-body-secondary">· ${reviewsText(item.reviews)}</span></p>
          <div class="mt-auto d-flex align-items-baseline gap-2 mb-3">
            <span class="fs-5 fw-bold">${formatPrice(item.price)}</span>${oldPrice}
          </div>
          <div class="d-flex gap-2">
            ${cartButton}
            <button class="btn btn-outline-primary" type="button" data-bs-toggle="modal" data-bs-target="#quickOrderModal" data-product-id="${item.id}">Заказать</button>
          </div>
        </div>
      </article>
    </div>`;
}

function renderProduct(item) {
  const categoryName = CATEGORIES[item.category];
  const categoryUrl = `catalog.html?category=${item.category}`;

  document.title = `${item.name} — TechNest`;

  field('breadcrumb-1').textContent = categoryName;
  field('breadcrumb-1').href = categoryUrl;
  field('breadcrumb-current').textContent = item.name;

  field('image').src = item.image;
  field('image').alt = item.name;
  field('badges').innerHTML = badgesHtml(item);

  field('category').textContent = categoryName;
  field('category').href = categoryUrl;
  field('name').textContent = item.name;
  field('rating').textContent = item.rating.toFixed(1).replace('.', ',');
  field('reviews').textContent = reviewsText(item.reviews);
  field('sku').textContent = item.sku;
  field('short').textContent = item.short;
  field('description').textContent = item.description;

  field('price').textContent = formatPrice(item.price);
  const oldPrice = field('old-price');
  oldPrice.classList.toggle('d-none', !item.oldPrice);
  oldPrice.textContent = item.oldPrice ? formatPrice(item.oldPrice) : '';

  const stock = field('stock');
  if (item.stock > 0) {
    stock.className = `badge ${item.stock < 10 ? 'text-bg-warning' : 'text-bg-success'}`;
    stock.textContent = item.stock < 10 ? `Осталось мало: ${item.stock} шт.` : `В наличии: ${item.stock} шт.`;
  } else {
    stock.className = 'badge text-bg-secondary';
    stock.textContent = 'Нет в наличии — можно оформить предзаказ';
  }

  const qtyInput = document.getElementById('productQty');
  const addButton = document.querySelector('.js-product-add');
  qtyInput.max = Math.max(item.stock, 1);
  qtyInput.value = 1;
  qtyInput.disabled = item.stock === 0;
  qtyInput.closest('.input-group').querySelectorAll('button').forEach((button) => {
    button.disabled = item.stock === 0;
  });
  addButton.dataset.productId = item.id;
  addButton.disabled = item.stock === 0;

  field('quick-order').dataset.productId = item.id;
  field('order-link').href = `order.html?product=${item.id}`;

  const specs = { 'Артикул': item.sku, 'Категория': categoryName, ...item.specs };
  field('specs').innerHTML = Object.entries(specs)
    .map(([name, value]) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');

  field('kit').innerHTML = item.kit
    .map((part) => `<li class="list-group-item d-flex gap-2"><span class="text-success" aria-hidden="true">✓</span> ${escapeHtml(part)}</li>`)
    .join('');

  // Похожие: сначала из той же категории, затем остальные, всего три.
  const similar = [
    ...PRODUCTS.filter((other) => other.id !== item.id && other.category === item.category),
    ...PRODUCTS.filter((other) => other.id !== item.id && other.category !== item.category)
  ].slice(0, 3);
  document.getElementById('similarProducts').innerHTML = similar.map(cardHtml).join('');
}

// Добавление в корзину с выбранным количеством.
document.querySelector('.js-product-add').addEventListener('click', (event) => {
  const qty = Number(document.getElementById('productQty').value) || 1;
  addToCart(event.currentTarget.dataset.productId, qty);
});

// Количество не выходит за пределы остатка на складе.
document.getElementById('productQty').addEventListener('change', (event) => {
  const input = event.target;
  input.value = Math.max(1, Math.min(Number(input.max), Number(input.value) || 1));
});

renderProduct(product);
