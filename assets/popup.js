

document.addEventListener('click', async (e) => {
  const trigger = e.target.closest('[data-product-handle]');
  if (!trigger) return;

  const handle = trigger.dataset.productHandle;
  const product = await fetchProduct(handle);
  renderPopup(product);
});

async function fetchProduct(handle) {
  const res = await fetch(`/products/${handle}.js`);
  return res.json();
}

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

function renderVariants(product, popup) {
  const container = popup.querySelector('.product-popup__variants');
  container.innerHTML = '';

  // group option names (e.g. Color, Size) — Dawn-style variant rendering
  product.options.forEach((optionName, index) => {
    const group = document.createElement('div');
    group.className = 'variant-group';
    group.innerHTML = `<label>${optionName}</label>`;

    const select = document.createElement('select');
    select.dataset.optionIndex = index;

    // unique values for this option position
    const values = [...new Set(product.variants.map(v => v[`option${index + 1}`]))];
    values.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      select.appendChild(opt);
    });

    group.appendChild(select);
    container.appendChild(group);
  });

  // store product reference for add-to-cart handler
  popup.querySelector('.product-popup__add-to-cart').dataset.productId = product.id;
  popup._currentProduct = product; // stash full product object for variant matching
}

async function addToCart(variantId, quantity = 1) {
  return fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: variantId, quantity }] })
  }).then(res => res.json());
}

document.addEventListener('click', async (e) => {
  if (!e.target.matches('.product-popup__add-to-cart')) return;

  const popup = document.getElementById('product-popup');
  const product = popup._currentProduct;

  // find matching variant based on selected dropdown values
  const selects = popup.querySelectorAll('.product-popup__variants select');
  const selected = Array.from(selects).map(s => s.value);

  const variant = product.variants.find(v =>
    selected.every((val, i) => v[`option${i + 1}`] === val)
  );

  if (!variant) return;

  await addToCart(variant.id);

  // ⚠️ business rule: if variant is Black + Medium, also add "Soft Winter Jacket"
  const isBlackMedium = selected.includes('Black') && selected.includes('Medium');
  if (isBlackMedium) {
    const jacket = await fetchProduct('soft-winter-jacket'); // use the real handle
    const jacketVariant = jacket.variants[0]; // adjust if it has its own variants
    await addToCart(jacketVariant.id);
  }

  document.dispatchEvent(new CustomEvent('cart:updated'));
});

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}