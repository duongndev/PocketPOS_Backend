import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import ProductVariant from '../src/models/product_variant.model.js';
import Category from '../src/models/category.model.js';
import connectDB from '../src/config/db.config.js';

const CONFIG = {
  DEFAULT_COUNT: 100,
  MAX_COUNT: 5000
};

const productTemplates = {
  'Cà phê': [
    { name: 'Cà phê đen đá', brand: 'Highlands Coffee', description: 'Cà phê đen đậm đà', price: 25000 },
    { name: 'Cà phê sữa đá', brand: 'Highlands Coffee', description: 'Cà phê sữa ngọt dịu', price: 30000 },
    { name: 'Cà phê muối', brand: 'Highlands Coffee', description: 'Cà phê muối đặc trưng', price: 35000 },
    { name: 'Cà phê latte', brand: 'Starbucks', description: 'Latte sữa béo', price: 55000 },
    { name: 'Cà phê americano', brand: 'Starbucks', description: 'Americano đậm vị', price: 45000 }
  ],
  'Trà': [
    { name: 'Trà đào cam sả', brand: 'Trà Nguyễn', description: 'Trà đào thơm mát', price: 35000 },
    { name: 'Trà táo quế', brand: 'Trà Nguyễn', description: 'Trà táo ấm áp', price: 30000 },
    { name: 'Trà gừng mật ong', brand: 'Trà Nguyễn', description: 'Trà gừng ấm nóng', price: 32000 },
    { name: 'Trà hoa cúc', brand: 'Trà Nguyễn', description: 'Trà hoa cúc thanh mát', price: 28000 },
    { name: 'Trà sen', brand: 'Trà Nguyễn', description: 'Trà sen thơm tinh tế', price: 40000 }
  ],
  'Sinh tố': [
    { name: 'Sinh tố xoài', brand: 'The Coffee House', description: 'Sinh tố xoài ngọt', price: 45000 },
    { name: 'Sinh tố dứa', brand: 'The Coffee House', description: 'Sinh tố dứa chua ngọt', price: 40000 },
    { name: 'Sinh tố chuối', brand: 'The Coffee House', description: 'Sinh tố chuối béo', price: 38000 },
    { name: 'Sinh tố bơ', brand: 'The Coffee House', description: 'Sinh tố bơ creamy', price: 50000 },
    { name: 'Sinh tố dâu tây', brand: 'The Coffee House', description: 'Sinh tố dâu tươi', price: 55000 }
  ]
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { count: CONFIG.DEFAULT_COUNT, keep: false, dryRun: false, verbose: false, categoryId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keep') options.keep = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--verbose') options.verbose = true;
    else if (args[i] === '--category' && args[i + 1]) options.categoryId = args[++i];
    else if (!isNaN(parseInt(args[i]))) options.count = parseInt(args[i]);
  }
  if (options.count > CONFIG.MAX_COUNT) options.count = CONFIG.MAX_COUNT;
  return options;
};

const generateSlug = (name) => {
  return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

const createUniqueSlug = async (name) => {
  let slug = generateSlug(name);
  let counter = 1;
  while (await Product.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }
  return slug;
};

const generateSKU = (name, category) => {
  const prefix = category.substring(0, 3).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
};

const generateBarcode = () => Math.random().toString().substring(2, 13);

const getCategories = async (specificCategoryId = null) => {
  if (specificCategoryId) return await Category.findById(specificCategoryId);
  return await Category.find({ isActive: true });
};

const generateProductsForCategory = async (category, count, options = {}) => {
  const { dryRun = false, verbose = false } = options;
  const products = [];
  const templates = productTemplates[category.name] || [];
  
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length] || { name: `Sản phẩm ${category.name} ${i}`, brand: 'Generic', description: 'Mô tả', price: 30000 };
    const productData = {
      name: template.name,
      slug: await createUniqueSlug(template.name),
      categoryId: category._id,
      brand: template.brand,
      description: template.description,
      images: `https://picsum.photos/seed/${template.name}/400/300.jpg`,
      hasVariants: false,
      options: [],
      tags: [category.name],
      isActive: true
    };
    
    if (!dryRun) {
      try {
        const product = await Product.create(productData);
        const variant = await ProductVariant.create({
          productId: product._id,
          sku: generateSKU(template.name, category.name),
          barcode: generateBarcode(),
          price: template.price,
          costPrice: Math.floor(template.price * 0.7),
          inventory: { quantity: Math.floor(Math.random() * 100) + 10, reserved: 0 },
          unit: 'cái',
          conversionRate: 1,
          attributes: [],
          images: productData.images,
          isDefault: true,
          lowStockThreshold: 5,
          isActive: true
        });
        products.push({ product, variant });
        if (verbose) console.log(`✅ ${productData.name}`);
      } catch (error) {
        console.error(`❌ ${productData.name}:`, error.message);
      }
    } else {
      products.push({ product: productData, variant: { sku: generateSKU(template.name, category.name) } });
      if (verbose) console.log(`📋 ${productData.name}`);
    }
  }
  return products;
};

const generateRandomProducts = async (options = {}) => {
  const { count = CONFIG.DEFAULT_COUNT, keep = false, dryRun = false, verbose = false, categoryId } = options;
  try {
    if (!keep && !dryRun) {
      if (categoryId) {
        await Product.deleteMany({ categoryId });
        await ProductVariant.deleteMany({ categoryId });
      } else {
        await Product.deleteMany({});
        await ProductVariant.deleteMany({});
      }
      console.log('🗑️ Đã xóa dữ liệu cũ');
    }
    const categories = await getCategories(categoryId);
    if (!categories || (Array.isArray(categories) && categories.length === 0)) {
      console.error('❌ Không tìm thấy category!');
      return;
    }
    const categoryArray = Array.isArray(categories) ? categories : [categories];
    const productsPerCategory = Math.ceil(count / categoryArray.length);
    const createdProducts = [];
    for (const category of categoryArray) {
      if (createdProducts.length >= count) break;
      const remaining = count - createdProducts.length;
      const currentCount = Math.min(productsPerCategory, remaining);
      const categoryProducts = await generateProductsForCategory(category, currentCount, { dryRun, verbose });
      createdProducts.push(...categoryProducts);
    }
    console.log(`${dryRun ? '📋 DRY RUN' : '🎉'} ${createdProducts.length} sản phẩm`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    throw error;
  }
};

const main = async () => {
  try {
    const options = parseArgs();
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/seed-products.js [count] [--keep] [--dry-run] [--verbose] [--category id]');
      return;
    }
    console.log(`🚀 Tạo ${options.count} sản phẩm...`);
    if (!options.dryRun) await connectDB();
    await generateRandomProducts(options);
    console.log('✨ Hoàn thành!');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
export { generateRandomProducts, getCategories, generateProductsForCategory, parseArgs };