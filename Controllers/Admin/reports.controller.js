const pool = require('../../Configs/db.config');

const getSalesReport = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        const [sales] = await pool.execute(
            `SELECT 
                DATE(o.order_date) as date,
                COUNT(DISTINCT o.id) as total_orders,
                SUM(o.total_amount) as total_sales,
                COUNT(DISTINCT o.user_id) as unique_customers
             FROM orders o 
             WHERE o.order_date BETWEEN ? AND ?
             GROUP BY DATE(o.order_date)
             ORDER BY date DESC`,
            [start_date || '2024-01-01', end_date || new Date()]
        );

        const [topProducts] = await pool.execute(
            `SELECT 
                p.name,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.quantity * oi.unit_price) as total_revenue
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE o.order_date BETWEEN ? AND ?
             GROUP BY p.id
             ORDER BY total_revenue DESC
             LIMIT 10`,
            [start_date || '2024-01-01', end_date || new Date()]
        );

        res.status(200).json({
            success: true,
            data: {
                sales,
                topProducts
            }
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSalesReport
}; 