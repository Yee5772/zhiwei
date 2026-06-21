using System;
using System.IO;
using Microsoft.Data.Sqlite;

var dataDir = Path.Combine(@"c:\Users\zhiwe\OneDrive\Desktop\資導", "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "orders.sqlite3");
if (File.Exists(dbPath))
{
    File.Delete(dbPath);
}

using var connection = new SqliteConnection($"Data Source={dbPath}");
connection.Open();

var createMenu = connection.CreateCommand();
createMenu.CommandText = @"
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
";
createMenu.ExecuteNonQuery();

using var insertMenu = connection.CreateCommand();
insertMenu.CommandText = @"
INSERT OR IGNORE INTO menu (id, name, price, category, sortOrder)
VALUES ($id, $name, $price, $category, $sortOrder);
";

void AddMenu(string id, string name, int price, string category, int sortOrder)
{
    insertMenu.Parameters.Clear();
    insertMenu.Parameters.AddWithValue("$id", id);
    insertMenu.Parameters.AddWithValue("$name", name);
    insertMenu.Parameters.AddWithValue("$price", price);
    insertMenu.Parameters.AddWithValue("$category", category);
    insertMenu.Parameters.AddWithValue("$sortOrder", sortOrder);
    insertMenu.ExecuteNonQuery();
}

AddMenu("burger", "經典漢堡", 120, "主餐", 1);
AddMenu("fried-chicken", "炸雞套餐", 180, "主餐", 2);
AddMenu("spaghetti", "番茄義大利麵", 150, "主餐", 3);
AddMenu("tea", "紅茶", 35, "飲料", 4);
AddMenu("coffee", "美式咖啡", 45, "飲料", 5);
AddMenu("fries", "脆薯", 50, "小點", 6);

Console.WriteLine(dbPath);
