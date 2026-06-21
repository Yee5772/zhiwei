const express = require('express');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const databaseFile = path.join(dataDir, 'orders.sqlite3');
const database = new Database(databaseFile);

const seedMenu = [
  { id: 'burger', name: '經典漢堡', price: 120, category: '主餐', sortOrder: 1 },
  { id: 'fried-chicken', name: '炸雞套餐', price: 180, category: '主餐', sortOrder: 2 },
  { id: 'spaghetti', name: '番茄義大利麵', price: 150, category: '主餐', sortOrder: 3 },
  { id: 'tea', name: '紅茶', price: 35, category: '飲料', sortOrder: 4 },
  { id: 'coffee', name: '美式咖啡', price: 45, category: '飲料', sortOrder: 5 },
  { id: 'fries', name: '脆薯', price: 50, category: '小點', sortOrder: 6 }
];

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS menu (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerName TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      items TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      total INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );
  `);

  const menuCount = database.prepare('SELECT COUNT(*) AS count FROM menu').get().count;
  if (menuCount === 0) {
    const insertMenu = database.prepare(`
      INSERT INTO menu (id, name, price, category, sortOrder)
      VALUES (@id, @name, @price, @category, @sortOrder)
    `);

    const insertMany = database.transaction((items) => {
      for (const item of items) {
        insertMenu.run(item);
      }
    });

    insertMany(seedMenu);
  }
}

function mapOrder(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    customerName: row.customerName,
    note: row.note,
    items: JSON.parse(row.items),
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || undefined
  };
}

function loadOrders() {
  ensureStorage();
  const rows = database.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  return rows.map(mapOrder);
}

function loadMenu() {
  ensureStorage();
  const rows = database.prepare('SELECT id, name, price, category FROM menu ORDER BY sortOrder ASC, id ASC').all();
  return rows;
}

function insertOrder(order) {
  ensureStorage();
  const statement = database.prepare(`
    INSERT INTO orders (customerName, note, items, subtotal, discount, total, createdAt, updatedAt)
    VALUES (@customerName, @note, @items, @subtotal, @discount, @total, @createdAt, @updatedAt)
  `);
  const result = statement.run({
    customerName: order.customerName,
    note: order.note,
    items: JSON.stringify(order.items),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || null
  });

  return { ...order, id: result.lastInsertRowid };
}

function updateOrder(id, order) {
  ensureStorage();
  const statement = database.prepare(`
    UPDATE orders
    SET customerName = @customerName,
        note = @note,
        items = @items,
        subtotal = @subtotal,
        discount = @discount,
        total = @total,
        updatedAt = @updatedAt
    WHERE id = @id
  `);
  const result = statement.run({
    id,
    customerName: order.customerName,
    note: order.note,
    items: JSON.stringify(order.items),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    updatedAt: order.updatedAt || null
  });

  return result.changes > 0;
}

function deleteOrder(id) {
  ensureStorage();
  const result = database.prepare('DELETE FROM orders WHERE id = ?').run(id);
  return result.changes > 0;
}

function calculateOrder(items) {
  const menu = loadMenu();
  const normalizedItems = items
    .map((item) => {
      const menuItem = menu.find((entry) => entry.id === item.id);
      const quantity = Number.parseInt(item.quantity, 10);

      if (!menuItem || Number.isNaN(quantity) || quantity <= 0) {
        return null;
      }

      return {
        id: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        subtotal: menuItem.price * quantity
      };
    })
    .filter(Boolean);

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = subtotal >= 1000 ? Math.floor(subtotal * 0.1) : subtotal >= 500 ? 50 : 0;
  const total = subtotal - discount;
  return { items: normalizedItems, subtotal, discount, total };
}

function buildOrderPayload({ customerName, note, items }) {
  const orderDetails = calculateOrder(items);

  return {
    customerName: customerName.trim(),
    note: typeof note === 'string' ? note.trim() : '',
    items: orderDetails.items,
    subtotal: orderDetails.subtotal,
    discount: orderDetails.discount,
    total: orderDetails.total
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/menu', (req, res) => {
  res.json(loadMenu());
});

app.get('/api/orders', (req, res) => {
  const orders = loadOrders();
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const { customerName, items, note } = req.body;

  if (!customerName || typeof customerName !== 'string' || !Array.isArray(items)) {
    return res.status(400).json({ message: '請輸入姓名並選擇至少一項餐點。' });
  }

  const cleanedName = customerName.trim();
  if (!cleanedName) {
    return res.status(400).json({ message: '姓名不能為空。' });
  }

  const orderPayload = buildOrderPayload({ customerName: cleanedName, note, items });
  if (orderPayload.items.length === 0) {
    return res.status(400).json({ message: '請至少選擇一項有效餐點。' });
  }

  const order = {
    ...orderPayload,
    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  const savedOrder = insertOrder(order);
  res.status(201).json(savedOrder);
});

app.put('/api/orders/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const { customerName, items, note } = req.body;

  if (!customerName || typeof customerName !== 'string' || !Array.isArray(items)) {
    return res.status(400).json({ message: '請輸入姓名並選擇至少一項餐點。' });
  }

  const cleanedName = customerName.trim();
  if (!cleanedName) {
    return res.status(400).json({ message: '姓名不能為空。' });
  }

  const orders = loadOrders();
  const existingOrder = orders.find((order) => order.id === id);

  if (!existingOrder) {
    return res.status(404).json({ message: '找不到要更新的訂單。' });
  }

  const orderPayload = buildOrderPayload({ customerName: cleanedName, note, items });
  if (orderPayload.items.length === 0) {
    return res.status(400).json({ message: '請至少選擇一項有效餐點。' });
  }

  const updatedOrder = {
    ...existingOrder,
    ...orderPayload,
    id,
    updatedAt: new Date().toISOString()
  };

  const saved = updateOrder(id, updatedOrder);
  if (!saved) {
    return res.status(404).json({ message: '找不到要更新的訂單。' });
  }

  res.json(updatedOrder);
});

app.delete('/api/orders/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const removed = deleteOrder(id);

  if (!removed) {
    return res.status(404).json({ message: '找不到要刪除的訂單。' });
  }
  res.json({ message: '已刪除訂單。' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Order site running at http://localhost:${port}`);
});
