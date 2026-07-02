const mongoose = require('mongoose');
const Product  = require('./models/Product');
const User     = require('./models/User'); // ✅ FIXED

mongoose.connect('mongodb://localhost:27017/TA3_nishat')
    .then(() => console.log('MongoDB connected for seeding'))
    .catch(err => console.error(err));

const seedProducts = [
  { name: 'Printed Lawn 3-Piece', price: 3500, category: 'Unstitched', rating: 4.5, stock: 30, description: 'Beautiful printed lawn 3-piece suit.', image: '/images/A1.png' },
  { name: 'Embroidered Chiffon 3-Piece', price: 8500, category: 'Unstitched', rating: 4.8, stock: 15, description: 'Luxury embroidered chiffon 3-piece.', image: '/images/A2.png' },
  { name: 'Digital Print 2-Piece', price: 2800, category: 'Unstitched', rating: 4.2, stock: 40, description: 'Trendy digital print 2-piece set.', image: '/images/A3.png' },
  { name: 'Summer Lawn 1-Piece', price: 1500, category: 'Unstitched', rating: 4.0, stock: 60, description: 'Light and breezy summer lawn.', image: '/images/A4.png' },
  { name: 'Luxury Embroidered Lawn', price: 5200, category: 'Unstitched', rating: 4.6, stock: 25, description: 'Luxury lawn with fine embroidery.', image: '/images/A5.png' },
  { name: 'Floral Printed Lawn Suit', price: 3100, category: 'Unstitched', rating: 4.3, stock: 35, description: 'Charming floral print lawn suit.', image: '/images/A7.png' },
  { name: 'Cotton Summer Collection', price: 2600, category: 'Unstitched', rating: 4.1, stock: 50, description: 'Comfortable cotton summer collection.', image: '/images/A8.png' },
  { name: 'Classic Embroidered Kurti', price: 4200, category: 'Ready to Wear', rating: 4.7, stock: 18, description: 'Classic embroidered kurti.', image: '/images/A9.png' },
  { name: 'Elegant Lawn Printed Suit', price: 3900, category: 'Unstitched', rating: 4.4, stock: 22, description: 'Elegant printed lawn 3-piece.', image: '/images/A10.png' },
  { name: 'Premium Chiffon Dupatta Set', price: 7800, category: 'Unstitched', rating: 4.9, stock: 12, description: 'Premium chiffon dupatta set.', image: '/images/Luxury.png' },
  { name: 'Printed Cotton 2-Piece', price: 2400, category: 'Unstitched', rating: 4.0, stock: 55, description: 'Casual printed cotton 2-piece.', image: '/images/loosefabric.png' },
  { name: 'Luxury Formal Wear', price: 9500, category: 'Luxury', rating: 4.8, stock: 10, description: 'Premium luxury formal wear.', image: '/images/A3.png' },
  { name: 'Casual Printed Kurta', price: 2800, category: 'Unstitched', rating: 4.2, stock: 40, description: 'Casual and stylish printed kurta.', image: '/images/A4.png' },
  { name: 'Winter Embroidered Shawl', price: 3300, category: 'Luxury', rating: 4.5, stock: 20, description: 'Warm winter shawl with embroidery.', image: '/images/A9.png' },
  { name: 'Modern Lawn 3-Piece Suit', price: 4600, category: 'Unstitched', rating: 4.6, stock: 28, description: 'Modern and vibrant lawn 3-piece.', image: '/images/A5.png' },
  { name: 'Men Cotton Kurta', price: 3000, category: 'Men', rating: 4.3, stock: 33, description: 'Comfortable men\'s cotton kurta.', image: '/images/A11.png' },
  { name: 'Elegant Unstitched Suit', price: 3900, category: 'Unstitched', rating: 4.4, stock: 22, description: 'Elegant lawn printed suit.', image: '/images/unstiched.png' },
];

const seedAdmin = async () => {
    const existing = await User.findOne({ email: "admin@nishat.com" });

    if (!existing) {
        await User.create({
            name: "Admin",
            email: "admin@nishat.com",
            password: "123admin",
            role: "admin"
        });
        console.log("Admin created");
    } else {
        console.log("Admin already exists");
    }
};

async function seedDB() {
    try {
        await Product.deleteMany({});
        console.log('Old products cleared');

        await Product.insertMany(seedProducts);
        console.log(`Seeded ${seedProducts.length} products`);

        await seedAdmin(); // ✅ FIXED placement

        mongoose.disconnect();
    } catch (err) {
        console.error(err);
        mongoose.disconnect();
    }
}

seedDB();