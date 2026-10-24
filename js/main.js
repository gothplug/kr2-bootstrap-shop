// Общий скрипт для всех страниц: тема, корзина, уведомления, быстрый заказ, проверка форм.
// Интерактивные компоненты (navbar, modal, offcanvas, accordion, tabs, carousel, toast)
// работают за счёт Bootstrap JS Bundle, здесь только логика магазина.

// ---------- Вспомогательные функции ----------

// Экранирует текст перед вставкой в HTML.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Склонение слов после числа: 1 товар, 2 товара, 5 товаров.
function plural(number, one, few, many) {
  const n10 = number % 10;
  const n100 = number % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

// Безопасная работа с localStorage: в приватном режиме он может быть недоступен.
const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Если хранилище недоступно, корзина живёт только до перезагрузки страницы.
    }
  }
};

// ---------- Уведомления (Bootstrap Toast) ----------

function showToast(message, variant = 'success') {
  const toastElement = document.getElementById('appToast');
  if (!toastElement) return;

  toastElement.className = `toast align-items-center border-0 text-bg-${variant}`;
  // data-bs-theme="dark" делает кнопку закрытия светлой на цветном фоне.
  toastElement.setAttribute('data-bs-theme', 'dark');
  toastElement.querySelector('.js-toast-text').textContent = message;
  bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 3000 }).show();
}

// ---------- Корзина ----------

const CART_KEY = 'technest-cart';
let cart = storage.get(CART_KEY, []).filter((item) => findProduct(item.id) && item.qty > 0);

function getCart() {
  return cart.map((item) => ({ ...item, product: findProduct(item.id) }));
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

function saveCart() {
  storage.set(CART_KEY, cart);
  renderCart();
  document.dispatchEvent(new CustomEvent('cart:change'));
}

function addToCart(id, qty = 1) {
  const product = findProduct(id);
  if (!product || product.stock === 0) return;

  const item = cart.find((entry) => entry.id === product.id);
  if (item) {
    item.qty = Math.min(item.qty + qty, product.stock);
  } else {
    cart.push({ id: product.id, qty: Math.min(qty, product.stock) });
  }

  saveCart();
  showToast(`«${product.name}» добавлен в корзину`);
}

function setCartQty(id, qty) {
  const item = cart.find((entry) => entry.id === Number(id));
  if (!item) return;

  const product = findProduct(id);
  item.qty = Math.max(1, Math.min(qty, product.stock));
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter((entry) => entry.id !== Number(id));
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

// Перерисовывает счётчик в шапке и список в offcanvas-корзине.
function renderCart() {
  const count = getCartCount();

  document.querySelectorAll('.js-cart-count').forEach((badge) => {
    badge.textContent = count;
    badge.classList.toggle('d-none', count === 0);
  });

  const list = document.querySelector('.js-cart-items');
  if (!list) return;

  const items = getCart();
  document.querySelector('.js-cart-empty').classList.toggle('d-none', items.length > 0);
  document.querySelector('.js-cart-footer').classList.toggle('d-none', items.length === 0);
  document.querySelector('.js-cart-total').textContent = formatPrice(getCartTotal());

  list.innerHTML = items.map(({ product, qty }) => `
    <li class="list-group-item px-0 d-flex gap-3 align-items-center">
      <img class="rounded-2 flex-shrink-0" src="${product.image}" alt="" width="72" height="48">
      <div class="flex-grow-1 min-w-0">
        <a class="d-block small fw-semibold link-body-emphasis text-decoration-none text-truncate" href="product.html?id=${product.id}">${escapeHtml(product.name)}</a>
        <div class="d-flex align-items-center justify-content-between gap-2 mt-1">
          <div class="input-group input-group-sm cart-qty">
            <button class="btn btn-outline-secondary js-cart-minus" type="button" data-id="${product.id}" aria-label="Уменьшить">−</button>
            <span class="input-group-text bg-body px-2">${qty}</span>
            <button class="btn btn-outline-secondary js-cart-plus" type="button" data-id="${product.id}" aria-label="Увеличить"${qty >= product.stock ? ' disabled' : ''}>+</button>
          </div>
          <span class="small fw-semibold text-nowrap">${formatPrice(product.price * qty)}</span>
        </div>
      </div>
      <button class="btn-close flex-shrink-0 js-cart-remove" type="button" data-id="${product.id}" aria-label="Удалить ${escapeHtml(product.name)}"></button>
    </li>
  `).join('');
}

// Кнопки «В корзину» в карточках (делегирование — работает и для карточек, созданных скриптом).
document.addEventListener('click', (event) => {
  const addButton = event.target.closest('.js-add-to-cart');
  if (addButton) {
    addToCart(addButton.dataset.productId);
    return;
  }

  const minus = event.target.closest('.js-cart-minus');
  const plus = event.target.closest('.js-cart-plus');
  const remove = event.target.closest('.js-cart-remove');
  const item = (minus || plus) && cart.find((entry) => entry.id === Number((minus || plus).dataset.id));

  if (minus && item) {
    if (item.qty === 1) removeFromCart(item.id);
    else setCartQty(item.id, item.qty - 1);
  }
  if (plus && item) setCartQty(item.id, item.qty + 1);
  if (remove) removeFromCart(remove.dataset.id);

  if (event.target.closest('.js-cart-clear')) {
    clearCart();
    showToast('Корзина очищена', 'secondary');
  }
});

// ---------- Поля количества (input-group с кнопками − и +) ----------

document.addEventListener('click', (event) => {
  const button = event.target.closest('.js-qty-minus, .js-qty-plus');
  if (!button) return;

  const input = button.closest('.input-group').querySelector('input[type="number"]');
  const step = button.classList.contains('js-qty-plus') ? 1 : -1;
  const min = Number(input.min) || 1;
  const max = Number(input.max) || 99;
  input.value = Math.max(min, Math.min(max, (Number(input.value) || min) + step));
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

// ---------- Маска телефона: 9001234567 → (900) 123-45-67 ----------

function formatPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 10 && (digits[0] === '7' || digits[0] === '8')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  let result = '';
  if (parts[0]) result = `(${parts[0]}`;
  if (parts[0].length === 3) result += ')';
  if (parts[1]) result += ` ${parts[1]}`;
  if (parts[2]) result += `-${parts[2]}`;
  if (parts[3]) result += `-${parts[3]}`;
  return result;
}

document.querySelectorAll('[data-phone-mask]').forEach((input) => {
  input.addEventListener('input', () => {
    input.value = formatPhone(input.value);
  });
});

// ---------- Проверка форм в стиле Bootstrap ----------

// Подключает проверку к форме. onSuccess вызывается, только если все поля заполнены верно.
function setupForm(form, onSuccess) {
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      const firstInvalid = form.querySelector('input:invalid, select:invalid, textarea:invalid');
      if (firstInvalid) firstInvalid.focus();
      form.dispatchEvent(new CustomEvent('form:invalid'));
      return;
    }

    form.classList.remove('was-validated');
    onSuccess(new FormData(form));
  });

  form.addEventListener('reset', () => {
    form.classList.remove('was-validated');
  });
}

// ---------- Модальное окно быстрого заказа ----------

const quickModal = document.getElementById('quickOrderModal');

if (quickModal) {
  const quickForm = document.getElementById('quickOrderForm');
  const quickSuccess = quickModal.querySelector('.js-quick-success');

  // relatedTarget — кнопка, по которой открыли окно; из неё берём id товара.
  quickModal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    const product = trigger ? findProduct(trigger.dataset.productId) : null;
    if (!product) return;

    quickModal.querySelector('.js-quick-product').value = product.id;
    quickModal.querySelector('.js-quick-name').textContent = product.name;
    quickModal.querySelector('.js-quick-price').textContent = formatPrice(product.price);
    quickModal.querySelector('.js-quick-image').src = product.image;
  });

  quickModal.addEventListener('shown.bs.modal', () => {
    document.getElementById('quickName').focus();
  });

  const quickFields = quickModal.querySelector('.js-quick-fields');
  const quickSubmit = quickModal.querySelector('.js-quick-submit');
  const quickCancel = quickModal.querySelector('.js-quick-cancel');

  // Переключает окно между формой и сообщением об успешной отправке.
  function setQuickSent(isSent) {
    quickSuccess.classList.toggle('d-none', !isSent);
    quickFields.classList.toggle('d-none', isSent);
    quickSubmit.classList.toggle('d-none', isSent);
    quickCancel.textContent = isSent ? 'Закрыть' : 'Отмена';
  }

  quickModal.addEventListener('hidden.bs.modal', () => {
    setQuickSent(false);
    quickForm.reset();
  });

  setupForm(quickForm, (data) => {
    const product = findProduct(data.get('product'));
    quickSuccess.innerHTML = `<strong>Спасибо, ${escapeHtml(data.get('name'))}!</strong>
      Заявка на «${escapeHtml(product ? product.name : 'товар')}» (${data.get('quantity')} шт.) принята.
      Мы перезвоним на номер +7 ${escapeHtml(data.get('phone'))}.`;
    setQuickSent(true);
    quickCancel.focus();
  });
}

// ---------- Подписка на новости (главная) ----------

const subscribeForm = document.getElementById('subscribeForm');
setupForm(subscribeForm, (data) => {
  showToast(`Готово! Новости будут приходить на ${data.get('email')}`);
  subscribeForm.reset();
});

// ---------- Обратная связь (контакты) ----------

const feedbackForm = document.getElementById('feedbackForm');
if (feedbackForm) {
  const feedbackAlert = document.querySelector('.js-feedback-success');

  feedbackAlert.querySelector('.btn-close').addEventListener('click', () => {
    feedbackAlert.classList.add('d-none');
  });

  setupForm(feedbackForm, (data) => {
    feedbackAlert.querySelector('.js-feedback-text').textContent =
      `${data.get('name')}, спасибо! Ответ придёт на ${data.get('email')} в течение рабочего дня.`;
    feedbackAlert.classList.remove('d-none');
    feedbackForm.reset();
  });
}

// ---------- Переключатель темы ----------

document.querySelectorAll('.js-theme-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-bs-theme', next);
    try {
      localStorage.setItem('technest-theme', next);
    } catch (error) {
      // Тема просто не запомнится.
    }
  });
});

// ---------- Кнопка «Наверх» ----------

const toTop = document.querySelector('.js-to-top');
if (toTop) {
  const toggleToTop = () => toTop.classList.toggle('is-visible', window.scrollY > 400);
  window.addEventListener('scroll', toggleToTop, { passive: true });
  toggleToTop();

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---------- Подсказки Bootstrap (tooltip) ----------

document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
  bootstrap.Tooltip.getOrCreateInstance(element);
});

renderCart();
