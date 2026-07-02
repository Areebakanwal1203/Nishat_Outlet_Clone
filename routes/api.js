const express     = require('express');
const jwt         = require('jsonwebtoken');
const router      = express.Router();

const Product     = require('../models/Product');
const User        = require('../models/User');
const Order       = require('../models/Order');
const verifyToken = require('../middleware/verifyToken');

// ── POST /api/v1/auth/login ──────────────────────────────────────────
// Returns a JWT token on successful login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { user_id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/products ─────────────────────────────────────────────
// Public: list all products with pagination & filtering
router.get('/products', async (req, res) => {
    try {
        const LIMIT    = parseInt(req.query.limit)    || 8;
        const page     = parseInt(req.query.page)     || 1;
        const search   = req.query.search             || '';
        const category = req.query.category           || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || 999999;
        const sort     = req.query.sort               || 'default';
        const rating   = parseFloat(req.query.rating) || 0;

        const filter = {};
        if (search)   filter.name     = { $regex: search, $options: 'i' };
        if (category) filter.category = category;
        if (minPrice || maxPrice < 999999) filter.price = { $gte: minPrice, $lte: maxPrice };
        if (rating)   filter.rating   = { $gte: rating };

        const sortOptions = {
            default:      {},
            'price-asc':  { price:  1 },
            'price-desc': { price: -1 },
            rating:       { rating: -1 },
            newest:       { _id:   -1 },
        };

        const totalProducts = await Product.countDocuments(filter);
        const totalPages    = Math.ceil(totalProducts / LIMIT);

        const products = await Product.find(filter)
            .sort(sortOptions[sort] || {})
            .skip((page - 1) * LIMIT)
            .limit(LIMIT);

        res.json({
            totalProducts,
            totalPages,
            currentPage: page,
            products
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/products/:id ─────────────────────────────────────────
// Public: single product details
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found.' });
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── GET /api/v1/user/profile ─────────────────────────────────────────
// Protected: returns logged-in user's profile
router.get('/user/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.user_id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ── POST /api/v1/orders ──────────────────────────────────────────────
// Protected: submit a new order
router.post('/orders', verifyToken, async (req, res) => {
    try {
        const { items } = req.body;
        // items = [{ product: "<id>", quantity: 2 }, ...]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order items are required.' });
        }

        // Calculate total from DB prices (never trust client-sent prices)
        let total = 0;
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) {
                return res.status(404).json({ error: `Product ${item.product} not found.` });
            }
            total += product.price * item.quantity;
        }

        const order = await Order.create({
            user:  req.user.user_id,
            items,
            total
        });

        res.status(201).json({ message: 'Order placed successfully.', order });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;