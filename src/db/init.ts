import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');

export const db = new Database(dbPath);

export function initDb() {
  // Create tables for an E-commerce system
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      city TEXT,
      country TEXT,
      registration_date DATE DEFAULT CURRENT_DATE
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      category TEXT,
      price DECIMAL(10,2) NOT NULL,
      stock_quantity INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      order_date DATE DEFAULT CURRENT_DATE,
      total_amount DECIMAL(10,2),
      status TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price DECIMAL(10,2),
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      review_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      customer_id INTEGER,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      review_date DATE DEFAULT CURRENT_DATE,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // Seed some data if empty
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
  if (customerCount.count === 0) {
    console.log('Seeding database...');
    
    // Customers
    const insertCustomer = db.prepare('INSERT INTO customers (first_name, last_name, email, city, country) VALUES (?, ?, ?, ?, ?)');
    insertCustomer.run('Alice', 'Smith', 'alice@example.com', 'New York', 'USA');
    insertCustomer.run('Bob', 'Johnson', 'bob@example.com', 'London', 'UK');
    insertCustomer.run('Charlie', 'Brown', 'charlie@example.com', 'Paris', 'France');
    insertCustomer.run('Diana', 'Prince', 'diana@example.com', 'Berlin', 'Germany');

    // Products
    const insertProduct = db.prepare('INSERT INTO products (product_name, category, price, stock_quantity) VALUES (?, ?, ?, ?)');
    insertProduct.run('Laptop Pro', 'Electronics', 1200.00, 50);
    insertProduct.run('Smartphone X', 'Electronics', 800.00, 100);
    insertProduct.run('Wireless Headphones', 'Accessories', 150.00, 200);
    insertProduct.run('Coffee Maker', 'Appliances', 80.00, 30);
    insertProduct.run('Desk Chair', 'Furniture', 250.00, 15);

    // Orders
    const insertOrder = db.prepare('INSERT INTO orders (customer_id, total_amount, status) VALUES (?, ?, ?)');
    insertOrder.run(1, 1350.00, 'Shipped');
    insertOrder.run(2, 800.00, 'Processing');
    insertOrder.run(3, 150.00, 'Delivered');

    // Order Items
    const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
    insertOrderItem.run(1, 1, 1, 1200.00);
    insertOrderItem.run(1, 3, 1, 150.00);
    insertOrderItem.run(2, 2, 1, 800.00);
    insertOrderItem.run(3, 3, 1, 150.00);

    // Reviews
    const insertReview = db.prepare('INSERT INTO reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)');
    insertReview.run(1, 1, 5, 'Excellent performance!');
    insertReview.run(3, 2, 4, 'Good sound quality, but a bit tight.');
    
    console.log('Database seeded successfully.');
  }
}
