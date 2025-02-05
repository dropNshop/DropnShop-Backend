const { faker } = require('@faker-js/faker');
const pool = require('./Configs/db.config');

async function generateFakeData() {
  try {
    // Pharmacy Products with more detailed categories
    const pharmacyProducts = [
      // Pain & Fever
      { name: 'Panadol', price: { min: 50, max: 150 } },
      { name: 'Disprin', price: { min: 30, max: 80 } },
      { name: 'Brufen', price: { min: 120, max: 250 } },
      { name: 'Ponstan Forte', price: { min: 150, max: 300 } },
      
      // Antibiotics
      { name: 'Augmentin 625mg', price: { min: 500, max: 800 } },
      { name: 'Flagyl 400mg', price: { min: 200, max: 400 } },
      { name: 'Septran DS', price: { min: 180, max: 350 } },
      { name: 'Amoxil 500mg', price: { min: 300, max: 600 } },
      
      // Stomach & Digestion
      { name: 'Risek 40mg', price: { min: 180, max: 350 } },
      { name: 'Nexum 40mg', price: { min: 200, max: 400 } },
      { name: 'Motilium', price: { min: 150, max: 300 } },
      { name: 'Digestive', price: { min: 80, max: 150 } },
      
      // Cold & Flu
      { name: 'Panadol Cold & Flu', price: { min: 120, max: 250 } },
      { name: 'Actifed', price: { min: 180, max: 350 } },
      { name: 'Sinopharm', price: { min: 150, max: 300 } },
      
      // First Aid
      { name: 'Dettol Antiseptic', price: { min: 100, max: 200 } },
      { name: 'Band-Aid Pack', price: { min: 50, max: 150 } },
      { name: 'Pyodine Solution', price: { min: 80, max: 180 } },
      
      // Vitamins
      { name: 'Centrum Silver', price: { min: 800, max: 1500 } },
      { name: 'Calpol 6 Plus', price: { min: 150, max: 300 } },
      { name: 'Vitamin D3', price: { min: 400, max: 800 } }
    ];

    // Grocery Products with categories
    const groceryProducts = [
      // Cooking Essentials
      { name: 'Dalda Cooking Oil 5L', price: { min: 1500, max: 2000 } },
      { name: 'National Iodized Salt 800g', price: { min: 50, max: 100 } },
      { name: 'Rafhan Corn Oil 3L', price: { min: 1200, max: 1800 } },
      { name: 'Eva Banaspati 5kg', price: { min: 1800, max: 2500 } },
      
      // Tea & Beverages
      { name: 'Tapal Danedar 190g', price: { min: 250, max: 400 } },
      { name: 'Lipton Yellow Label 190g', price: { min: 250, max: 400 } },
      { name: 'Vital Tea 170g', price: { min: 200, max: 350 } },
      { name: 'Shezan Mango Juice 1L', price: { min: 150, max: 250 } },
      
      // Dairy & Beverages
      { name: 'Nestle Milk Pack 1L', price: { min: 180, max: 250 } },
      { name: 'Olpers Milk 1L', price: { min: 180, max: 250 } },
      { name: 'Dairy Umang Lassi 500ml', price: { min: 100, max: 150 } },
      
      // Spices & Condiments
      { name: 'National Chilli Powder 200g', price: { min: 200, max: 350 } },
      { name: 'Shan Biryani Masala', price: { min: 100, max: 180 } },
      { name: 'National Garam Masala', price: { min: 150, max: 250 } },
      
      // Personal Care
      { name: 'Safeguard Soap', price: { min: 80, max: 150 } },
      { name: 'Lux Soap Pack of 3', price: { min: 180, max: 300 } },
      { name: 'Sunsilk Shampoo 200ml', price: { min: 250, max: 400 } },
      
      // Cleaning Products
      { name: 'Surf Excel 1kg', price: { min: 350, max: 500 } },
      { name: 'Harpic 500ml', price: { min: 200, max: 300 } },
      { name: 'Max Clean Surface Cleaner', price: { min: 150, max: 250 } }
    ];

    // Insert Products
    for (const product of [...pharmacyProducts, ...groceryProducts]) {
      const isPharmacy = pharmacyProducts.includes(product);
      const price = faker.number.int(product.price);

      await pool.execute(`
        INSERT INTO products (name, description, category_id, price, stock_quantity, unit, barcode, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.name,
        faker.commerce.productDescription(),
        isPharmacy ? 1 : 2,
        price,
        faker.number.int({ min: 20, max: 200 }),
        isPharmacy ? 'Pack' : 'Item',
        faker.string.numeric(13),
        true
      ]);
    }

    // Generate more transactions (50 instead of 20)
    for (let i = 0; i < 50; i++) {
      const transactionDate = faker.date.between({
        from: '2024-01-01',
        to: new Date()
      });

      // Create POS Transaction
      const [result] = await pool.execute(`
        INSERT INTO pos_transactions (transaction_date, total_amount, payment_method, cashier_id)
        VALUES (?, ?, ?, ?)
      `, [
        transactionDate,
        faker.number.int({ min: 500, max: 15000 }),
        faker.helpers.arrayElement(['Cash', 'Card', 'EasyPaisa', 'JazzCash', 'Bank Transfer']),
        faker.number.int({ min: 1, max: 5 })
      ]);

      const transactionId = result.insertId;

      // Add more Transaction Items (1-8 items per transaction)
      const itemCount = faker.number.int({ min: 1, max: 8 });
      for (let j = 0; j < itemCount; j++) {
        await pool.execute(`
          INSERT INTO pos_transaction_items (pos_transaction_id, product_id, quantity, unit_price)
          VALUES (?, ?, ?, ?)
        `, [
          transactionId,
          faker.number.int({ min: 1, max: pharmacyProducts.length + groceryProducts.length }),
          faker.number.int({ min: 1, max: 10 }),
          faker.number.int({ min: 50, max: 2000 })
        ]);
      }

      // Generate Inventory Transactions
      await pool.execute(`
        INSERT INTO inventory_transactions (product_id, quantity_change, transaction_type, reference_id, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `, [
        faker.number.int({ min: 1, max: pharmacyProducts.length + groceryProducts.length }),
        faker.number.int({ min: -20, max: 50 }),
        faker.helpers.arrayElement(['Purchase', 'Sale', 'Return', 'Adjustment', 'Damaged', 'Expired']),
        transactionId,
        transactionDate
      ]);
    }

    // Generate Cash Drawer Logs (more entries, 30 instead of 10)
    for (let i = 0; i < 30; i++) {
      const openTime = faker.date.between({
        from: '2024-01-01',
        to: new Date()
      });
      const closeTime = new Date(openTime.getTime() + faker.number.int({ min: 4, max: 12 }) * 60 * 60 * 1000);
      
      await pool.execute(`
        INSERT INTO cash_drawer_logs (cashier_id, open_time, close_time, starting_cash, ending_cash)
        VALUES (?, ?, ?, ?, ?)
      `, [
        faker.number.int({ min: 1, max: 5 }),
        openTime,
        closeTime,
        faker.number.int({ min: 10000, max: 20000 }), // Starting cash between 10000-20000 PKR
        faker.number.int({ min: 25000, max: 100000 }) // Ending cash between 25000-100000 PKR
      ]);
    }

    console.log('Fake data generated successfully!');
  } catch (error) {
    console.error('Error generating fake data:', error);
  } finally {
    process.exit(0);
  }
}

generateFakeData();