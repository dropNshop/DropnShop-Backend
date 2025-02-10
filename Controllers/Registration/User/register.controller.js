const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('../../../Configs/db.config');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, isRegistration = true) => {
    const subject = isRegistration ? 'Email Verification OTP' : 'Password Reset OTP';
    const html = `
        <h1>${isRegistration ? 'Welcome to Our Platform!' : 'Password Reset Request'}</h1>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
    `;

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html
    });
};

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

    let connection;
    try {
        connection = await pool.getConnection();

        // Check if user exists
        const [userCheck] = await connection.execute(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (userCheck.length > 0) {
            return res.status(409).json({ 
                success: false,
                error: 'User with this email or username already exists' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Insert new user with OTP
        const [result] = await connection.execute(
            `INSERT INTO users (
                username, 
                email, 
                password_hash,
                phone_number,
                address,
                is_active,
                otp,
                otp_expiry,
                email_verified,
                last_otp_sent
            ) VALUES (?, ?, ?, ?, ?, false, ?, ?, false, NOW())`,
            [username, email, passwordHash, phone_number, address, otp, otpExpiry]
        );

        // Send OTP email
        await sendOTPEmail(email, otp);

        res.status(201).json({ 
            success: true,
            message: 'Registration initiated. Please verify your email with the OTP sent.',
            data: { userId: result.insertId, email, username }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'An error occurred during registration',
            details: err.message
        });
    } finally {
        if (connection) connection.release();
    }
};

// Verify OTP endpoint
const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        
        const [user] = await connection.execute(
            'SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expiry > NOW()',
            [email, otp]
        );

        if (user.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired OTP'
            });
        }

        // Update user verification status
        await connection.execute(
            `UPDATE users 
             SET email_verified = true, 
                 is_active = true,
                 otp = NULL, 
                 otp_expiry = NULL 
             WHERE email = ?`,
            [email]
        );

        const token = jwt.sign(
            { id: user[0].id, email, username: user[0].username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'Email verified successfully',
            token
        });
    } catch (err) {
        console.error('OTP verification error:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred during verification'
        });
    } finally {
        if (connection) connection.release();
    }
};

// Forgot password - send OTP
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        
        const [user] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (user.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await connection.execute(
            `UPDATE users 
             SET otp = ?, 
                 otp_expiry = ?,
                 last_otp_sent = NOW() 
             WHERE email = ?`,
            [otp, otpExpiry, email]
        );

        await sendOTPEmail(email, otp, false);

        res.json({
            success: true,
            message: 'Password reset OTP sent to your email'
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while processing your request'
        });
    } finally {
        if (connection) connection.release();
    }
};

// Reset password with OTP
const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    let connection;

    try {
        connection = await pool.getConnection();
        
        const [user] = await connection.execute(
            'SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expiry > NOW()',
            [email, otp]
        );


        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await connection.execute(
            `UPDATE users 
             SET password_hash = ?,
                 otp = NULL,
                 otp_expiry = NULL 
             WHERE email = ?`,
            [passwordHash, email]
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({
            success: false,
            error: 'An error occurred while resetting password'
        });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { 
    register,
    verifyOTP,
    forgotPassword,
    resetPassword
};
