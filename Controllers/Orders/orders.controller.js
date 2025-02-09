const { pool } = require('../../Configs/db.config');

// Place new order (user)
const placeOrder = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { items, delivery_address } = req.body;
        const user_id = req.user.id;

        if (!items || !Array.isArray(items) || items.length === 0) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Order must contain at least one item'
            });
        }

        // Start transaction
        await connection.beginTransaction();

        try {
            // 1. Create the order
            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    user_id, 
                    order_date, 
                    total_amount,
                    status,
                    delivery_address,
                    is_online_order
                ) VALUES (?, NOW(), 0, 'pending', ?, true)`,
                [user_id, delivery_address]
            );

            const orderId = orderResult.insertId;
            let totalAmount = 0;

            // 2. Process each item
            for (const item of items) {
                // Check stock
                const [stockResult] = await connection.execute(
                    'SELECT price, stock_quantity FROM products WHERE id = ? AND is_active = true',
                    [item.product_id]
                );

                if (stockResult.length === 0) {
                    throw new Error(`Product ${item.product_id} not found or inactive`);
                }

                const product = stockResult[0];
                if (product.stock_quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.product_id}`);
                }

                // Add order item
                await connection.execute(
                    `INSERT INTO order_items (
                        order_id, 
                        product_id, 
                        quantity, 
                        unit_price
                    ) VALUES (?, ?, ?, ?)`,
                    [orderId, item.product_id, item.quantity, product.price]
                );

                // Update stock
                await connection.execute(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [item.quantity, item.product_id]
                );

                totalAmount += product.price * item.quantity;
            }

            // 3. Update order total
            await connection.execute(
                'UPDATE orders SET total_amount = ? WHERE id = ?',
                [totalAmount, orderId]
            );

            // 4. Get complete order details
            const [orderDetails] = await connection.execute(
                `SELECT 
                    o.*, u.username, u.email 
                 FROM orders o
                 JOIN users u ON o.user_id = u.id
                 WHERE o.id = ?`,
                [orderId]
            );

            const [orderItems] = await connection.execute(
                `SELECT 
                    oi.*, p.name as product_name, p.description
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [orderId]
            );

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Order placed successfully',
                data: {
                    ...orderDetails[0],
                    items: orderItems
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// Get user's orders (user)
const getUserOrders = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        // First get orders
        const [orders] = await connection.execute(
            `SELECT 
                o.id, o.order_date, o.total_amount, o.status,
                o.delivery_address, o.is_online_order
             FROM orders o 
             WHERE o.user_id = ?
             ORDER BY o.order_date DESC`,
            [req.user.id]
        );

        // Then get items for each order
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await connection.execute(
                `SELECT 
                    oi.product_id, oi.quantity, oi.unit_price,
                    p.name as product_name, p.description,
                    (oi.quantity * oi.unit_price) as item_total
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            
            return {
                ...order,
                items
            };
        }));

        res.status(200).json({
            success: true,
            count: orders.length,
            data: ordersWithItems
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// Get all orders (admin)
const getAllOrders = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        // First get all orders with user info
        const [orders] = await connection.execute(
            `SELECT 
                o.id, o.order_date, o.total_amount, o.status,
                o.delivery_address, o.is_online_order,
                u.username, u.email, u.phone_number
             FROM orders o 
             JOIN users u ON o.user_id = u.id
             ORDER BY o.order_date DESC`
        );

        // Then get items for each order
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await connection.execute(
                `SELECT 
                    oi.product_id, oi.quantity, oi.unit_price,
                    p.name as product_name, p.description,
                    (oi.quantity * oi.unit_price) as item_total
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            
            return {
                ...order,
                items
            };
        }));

        res.status(200).json({
            success: true,
            count: orders.length,
            data: ordersWithItems
        });
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// Get order details (admin/user)
const getOrderDetails = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { orderId } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [order] = await connection.execute(
            `SELECT o.*, oi.*, p.name as product_name 
             FROM orders o 
             JOIN order_items oi ON o.id = oi.order_id 
             JOIN products p ON oi.product_id = p.id 
             WHERE o.id = ? ${!isAdmin ? 'AND o.user_id = ?' : ''}`,
            isAdmin ? [orderId] : [orderId, userId]
        );

        if (!order.length) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// Update order status (admin only)
const updateOrderStatus = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { orderId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        // Check if order exists
        const [order] = await connection.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );

        if (order.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Handle cancellation logic
        if (status === 'cancelled' && order[0].status !== 'cancelled') {
            // Restore product stock quantities
            const [orderItems] = await connection.execute(
                'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
                [orderId]
            );

            for (const item of orderItems) {
                await connection.execute(
                    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                    [item.quantity, item.product_id]
                );
            }
        }

        // Update order status
        await connection.execute(
            'UPDATE orders SET status = ? WHERE id = ?',
            [status, orderId]
        );

        // Get updated order details
        const [updatedOrder] = await connection.execute(
            `SELECT o.*, u.username, u.email 
             FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [orderId]
        );

        const [orderItems] = await connection.execute(
            `SELECT oi.*, p.name as product_name
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [orderId]
        );

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                ...updatedOrder[0],
                items: orderItems
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    placeOrder,
    getUserOrders,
    getAllOrders,
    getOrderDetails,
    updateOrderStatus
}; 