# 點餐紀錄網站

這是一個可直接使用的點餐網站，功能包含：

- 顯示餐點清單
- 勾選餐點與調整數量
- 編輯與刪除歷史訂單
- 自動計算小計、折扣與應付金額
- 送出訂單
- 顯示訂單紀錄
- 儲存訂單資料

## 使用方式

### 方式 1：直接打開網頁

直接用瀏覽器打開 `public/index.html` 就可以使用。
這個模式會把訂單存到瀏覽器本機儲存空間。

### 方式 2：用 Node.js 啟動伺服器

如果你的電腦有安裝 Node.js，可以在這個資料夾執行：

```bash
npm install
npm start
```

然後打開 `http://localhost:3000`。

這個模式會把訂單存到 SQLite 資料庫 `data/orders.sqlite3`，你也可以用 SQLiteStudio 開啟這個檔案來查看或修改資料。

折扣規則目前是：

- 滿 500 折 50
- 滿 1000 折 10%

## 檔案說明

- `public/index.html`：主畫面
- `public/style.css`：版面與視覺設計
- `public/app.js`：前端互動與儲存邏輯
- `server.js`：Express 後端 API
- `data/orders.sqlite3`：SQLite 訂單與菜單資料庫
