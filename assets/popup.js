/**
 * popup.js
 * Handles the shared product popup: fetching product data, rendering
 * variant selection (color as button toggles, other options as dropdowns),
 * add-to-cart logic (including the Black+Medium auto-add rule), cart count
 * updates, toast notifications, and popup open/close behavior.
 */

document.addEventListener('click', async (e) => {
  const trigger = e.target.closest('[data-product-handle]');
  if (!trigger) return;

  const handle = trigger.dataset.productHandle;
  const product = await fetchProduct(handle);
  renderPopup(product);
});

/**
 * Fetches full product JSON (title, price, description, options, variants)
 * from Shopify's built-in product JSON endpoint.
 */
async function fetchProduct(handle) {
  const res = await fetch(`/products/${handle}.js`);
  return res.json();
}

/**
 * Populates the popup with the given product's data and reveals it.
 */
function renderPopup(product) {
  const popup = document.getElementById('product-popup');
  popup.querySelector('.product-popup__title').textContent = product.title;
  popup.querySelector('.product-popup__description').innerHTML = product.description;
  popup.querySelector('.product-popup__image').src = product.featured_image;

  const priceEl = popup.querySelector('.product-popup__price');
  priceEl.textContent = formatMoney(product.price);

  renderVariants(product, popup);
  popup.hidden = false;
}

/**
 * Renders one control per product option:
 * - "Color"-type options render as a row of clickable button toggles
 * - all other options (e.g. Size) render as a <select> dropdown with a
 *   "Choose your [option]" placeholder as the default selection
 */
function renderVariants(product, popup) {
  const container = popup.querySelector('.product-popup__variants');
  container.innerHTML = '';

  product.options.forEach((option, index) => {
    const optionName = typeof option === 'string' ? option : option.name;
    const isColor = optionName.toLowerCase().includes('color');

    const group = document.createElement('div');
    group.className = 'variant-group';

    const label = document.createElement('span');
    label.className = 'variant-group__label';
    label.textContent = optionName;
    group.appendChild(label);

    const values = [...new Set(product.variants.map(v => v[`option${index + 1}`]))];

    if (isColor) {
      // Render as a row of button toggles
      const optionsWrap = document.createElement('div');
      optionsWrap.className = 'variant-group__options';
      optionsWrap.dataset.optionIndex = index;

      values.forEach((val, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'variant-option';
        btn.textContent = val;
        btn.dataset.value = val;
        btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');

        btn.addEventListener('click', () => {
          optionsWrap.querySelectorAll('.variant-option').forEach(b =>
            b.setAttribute('aria-pressed', 'false')
          );
          btn.setAttribute('aria-pressed', 'true');
        });

        optionsWrap.appendChild(btn);
      });

      group.appendChild(optionsWrap);
    } else {
      // Render as a dropdown, with a non-selectable placeholder as the default
      const select = document.createElement('select');
      select.className = 'variant-group__select';
      select.dataset.optionIndex = index;

      const placeholder = document.createElement('option');
      placeholder.textContent = `Choose your ${optionName.toLowerCase()}`;
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      values.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
      });

      group.appendChild(select);
    }

    container.appendChild(group);
  });

  popup.querySelector('.product-popup__add-to-cart').dataset.productId = product.id;
  popup._currentProduct = product;
}

/**
 * Posts a variant to Shopify's cart endpoint.
 */
async function addToCart(variantId, quantity = 1) {
  return fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: variantId, quantity }] })
  }).then(res => res.json());
}

/**
 * Fetches the current cart and updates the header's cart count badge.
 */
async function updateCartCount() {
  const res = await fetch('/cart.js');
  const cart = await res.json();

  const cartCountEl = document.querySelector('[data-cart-count]') || document.querySelector('.cart-count-bubble');
  if (cartCountEl) {
    cartCountEl.textContent = cart.item_count;
  }
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('.product-popup__add-to-cart')) return;

  const popup = document.getElementById('product-popup');
  const product = popup._currentProduct;

  // Gather selected values from both button-groups and selects, ordered by optionIndex
  const groups = popup.querySelectorAll('.product-popup__variants [data-option-index]');
  const selected = Array.from(groups)
    .sort((a, b) => a.dataset.optionIndex - b.dataset.optionIndex)
    .map(group => {
      if (group.tagName === 'SELECT') return group.value;
      return group.querySelector('.variant-option[aria-pressed="true"]').dataset.value;
    });

  // Guard: make sure every option has a real value selected (not the empty placeholder)
  if (selected.some(val => !val)) {
    showAddedToCartToast('Please select all options before adding to cart');
    return;
  }

  const variant = product.variants.find(v =>
    selected.every((val, i) => v[`option${i + 1}`] === val)
  );

  if (!variant) return;

  await addToCart(variant.id);

  // ⚠️ business rule: if variant is Black + Medium, also add "Soft Winter Jacket"
  const isBlackMedium = selected.includes('Black') && selected.includes('Medium');
  if (isBlackMedium) {
    const jacket = await fetchProduct('classic-leather-jacket'); // use the real handle
    const jacketVariant = jacket.variants[0]; // adjust if it has its own variants
    await addToCart(jacketVariant.id);
  }

  await updateCartCount();
  showAddedToCartToast(product.title);
  popup.hidden = true;

  document.dispatchEvent(new CustomEvent('cart:updated'));
});

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Shows a brief toast notification confirming an item was added to cart
 * (or relaying a validation message, e.g. missing variant selection).
 */
function showAddedToCartToast(message) {
  const toast = document.createElement('div');
  toast.className = 'cart-toast';
  toast.textContent = message.includes('added to cart') || message.includes('Please')
    ? message
    : `${message} added to cart`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

// Close the popup when the × button is clicked
document.addEventListener('click', (e) => {
  if (!e.target.matches('.product-popup__close')) return;
  document.getElementById('product-popup').hidden = true;
});

// Close when clicking the dark overlay outside the popup content
document.addEventListener('click', (e) => {
  const popup = document.getElementById('product-popup');
  if (e.target === popup) {
    popup.hidden = true;
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('product-popup').hidden = true;
  }
});