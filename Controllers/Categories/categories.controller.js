const { pool } = require('../../Configs/db.config');

// Add category (admin only)  lk
const addCategory = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { name, parent_category_id = null } = req.body;

        if (!name) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Check if category exists
        const [existingCategory] = await connection.execute(
            'SELECT * FROM categories WHERE name = ?',
            [name]
        );

        if (existingCategory.length > 0) {
            connection.release();
            return res.status(409).json({
                success: false,
                message: 'Category already exists'
            });
        }

        // If parent category specified, verify it exists
        if (parent_category_id) {
            const [parentCategory] = await connection.execute(
                'SELECT * FROM categories WHERE id = ?',
                [parent_category_id]
            );

            if (parentCategory.length === 0) {
                connection.release();
                return res.status(404).json({
                    success: false,
                    message: 'Parent category not found'
                });
            }
        }

        // Insert category
        const [result] = await connection.execute(
            'INSERT INTO categories (name, parent_category_id) VALUES (?, ?)',
            [name, parent_category_id]
        );

        res.status(201).json({
            success: true,
            message: 'Category added successfully',
            data: {
                id: result.insertId,
                name,
                parent_category_id
            }
        });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// Get all categories
const getAllCategories = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const [categories] = await connection.execute(`
            SELECT c.*, 
                   pc.name as parent_category_name,
                   COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN categories pc ON c.parent_category_id = pc.id
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.parent_category_id, pc.name
            ORDER BY COALESCE(c.parent_category_id, 0), c.name
        `);

        // Organize categories into hierarchy
        const categoriesWithHierarchy = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            parent_category_id: cat.parent_category_id,
            parent_category_name: cat.parent_category_name,
            product_count: cat.product_count,
            level: cat.parent_category_id ? 'sub' : 'main'
        }));

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categoriesWithHierarchy
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// Get products by category name
const getProductsByCategory = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const categoryName = req.params.categoryName.toLowerCase().trim();
        
        // First verify category exists (case insensitive search)
        const [category] = await connection.execute(
            'SELECT * FROM categories WHERE LOWER(name) = ?',
            [categoryName]
        );

        if (category.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Get products including subcategories
        const [products] = await connection.execute(`
            SELECT 
                p.*,
                c.name as category_name,
                COALESCE(
                    (SELECT name FROM categories WHERE id = c.parent_category_id),
                    c.name
                ) as main_category_name
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE (c.id = ? OR c.parent_category_id = ?)
                AND p.is_active = true
            ORDER BY p.name
        `, [category[0].id, category[0].id]);

        // Format the response
        const formattedProducts = products.map(product => ({
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            stock_quantity: product.stock_quantity,
            unit: product.unit,
            image_url: product.image_url,
            category: {
                id: product.category_id,
                name: product.category_name,
                main_category: product.main_category_name
            }
        }));

        res.status(200).json({
            success: true,
            category: {
                id: category[0].id,
                name: category[0].name
            },
            count: products.length,
            data: formattedProducts
        });
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// Delete category (admin only)
const deleteCategory = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { categoryId } = req.params;

        // Check if category exists
        const [category] = await connection.execute(
            'SELECT * FROM categories WHERE id = ?',
            [categoryId]
        );

        if (category.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if category has subcategories
        const [subcategories] = await connection.execute(
            'SELECT * FROM categories WHERE parent_category_id = ?',
            [categoryId]
        );

        if (subcategories.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with subcategories. Delete subcategories first.'
            });
        }

        // Check if category has products
        const [products] = await connection.execute(
            'SELECT * FROM products WHERE category_id = ?',
            [categoryId]
        );

        if (products.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Cannot delete category with associated products. Move or delete products first.'
            });
        }

        // Delete the category
        await connection.execute(
            'DELETE FROM categories WHERE id = ?',
            [categoryId]
        );

        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error deleting category:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// Update category (admin only)
const updateCategory = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        const { categoryId } = req.params;
        const { name, parent_category_id = null } = req.body;

        if (!name) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Check if category exists
        const [category] = await connection.execute(
            'SELECT * FROM categories WHERE id = ?',
            [categoryId]
        );

        if (category.length === 0) {
            connection.release();
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Check if new name already exists (excluding current category)
        const [existingCategory] = await connection.execute(
            'SELECT * FROM categories WHERE name = ? AND id != ?',
            [name, categoryId]
        );

        if (existingCategory.length > 0) {
            connection.release();
            return res.status(409).json({
                success: false,
                message: 'Category name already exists'
            });
        }

        // If parent category specified, verify it exists and is not self
        if (parent_category_id) {
            if (parent_category_id === parseInt(categoryId)) {
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: 'Category cannot be its own parent'
                });
            }

            const [parentCategory] = await connection.execute(
                'SELECT * FROM categories WHERE id = ?',
                [parent_category_id]
            );

            if (parentCategory.length === 0) {
                connection.release();
                return res.status(404).json({
                    success: false,
                    message: 'Parent category not found'
                });
            }
        }

        // Update category
        await connection.execute(
            'UPDATE categories SET name = ?, parent_category_id = ? WHERE id = ?',
            [name, parent_category_id, categoryId]
        );

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: {
                id: parseInt(categoryId),
                name,
                parent_category_id
            }
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

module.exports = {
    addCategory,
    getAllCategories,
    getProductsByCategory,
    deleteCategory,
    updateCategory
}; 
