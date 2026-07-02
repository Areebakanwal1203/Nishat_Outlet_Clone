const Order   = require('../models/Order');
const Product = require('../models/Product');

/**
 * Fetch aggregated sales statistics from the database.
 * Returns: { totalRevenue, totalOrders, topProduct, recentOrders }
 */
async function getSalesStats() {
    // Total orders count
    const totalOrders = await Order.countDocuments();

    // Total revenue (sum of all order totals)
    const revenueAgg = await Order.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // Top-selling product by quantity ordered across all orders
    const topProductAgg = await Order.aggregate([
        { $unwind: '$items' },
        {
            $group: {
                _id:           '$items.product',
                totalQuantity: { $sum: '$items.quantity' }
            }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 1 },
        {
            $lookup: {
                from:         'products',
                localField:   '_id',
                foreignField: '_id',
                as:           'productInfo'
            }
        },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } }
    ]);

    const topProduct = topProductAgg.length > 0
        ? {
            name:          topProductAgg[0].productInfo?.name || 'Unknown',
            totalQuantity: topProductAgg[0].totalQuantity
          }
        : null;

    // Recent 5 orders for the dashboard table
    const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email')
        .populate('items.product', 'name');

    return { totalRevenue, totalOrders, topProduct, recentOrders };
}

// GET /sales — SSR dashboard page
async function salesPage(req, res) {
    try {
        const stats = await getSalesStats();
        res.render('sales', {
            layout:       'layouts/main',    // express-ejs-layouts layout
            title:        'Sales Dashboard',
            totalRevenue: stats.totalRevenue,
            totalOrders:  stats.totalOrders,
            topProduct:   stats.topProduct,
            recentOrders: stats.recentOrders
        });
    } catch (err) {
        console.error('salesPage error:', err);
        res.status(500).send('Server error');
    }
}

// GET /api/sales-data — JSON polling endpoint
async function salesData(req, res) {
    try {
        const stats = await getSalesStats();
        res.json({
            totalRevenue:  stats.totalRevenue,
            totalOrders:   stats.totalOrders,
            topProduct:    stats.topProduct
        });
    } catch (err) {
        console.error('salesData error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}

module.exports = { salesPage, salesData };
