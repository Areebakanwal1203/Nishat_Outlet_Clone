require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const flash      = require('connect-flash');

const Product    = require('./models/Product');
const User       = require('./models/User');
const { isLoggedIn, isAdmin } = require('./middleware/auth');
const apiRoutes  = require('./routes/api');

// ── NEW: Sales controller ────────────────────────────────────────────
const { salesPage, salesData } = require('./controllers/salesController');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const MONGO_URI = 'mongodb://localhost:27017/TA3_nishat';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected → TA3_nishat'))
    .catch(err => console.error(err));

// Sessions
app.use(session({
    secret: 'nishat_secret_key_2025',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Flash
app.use(flash());

// Make currentUser & flash available in all views
app.use((req, res, next) => {
    res.locals.success     = req.flash('success');
    res.locals.error       = req.flash('error');
    res.locals.currentUser = req.session.userId
        ? { id: req.session.userId, name: req.session.userName, role: req.session.role }
        : null;
    next();
});

// Multer
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase())
                && allowed.test(file.mimetype);
        ok ? cb(null, true) : cb(new Error('Images only!'));
    }
});

// ── API ROUTES ───────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// ── SALES DASHBOARD ROUTES (NEW) ─────────────────────────────────────
// GET /sales         → SSR dashboard page (admin-protected)
// GET /api/sales-data → JSON polling endpoint (admin-protected)
app.get('/sales',          isAdmin, salesPage);
app.get('/api/sales-data', isAdmin, salesData);

// ── AUTH ROUTES ──────────────────────────────────────────────────────

app.get('/auth/register', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('auth/register');
});

app.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        if (!name || !email || !password) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/auth/register');
        }
        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters.');
            return res.redirect('/auth/register');
        }
        if (password !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/auth/register');
        }
        const existing = await User.findOne({ email });
        if (existing) {
            req.flash('error', 'An account with that email already exists.');
            return res.redirect('/auth/register');
        }
        await User.create({ name, email, password, role: 'customer' });
        req.flash('success', 'Account created successfully. Please login now.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/auth/register');
    }
});

app.get('/auth/login', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('auth/login');
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            req.flash('error', 'Email and password are required.');
            return res.redirect('/auth/login');
        }
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/auth/login');
        }
        req.session.userId   = user._id;
        req.session.userName = user.name;
        req.session.role     = user.role;
        req.flash('success', `Welcome back, ${user.name}!`);
        if (user.role === 'admin') return res.redirect('/admin');
        res.redirect('/');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/auth/login');
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// ── PUBLIC ROUTES ────────────────────────────────────────────────────

app.get('/', (req, res) => res.render('index'));

app.get('/checkout', isLoggedIn, (req, res) => res.render('checkout'));

app.get('/products', async (req, res) => {
    try {
        const LIMIT    = 8;
        const page     = parseInt(req.query.page)       || 1;
        const search   = req.query.search               || '';
        const category = req.query.category             || '';
        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = parseFloat(req.query.maxPrice) || 999999;
        const sort     = req.query.sort                 || 'default';
        const rating   = parseFloat(req.query.rating)   || 0;

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
        const products      = await Product.find(filter)
            .sort(sortOptions[sort] || {})
            .skip((page - 1) * LIMIT)
            .limit(LIMIT);
        const categories    = await Product.distinct('category');

        res.render('products', {
            products, currentPage: page, totalPages, totalProducts,
            search, category,
            minPrice: req.query.minPrice || '',
            maxPrice: req.query.maxPrice || '',
            sort, rating, categories,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// ── ADMIN ROUTES ─────────────────────────────────────────────────────

app.get('/admin', isAdmin, async (req, res) => {
    try {
        const products   = await Product.find().sort({ createdAt: -1 });
        const totalStock = products.reduce((s, p) => s + p.stock, 0);
        const categories = await Product.distinct('category');
        res.render('admin/dashboard', { products, totalStock, categories });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.get('/admin/products/new', isAdmin, (req, res) => {
    res.render('admin/new', { error: null });
});

app.post('/admin/products', isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, price, category, rating, stock, description } = req.body;
        if (!name || !price || !category) {
            return res.render('admin/new', { error: 'Name, price and category are required.' });
        }
        const imagePath = req.file ? '/uploads/' + req.file.filename : req.body.imageUrl || '';
        await Product.create({ name, price, category, rating, stock, description, image: imagePath });
        req.flash('success', 'Product added successfully');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.render('admin/new', { error: 'Something went wrong. Try again.' });
    }
});

app.get('/admin/products/:id/edit', isAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.render('admin/edit', { product, error: null });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/admin/products/:id', isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { name, price, category, rating, stock, description } = req.body;
        if (!name || !price || !category) {
            const product = await Product.findById(req.params.id);
            return res.render('admin/edit', { product, error: 'Name, price and category are required.' });
        }
        const update = { name, price, category, rating, stock, description };
        if (req.file)               update.image = '/uploads/' + req.file.filename;
        else if (req.body.imageUrl) update.image = req.body.imageUrl;
        await Product.findByIdAndUpdate(req.params.id, update);
        req.flash('success', 'Product updated successfully');
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.post('/admin/products/:id/delete', isAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        req.flash('success', 'Product deleted successfully');
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Server error');
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
