const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../../Configs/db.config');

const register = async (req, res) => {
    const { 
        email, 
        username, 
        password,
        phone_number = null,
        address = null
    } = req.body;

    if (!email || !username || !password) {
        return res.status(400).json({ 
            success: false,
            error: 'Email, username, and password are required' 
        });
    }

    try {
        // Check if user exists
        const [userCheck] = await pool.execute(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (userCheck.length > 0) {
            return res.status(409).json({ 
                success: false,
                error: 'User with this email or username already exists' 
            });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const [result] = await pool.execute(
            `INSERT INTO users (
                username, 
                email, 
                password_hash,
                phone_number,
                address,
                is_active
            ) VALUES (?, ?, ?, ?, ?, true)`,
            [
                username, 
                email, 
                passwordHash,
                phone_number,
                address
            ]
        );

        const userId = result.insertId;

        const token = jwt.sign(
            { 
                id: userId, 
                email,
                username
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({ 
            success: true,
            message: 'User registered successfully', 
            data: {
                userId,
                email,
                username,
                phone_number,
                address
            },
            token 
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'An error occurred during registration',
            details: err.message
        });
    }
};

module.exports = {
    register
};
