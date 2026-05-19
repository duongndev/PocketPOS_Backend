import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import ProductVariant from '../src/models/product_variant.model.js';
import Category from '../src/models/category.model.js';
import connectDB from '../src/config/db.config.js';

const CONFIG = {
  DEFAULT_PRODUCTS: 50,
  DEFAULT_VARIANTS: 3,
  MAX_PRODUCTS: 500,
  MAX_VARIANTS: 10
};

const productTemplates = {
  'Cà phê': [
    { name: 'Cà phê hạt', variants: [
      { sku: 'CF-001', name: 'Cà phê Arabica 500g', price: 150000, attributes: [{ name: 'size', value: '500g' }] },
      { sku: 'CF-002', name: 'Cà phê Arabica 1kg', price: 280000, attributes: [{ name: 'size', value: '1kg' }] },
      { sku: 'CF-003', name: 'Cà phê Robusta 500g', price: 120000, attributes: [{ name: 'size', value: '500g' }] }
    ]}
  ],
  'Trà': [
    { name: 'Trà lá', variants: [
      { sku: 'TEA-001', name: 'Trà sen 100g', price: 80000, attributes: [{ name: 'size', value: '100g' }] },
      { sku: 'TEA-002', name: 'Trà sen 200g', price: 150000, attributes: [{ name: 'size', value: '200g' }] },
      { sku: 'TEA-003', name: 'Trà hoa cúc 100g', price: 70000, attributes: [{ name: 'size', value: '100g' }] }
    ]}
  ]
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { products: CONFIG.DEFAULT_PRODUCTS, variants: CONFIG.DEFAULT_VARIANTS, keep: false, dryRun: false, verbose: false, categoryId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--products' && args[i + 1]) options.products = parseInt(args[++i]);
    else if (args[i] === '--variants' && args[i + 1]) options.variants = parseInt(args[++i]);
    else if (args[i] === '--keep') options.keep = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--verbose') options.verbose = true;
    else if (args[i] === '--category' && args[i + 1]) options.categoryId = args[++i];
  }
  if (options.products > CONFIG.MAX_PRODUCTS) options.products = CONFIG.MAX_PRODUCTS;
  if (options.variants > CONFIG.MAX_VARIANTS) options.variants = CONFIG.MAX_VARIANTS;
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

const generateSKU = (prefix) => {
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${suffix}`;
};

const generateBarcode = () => Math.random().toString().substring(2, 13);

const getCategories = async (specificCategoryId = null) => {
  if (specificCategoryId) return await Category.findById(specificCategoryId);
  return await Category.find({ isActive: true });
};

const generateProductsWithVariants = async (options = {}) => {
  const { products = CONFIG.DEFAULT_PRODUCTS, variants = CONFIG.DEFAULT_VARIANTS, keep = false, dryRun = false, verbose = false, categoryId } = options;
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
    const createdProducts = [];
    const createdVariants = [];
    
    for (const category of categoryArray) {
      if (createdProducts.length >= products) break;
      const templates = productTemplates[category.name] || [];
      const remaining = products - createdProducts.length;
      const currentCount = Math.min(templates.length || 5, remaining);
      
      for (let i = 0; i < currentCount; i++) {
        const template = templates[i] || { name: `Sản phẩm ${category.name} ${i}`, variants: [] };
        const productData = {
          name: template.name,
          slug: await createUniqueSlug(template.name),
          categoryId: category._id,
          brand: 'Generic',
          description: `Mô tả cho ${template.name}`,
          images: `https://picsum.photos/seed/${template.name}/400/300.jpg`,
          hasVariants: true,
          options: [{ name: 'size', values: ['S', 'M', 'L'] }],
          tags: [category.name],
          isActive: true
        };
        
        if (!dryRun) {
          try {
            const product = await Product.create(productData);
            createdProducts.push(product);
            
            const variantTemplates = template.variants || [];
            const numVariants = Math.min(variantTemplates.length || variants, CONFIG.MAX_VARIANTS);
            
            for (let j = 0; j < numVariants; j++) {
              const vTemplate = variantTemplates[j] || {
                sku: generateSKU(category.name.substring(0, 3).toUpperCase()),
                name: `${template.name} - Variant ${j + 1}`,
                price: Math.floor(Math.random() * 100000) + 20000,
                attributes: [{ name: 'size', value: ['S', 'M', 'L'][j % 3] }]
              };
              
              const variant = await ProductVariant.create({
                productId: product._id,
                sku: vTemplate.sku,
                barcode: generateBarcode(),
                price: vTemplate.price,
                costPrice: Math.floor(vTemplate.price * 0.7),
                inventory: { quantity: Math.floor(Math.random() * 100) + 10, reserved: 0 },
                unit: 'cái',
                conversionRate: 1,
                attributes: vTemplate.attributes,
                images: productData.images,
                isDefault: j === 0,
                lowStockThreshold: 5,
                isActive: true
              });
              createdVariants.push(variant);
              if (verbose) console.log(`  📦 ${vTemplate.name}`);
            }
            if (verbose) console.log(`✅ ${productData.name} với ${numVariants} variants`);
          } catch (error) {
            console.error(`❌ ${productData.name}:`, error.message);
          }
        } else {
          createdProducts.push({ ...productData, _id: `temp_${createdProducts.length}` });
          const numVariants = variants;
          for (let j = 0; j < numVariants; j++) {
            createdVariants.push({ _id: `temp_variant_${createdProducts.length}_${j}` });
          }
          if (verbose) console.log(`📋 ${productData.name} với ${numVariants} variants`);
        }
      }
    }
    
    console.log(`${dryRun ? '📋 DRY RUN' : '🎉'} ${createdProducts.length} products, ${createdVariants.length} variants`);
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
      console.log('Usage: node scripts/seed-products-with-variants.js [--products N] [--variants N] [--keep] [--dry-run] [--verbose] [--category id]');
      return;
    }
    console.log(`🚀 Tạo ${options.products} products với ${options.variants} variants mỗi cái...`);
    if (!options.dryRun) await connectDB();
    await generateProductsWithVariants(options);
    console.log('✨ Hoàn thành!');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
export { generateProductsWithVariants, getCategories, parseArgs };