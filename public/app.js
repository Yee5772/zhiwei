const menuList = document.getElementById('menu-list');
const selectedItems = document.getElementById('selected-items');
const orderForm = document.getElementById('order-form');
const customerName = document.getElementById('customer-name');
const note = document.getElementById('note');
const formMessage = document.getElementById('form-message');
const orderHistory = document.getElementById('order-history');
const totalOrders = document.getElementById('total-orders');
const todayRevenue = document.getElementById('today-revenue');
const itemCount = document.getElementById('item-count');
const discountTotal = document.getElementById('discount-total');
const clearSelectionButton = document.getElementById('clear-selection');
const cancelEditButton = document.getElementById('cancel-edit');
const refreshHistoryButton = document.getElementById('refresh-history');
const menuTemplate = document.getElementById('menu-template');
const editBanner = document.getElementById('edit-banner');
const orderSummary = document.getElementById('order-summary');
const LOCAL_STORAGE_KEY = 'order-site-orders';

const state = {
  menu: [],
  selected: new Map(),
  orders: [],
  editingOrderId: null
};

function formatPrice(amount) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0
  }).format(amount);
}

function showMessage(text, isError = false) {
  formMessage.textContent = text;
  formMessage.classList.toggle('error', isError);
}

function calculateSummary(items) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = subtotal >= 1000 ? Math.floor(subtotal * 0.1) : subtotal >= 500 ? 50 : 0;
  const total = subtotal - discount;

  return { subtotal, discount, total };
}

function normalizeStoredOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const summary = calculateSummary(items);

  return {
    ...order,
    subtotal: typeof order.subtotal === 'number' ? order.subtotal : summary.subtotal,
    discount: typeof order.discount === 'number' ? order.discount : summary.discount,
    total: typeof order.total === 'number' ? order.total : summary.total
  };
}

function getSelectedItems() {
  return [...state.selected.values()];
}

function setEditingState(orderId) {
  state.editingOrderId = orderId;
  editBanner.classList.toggle('hidden', orderId === null);
}

function clearFormState() {
  state.selected.clear();
  state.editingOrderId = null;
  customerName.value = '';
  note.value = '';
  editBanner.classList.add('hidden');
  renderMenu();
  renderSelectedItems();
  renderOrderSummary();
}

function loadOrderIntoForm(order) {
  state.selected.clear();

  order.items.forEach((item) => {
    const menuItem = state.menu.find((entry) => entry.id === item.id);
    if (menuItem) {
      state.selected.set(menuItem.id, { ...menuItem, quantity: item.quantity });
    }
  });

  customerName.value = order.customerName || '';
  note.value = order.note || '';
  setEditingState(order.id);
  renderMenu();
  renderSelectedItems();
  renderOrderSummary();
  showMessage(`正在編輯 ${order.customerName} 的訂單。`);
}

function toServerOrder(order) {
  return normalizeStoredOrder(order);
}

function renderOrderSummary() {
  const items = getSelectedItems();
  const summary = calculateSummary(items);

  if (items.length === 0) {
    orderSummary.className = 'order-summary hidden';
    orderSummary.innerHTML = '';
    return;
  }

  orderSummary.className = 'order-summary';
  orderSummary.innerHTML = `
    <div class="summary-row">
      <span>小計</span>
      <strong>${formatPrice(summary.subtotal)}</strong>
    </div>
    <div class="summary-row discount">
      <span>折扣</span>
      <strong>- ${formatPrice(summary.discount)}</strong>
    </div>
    <div class="summary-row total">
      <span>應付金額</span>
      <strong>${formatPrice(summary.total)}</strong>
    </div>
  `;
}

function renderMenu() {
  menuList.innerHTML = '';

  state.menu.forEach((item) => {
    const node = menuTemplate.content.cloneNode(true);
    const button = node.querySelector('.menu-item');
    const name = node.querySelector('.menu-name');
    const meta = node.querySelector('.menu-meta');
    const price = node.querySelector('.menu-price');

    name.textContent = item.name;
    meta.textContent = item.category;
    price.textContent = formatPrice(item.price);

    if (state.selected.has(item.id)) {
      button.classList.add('selected');
    }

    button.addEventListener('click', () => toggleItem(item.id));
    menuList.appendChild(node);
  });
}

function renderSelectedItems() {
  const entries = [...state.selected.values()];

  if (entries.length === 0) {
    selectedItems.className = 'selected-items empty';
    selectedItems.textContent = '尚未選擇餐點';
    renderOrderSummary();
    return;
  }

  selectedItems.className = 'selected-items';
  selectedItems.innerHTML = '';

  entries.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'selected-row';

    const left = document.createElement('div');
    left.innerHTML = `<strong>${item.name}</strong><div>${formatPrice(item.price)} / 份</div>`;

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.innerHTML = `
      <button type="button" class="quantity-button" aria-label="減少數量">−</button>
      <span>${item.quantity}</span>
      <button type="button" class="quantity-button" aria-label="增加數量">＋</button>
      <strong>${formatPrice(item.price * item.quantity)}</strong>
      <button type="button" class="remove-button" aria-label="移除餐點">✕</button>
    `;

    const [decreaseButton, increaseButton, removeButton] = actions.querySelectorAll('button');
    decreaseButton.addEventListener('click', () => changeQuantity(item.id, -1));
    increaseButton.addEventListener('click', () => changeQuantity(item.id, 1));
    removeButton.addEventListener('click', () => removeItem(item.id));

    row.append(left, actions);
    selectedItems.appendChild(row);
  });

  renderOrderSummary();
}

function toggleItem(id) {
  const item = state.menu.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    state.selected.set(id, { ...item, quantity: 1 });
  }

  renderMenu();
  renderSelectedItems();
}

function changeQuantity(id, delta) {
  const item = state.selected.get(id);
  if (!item) {
    return;
  }

  const nextQuantity = item.quantity + delta;
  if (nextQuantity <= 0) {
    state.selected.delete(id);
  } else {
    state.selected.set(id, { ...item, quantity: nextQuantity });
  }

  renderMenu();
  renderSelectedItems();
}

function removeItem(id) {
  state.selected.delete(id);
  renderMenu();
  renderSelectedItems();
}

function clearSelection() {
  state.selected.clear();
  renderMenu();
  renderSelectedItems();
  renderOrderSummary();
}

function loadLocalOrders() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeStoredOrder) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
}

function upsertLocalOrder(order) {
  const orders = loadLocalOrders();
  const normalizedOrder = normalizeStoredOrder(order);
  const index = orders.findIndex((entry) => entry.id === normalizedOrder.id);

  if (index === -1) {
    orders.unshift(normalizedOrder);
  } else {
    orders[index] = normalizedOrder;
  }

  saveLocalOrders(orders);
  return orders;
}

function deleteLocalOrder(id) {
  const orders = loadLocalOrders().filter((order) => order.id !== id);
  saveLocalOrders(orders);
  return orders;
}

function renderHistory() {
  orderHistory.innerHTML = '';

  if (state.orders.length === 0) {
    orderHistory.innerHTML = '<p class="muted">目前還沒有訂單。</p>';
    return;
  }

  state.orders.forEach((order) => {
    const article = document.createElement('article');
    article.className = 'history-item';

    const itemText = order.items
      .map((item) => `${item.name} × ${item.quantity}`)
      .join('、');

    const createdAt = new Date(order.createdAt).toLocaleString('zh-TW');
    const updatedAt = order.updatedAt ? ` · 已更新 ${new Date(order.updatedAt).toLocaleString('zh-TW')}` : '';

    article.innerHTML = `
      <div class="history-head">
        <div>
          <strong>${order.customerName}</strong>
          <div class="history-meta">${createdAt}${updatedAt}</div>
        </div>
        <div class="history-actions">
          <button type="button" class="edit-button" data-action="edit" data-id="${order.id}">編輯</button>
          <button type="button" class="remove-button" data-action="delete" data-id="${order.id}" aria-label="刪除訂單">✕</button>
        </div>
      </div>
      <div class="history-items">${itemText}</div>
      <div class="history-meta">小計 ${formatPrice(order.subtotal || order.total)} · 折扣 ${formatPrice(order.discount || 0)} · 應付 <strong class="total-line">${formatPrice(order.total)}</strong></div>
      ${order.note ? `<div class="history-meta">備註：${order.note}</div>` : ''}
    `;

    article.querySelector('[data-action="edit"]').addEventListener('click', () => loadOrderIntoForm(order));
    article.querySelector('[data-action="delete"]').addEventListener('click', () => removeOrder(order.id));

    orderHistory.appendChild(article);
  });
}

function updateStats() {
  totalOrders.textContent = String(state.orders.length);
  todayRevenue.textContent = formatPrice(state.orders.reduce((sum, order) => sum + order.total, 0));
  itemCount.textContent = String(state.orders.reduce((sum, order) => sum + order.items.length, 0));
  discountTotal.textContent = formatPrice(state.orders.reduce((sum, order) => sum + (order.discount || 0), 0));
}

async function loadMenu() {
  try {
    const response = await fetch('/api/menu');
    if (!response.ok) {
      throw new Error('menu fetch failed');
    }

    state.menu = await response.json();
  } catch {
    state.menu = [];
  }

  renderMenu();
}

async function loadOrders() {
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) {
      throw new Error('orders fetch failed');
    }

    state.orders = (await response.json()).map(normalizeStoredOrder);
  } catch {
    state.orders = loadLocalOrders();
  }

  renderHistory();
  updateStats();
}

async function removeOrder(orderId) {
  if (!window.confirm('確定要刪除這筆訂單嗎？')) {
    return;
  }

  try {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '刪除失敗');
    }

    await loadOrders();

    if (state.editingOrderId === orderId) {
      clearFormState();
    }

    showMessage('已刪除訂單。');
  } catch (error) {
    state.orders = deleteLocalOrder(orderId);
    renderHistory();
    updateStats();

    if (state.editingOrderId === orderId) {
      clearFormState();
    }

    showMessage('已從瀏覽器本機紀錄刪除。');
  }
}

async function saveOrder(payload) {
  const isEditing = state.editingOrderId !== null;
  const requestUrl = isEditing ? `/api/orders/${state.editingOrderId}` : '/api/orders';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const response = await fetch(requestUrl, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '送出失敗');
    }

    await loadOrders();
    return data;
  } catch {
    const baseOrder = {
      id: isEditing ? state.editingOrderId : Date.now(),
      customerName: payload.customerName.trim(),
      note: payload.note.trim(),
      items: payload.items.map((item) => {
        const menuItem = state.menu.find((entry) => entry.id === item.id);
        const price = menuItem ? menuItem.price : item.price;
        const name = menuItem ? menuItem.name : item.name;
        const quantity = item.quantity;

        return {
          id: item.id,
          name,
          price,
          quantity,
          subtotal: price * quantity
        };
      }),
      createdAt: isEditing ? state.orders.find((order) => order.id === state.editingOrderId)?.createdAt || new Date().toISOString() : new Date().toISOString()
    };

    const summary = calculateSummary(baseOrder.items);
    const storedOrder = {
      ...baseOrder,
      subtotal: summary.subtotal,
      discount: summary.discount,
      total: summary.total,
      updatedAt: isEditing ? new Date().toISOString() : undefined
    };

    const currentOrders = isEditing
      ? loadLocalOrders().map((order) => (order.id === storedOrder.id ? storedOrder : order))
      : [storedOrder, ...loadLocalOrders()];

    saveLocalOrders(currentOrders);
    state.orders = currentOrders.map(normalizeStoredOrder);
    renderHistory();
    updateStats();
    return storedOrder;
  }
}

async function submitOrder(event) {
  event.preventDefault();
  const selectedItems = getSelectedItems();
  const items = selectedItems.map((item) => ({ id: item.id, quantity: item.quantity }));
  const wasEditing = state.editingOrderId !== null;

  if (items.length === 0) {
    showMessage('請先選擇至少一項餐點。', true);
    return;
  }

  const payload = {
    customerName: customerName.value,
    note: note.value,
    items
  };

  try {
    const data = await saveOrder(payload);
    clearFormState();
    showMessage(wasEditing ? '已更新訂單。' : `已儲存訂單：${data.customerName}`);
  } catch (error) {
    showMessage(error.message || '儲存失敗', true);
  }
}

orderForm.addEventListener('submit', submitOrder);
clearSelectionButton.addEventListener('click', clearSelection);
refreshHistoryButton.addEventListener('click', loadOrders);
cancelEditButton.addEventListener('click', () => {
  clearFormState();
  showMessage('已取消編輯。');
});

(async function init() {
  await loadMenu();
  await loadOrders();
})();
