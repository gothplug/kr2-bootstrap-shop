// Страница заявки: подстановка товара, расчёт суммы, проверка и отправка формы.

const orderForm = document.getElementById('orderForm');
const productSelect = document.getElementById('orderProduct');
const qtyInput = document.getElementById('orderQty');
const qtyField = document.querySelector('.js-qty-field');
const addressField = document.querySelector('.js-address-field');
const addressInput = document.getElementById('orderAddress');
const dateInput = document.getElementById('orderDate');
const commentInput = document.getElementById('orderComment');
const commentCounter = document.getElementById('orderCommentCounter');
const summaryList = document.getElementById('orderSummaryItems');
const alerts = document.getElementById('orderAlerts');
const submitButton = orderForm.querySelector('.js-submit');

const orderParams = new URLSearchParams(location.search);

// Дата связи — не раньше сегодняшнего дня.
const today = new Date();
dateInput.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Пункт «Товары из корзины» появляется, только если корзина не пуста.
function syncCartOption() {
  let option = productSelect.querySelector('option[value="cart"]');
  const count = getCartCount();

  if (count === 0) {
    if (option) {
      if (productSelect.value === 'cart') productSelect.value = '';
      option.remove();
    }
    return;
  }

  if (!option) {
    option = document.createElement('option');
    option.value = 'cart';
    productSelect.querySelector('optgroup').before(option);
  }
  option.textContent = `Товары из корзины (${count} шт.)`;
}

// Список позиций для блока «Ваш заказ».
function getOrderItems() {
  const value = productSelect.value;
  if (value === 'cart') return getCart();

  const product = findProduct(value);
  return product ? [{ product, qty: Number(qtyInput.value) || 1 }] : [];
}

function getDeliveryPrice() {
  const checked = orderForm.querySelector('input[name="delivery"]:checked');
  return Number(checked.dataset.price);
}

function renderSummary() {
  const items = getOrderItems();
  const isTopic = productSelect.value === 'consultation' || productSelect.value === 'other';

  qtyField.classList.toggle('d-none', productSelect.value === 'cart' || isTopic);

  if (items.length === 0) {
    summaryList.innerHTML = `<li class="list-group-item text-body-secondary small">${
      isTopic ? 'Заявка без товара: менеджер просто свяжется с вами.' : 'Товар пока не выбран.'
    }</li>`;
  } else {
    summaryList.innerHTML = items.map(({ product, qty }) => `
      <li class="list-group-item d-flex gap-3 align-items-center">
        <img class="rounded-2 flex-shrink-0" src="${product.image}" alt="" width="60" height="40">
        <div class="flex-grow-1 small">
          <div class="fw-semibold">${escapeHtml(product.name)}</div>
          <div class="text-body-secondary">${qty} × ${formatPrice(product.price)}</div>
        </div>
        <span class="small fw-semibold text-nowrap">${formatPrice(product.price * qty)}</span>
      </li>`).join('');
  }

  const subtotal = items.reduce((sum, { product, qty }) => sum + product.price * qty, 0);
  const delivery = items.length ? getDeliveryPrice() : 0;

  document.getElementById('orderSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('orderDelivery').textContent = delivery ? formatPrice(delivery) : 'бесплатно';
  document.getElementById('orderTotal').textContent = formatPrice(subtotal + delivery);
}

// Для курьера и доставки по региону адрес обязателен.
function syncDelivery() {
  const needsAddress = getDeliveryPrice() > 0;
  addressField.classList.toggle('d-none', !needsAddress);
  addressInput.required = needsAddress;
  renderSummary();
}

function showAlert(type, html) {
  alerts.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${html}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Закрыть"></button>
    </div>`;
  alerts.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Начальное состояние: товар из адреса (order.html?product=3) или товары из корзины.
syncCartOption();
const requestedProduct = findProduct(orderParams.get('product'));
if (requestedProduct) {
  productSelect.value = requestedProduct.id;
} else if (getCartCount() > 0) {
  productSelect.value = 'cart';
}
syncDelivery();

productSelect.addEventListener('change', renderSummary);
qtyInput.addEventListener('input', renderSummary);
orderForm.querySelectorAll('input[name="delivery"]').forEach((radio) => radio.addEventListener('change', syncDelivery));
document.addEventListener('cart:change', () => {
  syncCartOption();
  renderSummary();
});

commentInput.addEventListener('input', () => {
  commentCounter.textContent = `${commentInput.value.length} / ${commentInput.maxLength}`;
});

orderForm.addEventListener('reset', () => {
  setTimeout(() => {
    commentCounter.textContent = `0 / ${commentInput.maxLength}`;
    syncDelivery();
  });
});

orderForm.addEventListener('form:invalid', () => {
  showAlert('danger', '<strong>Заявка не отправлена.</strong> Проверьте поля, выделенные красным.');
});

setupForm(orderForm, (data) => {
  const items = getOrderItems();
  const total = items.reduce((sum, { product, qty }) => sum + product.price * qty, 0) + (items.length ? getDeliveryPrice() : 0);
  const orderNumber = `TN-${String(Date.now()).slice(-6)}`;
  const fromCart = data.get('product') === 'cart';

  // Имитация отправки на сервер: показываем спиннер на кнопке.
  submitButton.disabled = true;
  submitButton.querySelector('.spinner-border').classList.remove('d-none');
  submitButton.querySelector('.js-submit-text').textContent = 'Отправляем…';

  setTimeout(() => {
    submitButton.disabled = false;
    submitButton.querySelector('.spinner-border').classList.add('d-none');
    submitButton.querySelector('.js-submit-text').textContent = 'Отправить заявку';

    const itemsText = items.length
      ? `<ul class="mb-2">${items.map(({ product, qty }) => `<li>${escapeHtml(product.name)} — ${qty} шт.</li>`).join('')}</ul>
         <p class="mb-0">Сумма с доставкой: <strong>${formatPrice(total)}</strong>.</p>`
      : '<p class="mb-0">Менеджер ответит на ваш вопрос.</p>';

    showAlert('success', `
      <h2 class="alert-heading h5">Заявка ${orderNumber} принята!</h2>
      <p class="mb-2">${escapeHtml(data.get('name'))}, мы позвоним на номер +7 ${escapeHtml(data.get('phone'))}
      и пришлём подтверждение на ${escapeHtml(data.get('email'))}.</p>
      ${itemsText}`);

    if (fromCart) clearCart();
    orderForm.reset();
    showToast(`Заявка ${orderNumber} отправлена`);
  }, 800);
});
