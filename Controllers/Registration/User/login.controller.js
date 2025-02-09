// controllers/auth/login.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../../Configs/db.config');

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            success: false,
            error: 'Email and password are required' 
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE email = ? AND is_active = true',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        const user = users[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid email or password' 
            });
        }

        await connection.execute(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ 
            success: true,
            message: 'Login successful',
            data: {
                userId: user.id,
                email: user.email,
                username: user.username,
                phone_number: user.phone_number,
                address: user.address
            },
            token 
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'An error occurred during login',
            details: err.message
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { login };
