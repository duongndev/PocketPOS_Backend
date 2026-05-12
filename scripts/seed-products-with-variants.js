#!/usr/bin/env node

/**
 * Script tạo dữ liệu ngẫu nhiên cho Products và Product Variants
 * Tạo sản phẩm với các biến thể (size, màu sắc, dung lượng, v.v.)
 * 
 * Sử dụng:
 * node scripts/seed-products-with-variants.js [options]
 * 
 * Options:
 * --products [số lượng]   : Số lượng sản phẩm (default: 50)
 * --variants [số lượng]   : Số lượng biến thể trung bình mỗi sản phẩm (default: 3)
 * --keep                  : Giữ lại dữ liệu cũ
 * --dry-run              : Chỉ hiển thị dữ liệu sẽ tạo, không thực hiện
 * --verbose              : Hiển thị log chi tiết
 * --category [id]        : Chỉ tạo cho category cụ thể
 * 
 * Ví dụ:
 * node scripts/seed-products-with-variants.js
 * node scripts/seed-products-with-variants.js --products 100 --variants 4
 * node scripts/seed-products-with-variants.js --keep --verbose
 * node scripts/seed-products-with-variants.js --category 507f1f77bcf86cd799439011
 */

import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import ProductVariant from '../src/models/product_variant.model.js';
import Category from '../src/models/category.model.js';
import connectDB from '../src/config/db.config.js';

// Cấu hình
const CONFIG = {
  DEFAULT_PRODUCTS: 50,
  DEFAULT_VARIANTS: 3,
  MAX_PRODUCTS: 1000,
  MAX_VARIANTS: 10,
  BATCH_SIZE: 50
};

// Dữ liệu mẫu cho sản phẩm theo từng danh mục
const productTemplates = {
  // Đồ uống
  'Cà phê': [
    { 
      name: 'Cà phê Highlands', 
      brand: 'Highlands Coffee', 
      description: 'Cà phê chất lượng cao từ Highlands',
      variants: [
        { name: 'Cà phê đen đá', price: 25000, attributes: { size: 'M', type: 'đen', ice: 'có' } },
        { name: 'Cà phê sữa đá', price: 28000, attributes: { size: 'M', type: 'sữa', ice: 'có' } },
        { name: 'Cà phê nóng', price: 25000, attributes: { size: 'M', type: 'đen', ice: 'không' } },
        { name: 'Cà phê L size', price: 35000, attributes: { size: 'L', type: 'đen', ice: 'có' } }
      ]
    },
    { 
      name: 'Cà phê Starbucks', 
      brand: 'Starbucks', 
      description: 'Cà phê phong cách Mỹ',
      variants: [
        { name: 'Latte', price: 45000, attributes: { size: 'T', type: 'latte', milk: 'sữa tươi' } },
        { name: 'Cappuccino', price: 42000, attributes: { size: 'T', type: 'cappuccino', foam: 'bọt sữa' } },
        { name: 'Americano', price: 38000, attributes: { size: 'T', type: 'americano', strength: 'mạnh' } },
        { name: 'Mocha', price: 48000, attributes: { size: 'T', type: 'mocha', chocolate: 'có' } }
      ]
    }
  ],
  'Trà': [
    { 
      name: 'Trà Trà Nguyễn', 
      brand: 'Trà Nguyễn', 
      description: 'Trà thuần Việt',
      variants: [
        { name: 'Trà đào cam sả', price: 35000, attributes: { size: 'M', flavor: 'đào', additive: 'cam sả' } },
        { name: 'Trà táo quế', price: 32000, attributes: { size: 'M', flavor: 'táo', spice: 'quế' } },
        { name: 'Trà gừng mật ong', price: 34000, attributes: { size: 'M', flavor: 'gừng', sweetener: 'mật ong' } },
        { name: 'Trà hoa cúc', price: 30000, attributes: { size: 'M', flavor: 'hoa cúc', type: 'thanh mát' } }
      ]
    }
  ],
  'Sinh tố': [
    { 
      name: 'Sinh tố The Coffee House', 
      brand: 'The Coffee House', 
      description: 'Sinh tố trái cây tươi',
      variants: [
        { name: 'Sinh tố xoài', price: 45000, attributes: { size: 'L', fruit: 'xoài', type: 'ngọt' } },
        { name: 'Sinh tố dâu tây', price: 42000, attributes: { size: 'L', fruit: 'dâu tây', type: 'chua ngọt' } },
        { name: 'Sinh tố chuối', price: 38000, attributes: { size: 'L', fruit: 'chuối', type: 'béo' } },
        { name: 'Sinh tố bơ', price: 50000, attributes: { size: 'L', fruit: 'bơ', type: 'creamy' } }
      ]
    }
  ],
  'Đồ ăn nhanh': [
    { 
      name: 'Burger McDonald\'s', 
      brand: 'McDonald\'s', 
      description: 'Hamburger nhanh và ngon',
      variants: [
        { name: 'Hamburger bò', price: 45000, attributes: { size: 'regular', meat: 'bò', cheese: 'có' } },
        { name: 'Cheeseburger', price: 48000, attributes: { size: 'regular', meat: 'bò', cheese: 'phô mai' } },
        { name: 'Big Mac', price: 65000, attributes: { size: 'large', meat: 'bò', layers: '2 lớp' } },
        { name: 'McChicken', price: 42000, attributes: { size: 'regular', meat: 'gà', spicy: 'không' } }
      ]
    },
    { 
      name: 'Pizza Pizza Hut', 
      brand: 'Pizza Hut', 
      description: 'Pizza ngon Ý',
      variants: [
        { name: 'Pizza hải sản', price: 150000, attributes: { size: 'M', type: 'hải sản', crust: 'mỏng' } },
        { name: 'Pizza thịt nguội', price: 140000, attributes: { size: 'M', type: 'thịt nguội', crust: 'dày' } },
        { name: 'Pizza size L', price: 200000, attributes: { size: 'L', type: 'hải sản', crust: 'mỏng' } },
        { name: 'Pizza size XL', price: 250000, attributes: { size: 'XL', type: 'thịt nguội', crust: 'dày' } }
      ]
    }
  ],
  'Giày dép': [
    { 
      name: 'Giày Nike Air', 
      brand: 'Nike', 
      description: 'Giày thể thao Nike chất lượng',
      variants: [
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '40', color: '#000000', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '41', color: '#FFFFFF', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '42', color: '#0000FF', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2600000, attributes: { size: '43', color: '#FF0000', material: 'da thật' } }
      ]
    },
    { 
      name: 'Giày Adidas Ultraboost', 
      brand: 'Adidas', 
      description: 'Giày chạy bộ Adidas',
      variants: [
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '40', color: '#808080', technology: 'boost' } },
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '41', color: '#000000', technology: 'boost' } },
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '42', color: '#FFFFFF', technology: 'boost' } },
        { name: 'Ultraboost 22', price: 3500000, attributes: { size: '43', color: '#0000FF', technology: 'boost 2.0' } }
      ]
    }
  ],
  'Quần áo': [
    { 
      name: 'Áo thun Uniqlo', 
      brand: 'Uniqlo', 
      description: 'Áo thun cotton chất lượng cao',
      variants: [
        { name: 'Áo thun trắng', price: 250000, attributes: { size: 'S', color: '#FFFFFF', material: 'cotton 100%' } },
        { name: 'Áo thun đen', price: 250000, attributes: { size: 'M', color: '#000000', material: 'cotton 100%' } },
        { name: 'Áo thun xanh', price: 250000, attributes: { size: 'L', color: '#0000FF', material: 'cotton 100%' } },
        { name: 'Áo thun XL', price: 280000, attributes: { size: 'XL', color: '#FF0000', material: 'cotton organic' } }
      ]
    }
  ],
  'Đồ điện tử': [
    { 
      name: 'iPhone 15', 
      brand: 'Apple', 
      description: 'iPhone 15 mới nhất',
      variants: [
        { name: 'iPhone 15 128GB', price: 21990000, attributes: { storage: '128GB', color: '#000000', network: '5G' } },
        { name: 'iPhone 15 256GB', price: 24990000, attributes: { storage: '256GB', color: '#FFFFFF', network: '5G' } },
        { name: 'iPhone 15 512GB', price: 28990000, attributes: { storage: '512GB', color: '#0000FF', network: '5G' } },
        { name: 'iPhone 15 Pro', price: 32990000, attributes: { storage: '256GB', color: '#878681', network: '5G' } }
      ]
    },
    { 
      name: 'Samsung Galaxy', 
      brand: 'Samsung', 
      description: 'Samsung Galaxy S24',
      variants: [
        { name: 'Galaxy S24', price: 20990000, attributes: { storage: '128GB', color: '#000000', screen: '6.2"' } },
        { name: 'Galaxy S24+', price: 25990000, attributes: { storage: '256GB', color: '#FFFFFF', screen: '6.7"' } },
        { name: 'Galaxy S24 Ultra', price: 32990000, attributes: { storage: '512GB', color: '#808080', screen: '6.8"' } }
      ]
    }
  ],
  'Mỹ phẩm': [
    { 
      name: 'Son môi MAC', 
      brand: 'MAC', 
      description: 'Son môi MAC chất lượng',
      variants: [
        { name: 'MAC Ruby Woo', price: 650000, attributes: { shade: 'ruby', finish: 'matte', type: 'lipstick' } },
        { name: 'MAC Chili', price: 650000, attributes: { shade: 'chili', finish: 'matte', type: 'lipstick' } },
        { name: 'MAC Velvet Teddy', price: 650000, attributes: { shade: 'nude', finish: 'matte', type: 'lipstick' } },
        { name: 'MAC Lipglass', price: 550000, attributes: { shade: 'clear', finish: 'gloss', type: 'lip gloss' } }
      ]
    }
  ]
};

// Attributes mặc định theo category
const defaultAttributes = {
  'Cà phê': ['size', 'type', 'ice', 'milk', 'strength'],
  'Trà': ['size', 'flavor', 'additive', 'sweetener', 'type'],
  'Sinh tố': ['size', 'fruit', 'type', 'sweetness', 'ice'],
  'Đồ ăn nhanh': ['size', 'meat', 'cheese', 'spicy', 'layers'],
  'Giày dép': ['size', 'color', 'material', 'style', 'technology'],
  'Quần áo': ['size', 'color', 'material', 'style', 'fit'],
  'Đồ điện tử': ['storage', 'color', 'network', 'screen', 'generation'],
  'Mỹ phẩm': ['shade', 'finish', 'type', 'size', 'formula']
};

// Parse arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    products: CONFIG.DEFAULT_PRODUCTS,
    variants: CONFIG.DEFAULT_VARIANTS,
    keep: false,
    dryRun: false,
    verbose: false,
    categoryId: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--products' && i + 1 < args.length) {
      options.products = Math.min(parseInt(args[i + 1]), CONFIG.MAX_PRODUCTS);
      i++;
    } else if (arg === '--variants' && i + 1 < args.length) {
      options.variants = Math.min(parseInt(args[i + 1]), CONFIG.MAX_VARIANTS);
      i++;
    } else if (arg === '--keep') {
      options.keep = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--category' && i + 1 < args.length) {
      options.categoryId = args[i + 1];
      i++;
    }
  }

  return options;
};

// Tạo slug từ tên sản phẩm
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Tạo slug duy nhất
const slugCache = new Map();
const createUniqueSlug = async (name, Model) => {
  const cacheKey = `${Model.modelName}_${name}`;
  if (slugCache.has(cacheKey)) {
    return slugCache.get(cacheKey);
  }

  let slug = generateSlug(name);
  let counter = 1;

  while (await Model.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  slugCache.set(cacheKey, slug);
  return slug;
};

// Tạo SKU duy nhất
const skuCache = new Set();
const createUniqueSKU = (productName, variantName) => {
  const base = productName.substring(0, 3).toUpperCase() + variantName.substring(0, 3).toUpperCase();
  let sku = base;
  let counter = 1;

  while (skuCache.has(sku)) {
    sku = `${base}${counter}`;
    counter++;
  }

  skuCache.add(sku);
  return sku;
};

// Tạo barcode ngẫu nhiên
const generateBarcode = () => {
  return Math.random().toString().slice(2, 13).padStart(12, '0');
};

// Tạo giá ngẫu nhiên dựa trên category
const generatePrice = (category, basePrice = null) => {
  const priceRanges = {
    'Cà phê': { min: 20000, max: 60000 },
    'Trà': { min: 25000, max: 50000 },
    'Sinh tố': { min: 35000, max: 60000 },
    'Đồ ăn nhanh': { min: 40000, max: 300000 },
    'Giày dép': { min: 500000, max: 5000000 },
    'Quần áo': { min: 100000, max: 1000000 },
    'Đồ điện tử': { min: 10000000, max: 50000000 },
    'Mỹ phẩm': { min: 200000, max: 2000000 }
  };

  const range = priceRanges[category] || { min: 50000, max: 500000 };
  
  if (basePrice) {
    // Thêm/subtract 20% từ base price
    const variance = basePrice * 0.2;
    return Math.round(basePrice + (Math.random() - 0.5) * 2 * variance);
  }
  
  return Math.round(range.min + Math.random() * (range.max - range.min));
};

// Tạo attributes ngẫu nhiên
const generateRandomAttributes = (category, existingAttributes = {}) => {
  const possibleAttributes = defaultAttributes[category] || ['size', 'color', 'type'];
  const attributes = { ...existingAttributes };
  
  // Thêm 1-2 attributes ngẫu nhiên nếu chưa có
  const missingAttributes = possibleAttributes.filter(attr => !attributes[attr]);
  const numToAdd = Math.min(Math.floor(Math.random() * 2) + 1, missingAttributes.length);
  
  for (let i = 0; i < numToAdd; i++) {
    const attr = missingAttributes[i];
    const values = {
      size: ['S', 'M', 'L', 'XL', 'XXL'],
      color: ['#000000', '#FFFFFF', '#0000FF', '#FF0000', '#FFFF00', '#808080', '#A52A2A', '#FFC0CB'],
      type: ['basic', 'premium', 'deluxe', 'standard'],
      material: ['cotton', 'polyester', 'da', 'vải', 'nhựa'],
      style: ['cổ điển', 'hiện đại', 'thể thao', 'công sở']
    };
    
    const possibleValues = values[attr] || ['default'];
    attributes[attr] = possibleValues[Math.floor(Math.random() * possibleValues.length)];
  }
  
  return attributes;
};

// Lấy danh sách categories
const getCategories = async (specificCategoryId = null) => {
  if (specificCategoryId) {
    return await Category.findById(specificCategoryId);
  }
  return await Category.find({ isActive: true });
};

// Tạo sản phẩm với variants
const generateProductsWithVariants = async (options = {}) => {
  const { products = CONFIG.DEFAULT_PRODUCTS, variants = CONFIG.DEFAULT_VARIANTS, keep = false, dryRun = false, verbose = false, categoryId } = options;

  try {
    // Kiểm tra categories đã tồn tại
    const categories = await getCategories(categoryId);
    
    if (!categories || (Array.isArray(categories) && categories.length === 0)) {
      console.error('❌ Không tìm thấy category nào! Vui lòng tạo categories trước.');
      return [];
    }

    const categoryArray = Array.isArray(categories) ? categories : [categories];
    const productsPerCategory = Math.ceil(products / categoryArray.length);
    const createdProducts = [];
    const createdVariants = [];

    console.log(`📦 Tạo ${products} sản phẩm với ${variants} variants trung bình mỗi sản phẩm...`);
    console.log(`📂 Cho ${categoryArray.length} categories...`);

    // Xóa dữ liệu cũ nếu không keep
    if (!keep && !dryRun) {
      if (categoryId) {
        // Lấy products trong category này để xóa variants
        const productsToDelete = await Product.find({ categoryId });
        const productIdsToDelete = productsToDelete.map(p => p._id);
        
        await ProductVariant.deleteMany({ productId: { $in: productIdsToDelete } });
        await Product.deleteMany({ categoryId });
        console.log(`🗑️ Đã xóa products và variants cũ cho category ${categoryId}`);
      } else {
        await ProductVariant.deleteMany({});
        await Product.deleteMany({});
        console.log('🗑️ Đã xóa tất cả products và variants cũ');
      }
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu cũ');
    }

    // Tạo sản phẩm cho từng category
    for (const category of categoryArray) {
      if (createdProducts.length >= products) break;
      
      const remainingCount = products - createdProducts.length;
      const currentCount = Math.min(productsPerCategory, remainingCount);
      
      // Lấy templates cho category này
      const templates = productTemplates[category.name] || [];
      
      for (let i = 0; i < currentCount; i++) {
        let productData;
        let variantTemplates = [];
        
        if (templates.length > 0 && i < templates.length) {
          // Sử dụng template có sẵn
          const template = templates[i % templates.length];
          productData = {
            name: template.name,
            brand: template.brand,
            description: template.description,
            categoryId: category._id,
            isActive: true
          };
          variantTemplates = template.variants;
        } else {
          // Tạo sản phẩm ngẫu nhiên
          const randomSuffix = Math.floor(Math.random() * 1000);
          const baseName = templates.length > 0 ? templates[0].name : `Sản phẩm ${category.name}`;
          const productName = i < templates.length ? templates[i].name : `${baseName} ${randomSuffix}`;
          
          productData = {
            name: productName,
            brand: 'Generic Brand',
            description: `Sản phẩm chất lượng cao từ ${category.name}`,
            categoryId: category._id,
            isActive: Math.random() > 0.1
          };
        }
        
        // Thêm slug
        productData.slug = await createUniqueSlug(productData.name, Product);
        
        // Thêm image URL ngẫu nhiên
        productData.image = `https://picsum.photos/seed/${productData.slug}/400/300.jpg`;
        
        if (!dryRun) {
          try {
            // Tạo product
            const product = new Product(productData);
            const savedProduct = await product.save();
            createdProducts.push(savedProduct);
            
            // Tạo variants cho product
            const numVariants = Math.min(variantTemplates.length || variants, CONFIG.MAX_VARIANTS);
            
            for (let j = 0; j < numVariants; j++) {
              let variantData;
              
              if (j < variantTemplates.length) {
                // Sử dụng template variant
                const templateVariant = variantTemplates[j];
                variantData = {
                  productId: savedProduct._id,
                  name: templateVariant.name,
                  sku: createUniqueSKU(productData.name, templateVariant.name),
                  barcode: generateBarcode(),
                  price: templateVariant.price,
                  costPrice: Math.round(templateVariant.price * 0.7), // 70% of selling price
                  stock: Math.floor(Math.random() * 100) + 10, // 10-110 units
                  unit: 'piece',
                  conversionValue: 1,
                  attributes: new Map(Object.entries(templateVariant.attributes)),
                  isActive: true
                };
              } else {
                // Tạo variant ngẫu nhiên
                const variantName = `${productData.name} - Variant ${j + 1}`;
                const price = generatePrice(category.name);
                
                variantData = {
                  productId: savedProduct._id,
                  name: variantName,
                  sku: createUniqueSKU(productData.name, `VAR${j + 1}`),
                  barcode: generateBarcode(),
                  price: price,
                  costPrice: Math.round(price * 0.7),
                  stock: Math.floor(Math.random() * 100) + 10,
                  unit: 'piece',
                  conversionValue: 1,
                  attributes: new Map(Object.entries(generateRandomAttributes(category.name))),
                  isActive: Math.random() > 0.1
                };
              }
              
              // Thêm slug cho variant
              variantData.slug = await createUniqueSlug(variantData.name, ProductVariant);
              
              try {
                const variant = new ProductVariant(variantData);
                const savedVariant = await variant.save();
                createdVariants.push(savedVariant);
                
                if (verbose) {
                  console.log(`  📦 Tạo variant: ${variantData.name} - ${variantData.price.toLocaleString('vi-VN')}đ`);
                }
              } catch (error) {
                console.error(`❌ Lỗi tạo variant ${variantData.name}:`, error.message);
              }
            }
            
            if (verbose) {
              console.log(`✅ Tạo product: ${productData.name} với ${numVariants} variants`);
            }
          } catch (error) {
            console.error(`❌ Lỗi tạo product ${productData.name}:`, error.message);
          }
        } else {
          // Dry run - chỉ hiển thị
          createdProducts.push({ ...productData, _id: `temp_${i}` });
          const numVariants = Math.min(variantTemplates.length || variants, CONFIG.MAX_VARIANTS);
          
          for (let j = 0; j < numVariants; j++) {
            let variantData;
            
            if (j < variantTemplates.length) {
              const templateVariant = variantTemplates[j];
              variantData = {
                name: templateVariant.name,
                price: templateVariant.price,
                attributes: templateVariant.attributes
              };
            } else {
              variantData = {
                name: `${productData.name} - Variant ${j + 1}`,
                price: generatePrice(category.name),
                attributes: generateRandomAttributes(category.name)
              };
            }
            
            createdVariants.push({ ...variantData, _id: `temp_variant_${i}_${j}` });
            
            if (verbose) {
              console.log(`  📋 Sẽ tạo variant: ${variantData.name} - ${variantData.price.toLocaleString('vi-VN')}đ`);
            }
          }
          
          if (verbose) {
            console.log(`📋 Sẽ tạo product: ${productData.name} với ${numVariants} variants`);
          }
        }
      }
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'}:`);
    console.log(`   - Products: ${createdProducts.length}`);
    console.log(`   - Variants: ${createdVariants.length}`);
    console.log(`   - Trung bình: ${(createdVariants.length / createdProducts.length).toFixed(1)} variants/product`);

    // Hiển thị thống kê
    if (!dryRun) {
      const stats = await Product.aggregate([
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { categoryName: '$category.name', count: 1 } },
        { $sort: { count: -1 } }
      ]);

      const variantStats = await ProductVariant.aggregate([
        { $group: { _id: '$productId', count: { $sum: 1 } } },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        { $lookup: { from: 'categories', localField: 'product.categoryId', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $group: { _id: '$category.name', totalVariants: { $sum: '$count' }, totalProducts: { $sum: 1 } } },
        { $addFields: { avgVariants: { $divide: ['$totalVariants', '$totalProducts'] } } },
        { $sort: { totalVariants: -1 } }
      ]);

      console.log(`\n📊 Thống kê products theo category:`);
      stats.forEach(stat => {
        console.log(`   - ${stat.categoryName}: ${stat.count} products`);
      });

      console.log(`\n📈 Thống kê variants theo category:`);
      variantStats.forEach(stat => {
        console.log(`   - ${stat._id}: ${stat.totalVariants} variants (${stat.avgVariants.toFixed(1)}/product)`);
      });
    }

    return { products: createdProducts, variants: createdVariants };
  } catch (error) {
    console.error('❌ Lỗi tạo dữ liệu:', error.message);
    throw error;
  }
};

// Hiển thị help
const showHelp = () => {
  console.log(`
📖 Script Tạo Products và Product Variants

Sử dụng:
  node scripts/seed-products-with-variants.js [options]

Options:
  --products [số lượng]   : Số lượng sản phẩm (default: 50)
  --variants [số lượng]   : Số lượng biến thể trung bình mỗi sản phẩm (default: 3)
  --keep                  : Giữ lại dữ liệu cũ
  --dry-run              : Chỉ hiển thị, không thực hiện
  --verbose              : Hiển thị log chi tiết
  --category [id]        : Chỉ tạo cho category cụ thể
  --help                 : Hiển thị help này

Ví dụ:
  node scripts/seed-products-with-variants.js
  node scripts/seed-products-with-variants.js --products 100 --variants 4
  node scripts/seed-products-with-variants.js --keep --verbose
  node scripts/seed-products-with-variants.js --category 507f1f77bcf86cd799439011

Giới hạn:
  - Products tối đa: ${CONFIG.MAX_PRODUCTS}
  - Variants tối đa mỗi sản phẩm: ${CONFIG.MAX_VARIANTS}
  - Batch size: ${CONFIG.BATCH_SIZE}
`);
};

// Main function
const main = async () => {
  try {
    const options = parseArgs();

    // Hiển thị help
    if (process.argv.includes('--help')) {
      showHelp();
      return;
    }

    console.log(`🚀 Bắt đầu tạo products và variants...`);
    console.log(`📋 Options:`);
    console.log(`   - Products: ${options.products}`);
    console.log(`   - Variants per product: ${options.variants}`);
    console.log(`   - Keep: ${options.keep}`);
    console.log(`   - Dry-run: ${options.dryRun}`);
    console.log(`   - Verbose: ${options.verbose}`);
    console.log(`   - Category: ${options.categoryId || 'Tất cả'}\n`);

    if (!options.dryRun) {
      await connectDB();
    }

    await generateProductsWithVariants(options);

    console.log('\n✨ Hoàn thành!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    if (options.verbose) {
      console.error('❌ Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Đã ngắt kết nối MongoDB');
    }
  }
};

// Chạy script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export cho module system
export {
  generateProductsWithVariants,
  getCategories,
  parseArgs
};

// Export cho CommonJS (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateProductsWithVariants,
    getCategories,
    parseArgs
  };
}
