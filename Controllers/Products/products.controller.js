const { pool } = require('../../Configs/db.config');
const { uploadImageToFirebase } = require('../../Utils/uploadImage');

// Get all products (public)
const getAllProducts = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const [products] = await connection.execute('SELECT * FROM products WHERE is_active = true');
        
        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// Add product (admin only)
const addProduct = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { 
            name, 
            description, 
            category_id, 
            price, 
            stock_quantity, 
            unit, 
            barcode,
            image_base64
        } = req.body;

        // Validate required fields
        if (!name || !category_id || !price || !stock_quantity) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Name, category, price, and stock quantity are required'
            });
        }

        let imageUrl = null;
        // Upload image if provided
        if (image_base64) {
            try {
                // Validate image size (checking base64 length)
                const base64Size = Buffer.from(image_base64, 'base64').length;
                if (base64Size > 5 * 1024 * 1024) { // 5MB limit
                    return res.status(400).json({
                        success: false,
                        message: 'Image size should not exceed 5MB'
                    });
                }

                // Extract content type from base64 string
                const contentType = image_base64.match(/^data:([^;]+);base64,/)?.[1];
                if (!contentType || !['image/jpeg', 'image/png', 'image/jpg'].includes(contentType)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid image format. Only JPEG and PNG are supported'
                    });
                }
                
                imageUrl = await uploadImageToFirebase(image_base64, contentType);
                
                // Validate URL length for database
                if (imageUrl && imageUrl.length > 500) { // Assuming VARCHAR(500) in database
                    throw new Error('Generated image URL is too long for database');
                }
            } catch (error) {
                console.error('Error processing image:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing image',
                    error: error.message
                });
            }
        }

        // Insert product with image URL
        const [result] = await connection.execute(
            `INSERT INTO products (
                name, 
                description, 
                category_id, 
                price, 
                stock_quantity, 
                unit, 
                barcode, 
                image_url,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)`,
            [
                name, 
                description || null, 
                category_id, 
                price, 
                stock_quantity, 
                unit || null, 
                barcode || null, 
                imageUrl
            ]
        );

        // Get the inserted product
        const [newProduct] = await connection.execute(
            'SELECT * FROM products WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            data: newProduct[0]
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error adding product',
            error: error.message 
        });
    } finally {
        connection.release();
    }
};

const updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { 
            name, 
            description, 
            category_id, 
            price, 
            stock_quantity, 
            unit, 
            barcode,
            image_base64
        } = req.body;

        // Check if product exists
        const [existingProduct] = await pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if (existingProduct.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Prepare update fields
        let imageUrl = existingProduct[0].image_url;
        
        // Upload new image if provided
        if (image_base64) {
            try {
                // Validate image size
                const base64Size = Buffer.from(image_base64, 'base64').length;
                if (base64Size > 5 * 1024 * 1024) { // 5MB limit
                    return res.status(400).json({
                        success: false,
                        message: 'Image size should not exceed 5MB'
                    });
                }

                // Extract and validate content type
                const contentType = image_base64.match(/^data:([^;]+);base64,/)?.[1];
                if (!contentType || !['image/jpeg', 'image/png', 'image/jpg'].includes(contentType)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid image format. Only JPEG and PNG are supported'
                    });
                }
                
                imageUrl = await uploadImageToFirebase(image_base64, contentType);
                
                // Validate URL length for database
                if (imageUrl && imageUrl.length > 500) {
                    throw new Error('Generated image URL is too long for database');
                }
            } catch (error) {
                console.error('Error processing image:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing image',
                    error: error.message
                });
            }
        }

        // Build dynamic update query
        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (category_id) {
            updates.push('category_id = ?');
            values.push(category_id);
        }
        if (price) {
            updates.push('price = ?');
            values.push(price);
        }
        if (stock_quantity !== undefined) {
            updates.push('stock_quantity = ?');
            values.push(stock_quantity);
        }
        if (unit !== undefined) {
            updates.push('unit = ?');
            values.push(unit);
        }
        if (barcode !== undefined) {
            updates.push('barcode = ?');
            values.push(barcode);
        }
        if (imageUrl !== existingProduct[0].image_url) {
            updates.push('image_url = ?');
            values.push(imageUrl);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // Add productId to values array
        values.push(productId);

        // Execute update query
        await pool.execute(
            `UPDATE products 
             SET ${updates.join(', ')} 
             WHERE id = ?`,
            values
        );

        // Get updated product
        const [updatedProduct] = await pool.execute(
            `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ?`,
            [productId]
        );

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: updatedProduct[0]
        });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
};

// Delete product (admin only)
const deleteProduct = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { productId } = req.params;

        // Check if product exists
        const [product] = await connection.execute(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if (product.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Check if product is in any active orders
        const [activeOrders] = await connection.execute(
            `SELECT o.* FROM orders o 
             JOIN order_items oi ON o.id = oi.order_id 
             WHERE oi.product_id = ? AND o.status IN ('pending', 'processing')`,
            [productId]
        );

        if (activeOrders.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Cannot delete product with active orders'
            });
        }

        // Soft delete the product
        await connection.execute(
            'UPDATE products SET is_active = false WHERE id = ?',
            [productId]
        );

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct
}; 