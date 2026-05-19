import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import ProductVariant from '../src/models/product_variant.model.js';
import connectDB from '../src/config/db.config.js';

const CONFIG = {
  DEFAULT_CATEGORIES: 20,
  DEFAULT_PRODUCTS: 100,
  DEFAULT_VARIANTS: 3,
  MAX_CATEGORIES: 100,
  MAX_PRODUCTS: 500,
  MAX_VARIANTS: 10
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { categories: CONFIG.DEFAULT_CATEGORIES, products: CONFIG.DEFAULT_PRODUCTS, variants: CONFIG.DEFAULT_VARIANTS, only: 'all', keep: false, dryRun: false, verbose: false, categoryId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--categories' && args[i + 1]) options.categories = parseInt(args[++i]);
    else if (args[i] === '--products' && args[i + 1]) options.products = parseInt(args[++i]);
    else if (args[i] === '--variants' && args[i + 1]) options.variants = parseInt(args[++i]);
    else if (args[i] === '--only' && args[i + 1]) options.only = args[++i];
    else if (args[i] === '--keep') options.keep = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--verbose') options.verbose = true;
    else if (args[i] === '--category' && args[i + 1]) options.categoryId = args[++i];
  }
  if (options.categories > CONFIG.MAX_CATEGORIES) options.categories = CONFIG.MAX_CATEGORIES;
  if (options.products > CONFIG.MAX_PRODUCTS) options.products = CONFIG.MAX_PRODUCTS;
  if (options.variants > CONFIG.MAX_VARIANTS) options.variants = CONFIG.MAX_VARIANTS;
  return options;
};

const generateSlug = (name) => {
  return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

const createUniqueSlug = async (Model, name) => {
  let slug = generateSlug(name);
  let counter = 1;
  while (await Model.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }
  return slug;
};

const generateSKU = (prefix) => {
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
};

const generateBarcode = () => Math.random().toString().substring(2, 13);

const generateCategories = async (options) => {
  const { categories, keep, dryRun, verbose } = options;
  const sampleCategories = [
    { name: 'Cà phê', description: 'Các loại cà phê' },
    { name: 'Trà', description: 'Các loại trà' },
    { name: 'Sinh tố', description: 'Sinh tố trái cây' },
    { name: 'Nước ép', description: 'Nước ép trái cây' },
    { name: 'Bánh mì', description: 'Bánh mì Việt Nam' },
    { name: 'Bánh ngọt', description: 'Các loại bánh ngọt' },
    { name: 'Đồ ăn nhanh', description: 'Burger, pizza, gà rán' }
  ];
  
  if (!keep && !dryRun) {
    await Category.deleteMany({});
    console.log('🗑️ Đã xóa categories cũ');
  }
  
  const createdCategories = [];
  for (let i = 0; i < Math.min(categories, sampleCategories.length); i++) {
    const sample = sampleCategories[i];
    const slug = await createUniqueSlug(Category, sample.name);
    const categoryData = {
      name: sample.name,
      slug,
      description: sample.description,
      parentId: null,
      sortOrder: i,
      isActive: true
    };
    
    if (!dryRun) {
      try {
        const category = await Category.create(categoryData);
        createdCategories.push(category);
        if (verbose) console.log(`✅ ${sample.name}`);
      } catch (error) {
        console.error(`❌ ${sample.name}:`, error.message);
      }
    } else {
      createdCategories.push({ ...categoryData, _id: `temp_${i}` });
      if (verbose) console.log(`📋 ${sample.name}`);
    }
  }
  
  return createdCategories;
};

const generateProductsWithVariants = async (options, categories) => {
  const { products, variants, keep, dryRun, verbose, categoryId } = options;
  const productTemplates = {
    'Cà phê': [
      { name: 'Cà phê đen đá', brand: 'Highlands Coffee', description: 'Cà phê đen đậm đà', price: 25000 },
      { name: 'Cà phê sữa đá', brand: 'Highlands Coffee', description: 'Cà phê sữa ngọt dịu', price: 30000 },
      { name: 'Cà phê muối', brand: 'Highlands Coffee', description: 'Cà phê muối đặc trưng', price: 35000 }
    ],
    'Trà': [
      { name: 'Trà đào cam sả', brand: 'Trà Nguyễn', description: 'Trà đào thơm mát', price: 35000 },
      { name: 'Trà táo quế', brand: 'Trà Nguyễn', description: 'Trà táo ấm áp', price: 30000 },
      { name: 'Trà gừng mật ong', brand: 'Trà Nguyễn', description: 'Trà gừng ấm nóng', price: 32000 }
    ],
    'Sinh tố': [
      { name: 'Sinh tố xoài', brand: 'The Coffee House', description: 'Sinh tố xoài ngọt', price: 45000 },
      { name: 'Sinh tố dứa', brand: 'The Coffee House', description: 'Sinh tố dứa chua ngọt', price: 40000 },
      { name: 'Sinh tố chuối', brand: 'The Coffee House', description: 'Sinh tố chuối béo', price: 38000 }
    ]
  };
  
  if (!keep && !dryRun) {
    if (categoryId) {
      await Product.deleteMany({ categoryId });
      await ProductVariant.deleteMany({ categoryId });
    } else {
      await Product.deleteMany({});
      await ProductVariant.deleteMany({});
    }
    console.log('🗑️ Đã xóa products và variants cũ');
  }
  
  const categoryArray = categoryId ? categories.filter(c => c._id.toString() === categoryId) : categories;
  const createdProducts = [];
  const createdVariants = [];
  
  for (const category of categoryArray) {
    if (createdProducts.length >= products) break;
    const templates = productTemplates[category.name] || [];
    const remaining = products - createdProducts.length;
    const currentCount = Math.min(templates.length || 3, remaining);
    
    for (let i = 0; i < currentCount; i++) {
      const template = templates[i] || { name: `Sản phẩm ${category.name} ${i}`, brand: 'Generic', description: 'Mô tả', price: 30000 };
      const productData = {
        name: template.name,
        slug: await createUniqueSlug(Product, template.name),
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
          createdProducts.push(product);
          
          const variant = await ProductVariant.create({
            productId: product._id,
            sku: generateSKU(category.name.substring(0, 3).toUpperCase()),
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
          createdVariants.push(variant);
          if (verbose) console.log(`✅ ${productData.name}`);
        } catch (error) {
          console.error(`❌ ${productData.name}:`, error.message);
        }
      } else {
        createdProducts.push({ ...productData, _id: `temp_${createdProducts.length}` });
        createdVariants.push({ _id: `temp_variant_${createdVariants.length}` });
        if (verbose) console.log(`📋 ${productData.name}`);
      }
    }
  }
  
  return { products: createdProducts, variants: createdVariants };
};

const main = async () => {
  try {
    const options = parseArgs();
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/seed-all.js [--categories N] [--products N] [--variants N] [--only type] [--keep] [--dry-run] [--verbose] [--category id]');
      return;
    }
    console.log(`🚀 Tạo dữ liệu...`);
    if (!options.dryRun) await connectDB();
    
    let categoryResults = [];
    let productResults = { products: [], variants: [] };
    
    if (options.only === 'categories' || options.only === 'all') {
      console.log('📂 Tạo categories...');
      categoryResults = await generateCategories(options);
    }
    
    if (options.only === 'products' || options.only === 'variants' || options.only === 'all') {
      console.log('📦 Tạo products và variants...');
      productResults = await generateProductsWithVariants(options, categoryResults);
    }
    
    console.log(`${options.dryRun ? '📋 DRY RUN' : '🎉'} Hoàn thành!`);
    console.log(`   - Categories: ${categoryResults.length}`);
    console.log(`   - Products: ${productResults.products.length}`);
    console.log(`   - Variants: ${productResults.variants.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
export { generateCategories, generateProductsWithVariants, parseArgs };