const express = require('express');
const router = express.Router();
const { getAllProducts } = require('../Controllers/Products/products.controller');

router.get('/products', getAllProducts);

module.exports = router;
