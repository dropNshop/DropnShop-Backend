const express = require('express');
const router = express.Router();
const authMiddleware = require('../Middleware/authMiddleware');
const adminMiddleware = require('../Middleware/adminMiddleware');

// Import controllers
const { register } = require('../Controllers/Registration/User/register.controller');
const { login } = require('../Controllers/Registration/User/login.controller');
const { getOwnProfile } = require('../Controllers/Registration/User/profile.controller');
const { getSalesReport } = require('../Controllers/Admin/reports.controller');
const { getAllProducts, addProduct,updateProduct,deleteProduct } = require('../Controllers/Products/products.controller');
const { placeOrder, getUserOrders, getAllOrders, getOrderDetails,updateOrderStatus } = require('../Controllers/Orders/orders.controller');
const { 
    addCategory, 
    deleteCategory,
    getAllCategories, 
    getProductsByCategory,
    updateCategory
} = require('../Controllers/Categories/categories.controller');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getOwnProfile);

// Product routes
router.get('/products', getAllProducts);
router.post('/admin/products', authMiddleware, addProduct);

// Admin Product Routes
router.post('/products', authMiddleware, addProduct);
router.put('/products/:productId', authMiddleware, updateProduct);
router.delete('/products/:productId', authMiddleware, deleteProduct);

// Order routes
router.post('/orders', authMiddleware, placeOrder);
router.get('/orders', authMiddleware, getUserOrders);
router.get('/orders/:orderId', authMiddleware, getOrderDetails);
router.get('/admin/orders', authMiddleware, getAllOrders);

router.get('/admin/report', authMiddleware, getSalesReport);

// Admin Order Routes
router.put('/orders/:orderId/status', authMiddleware, updateOrderStatus);

// Category routes
// Add this route with your existing category routes
// Add this route with your existing category routes
router.put('/admin/categories/:categoryId', authMiddleware, updateCategory);
router.delete('/admin/categories/:categoryId', authMiddleware, deleteCategory);
router.post('/admin/categories', authMiddleware, addCategory);
router.get('/categories', getAllCategories);
router.get('/categories/:categoryName/products', getProductsByCategory);
module.exports = router; 