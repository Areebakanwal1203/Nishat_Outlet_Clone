const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    price:       { type: Number, required: true },
    category:    { type: String, required: true },
    rating:      { type: Number, min: 1, max: 5, default: 4 },
    stock:       { type: Number, default: 0 },
    description: { type: String, default: '' },
    image:       { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);