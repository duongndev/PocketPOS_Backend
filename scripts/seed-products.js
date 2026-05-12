#!/usr/bin/env node

/**
 * Script tạo dữ liệu ngẫu nhiên cho Products
 * Phiên bản cải tiến với nhiều tính năng nâng cao
 * 
 * Sử dụng:
 * node scripts/seed-products.js [số lượng] [options]
 * 
 * Options:
 * --keep     : Giữ lại dữ liệu cũ
 * --dry-run  : Chỉ hiển thị dữ liệu sẽ tạo, không thực hiện
 * --verbose  : Hiển thị log chi tiết
 * --category [id] : Chỉ tạo sản phẩm cho category cụ thể
 * 
 * Ví dụ:
 * node scripts/seed-products.js 200
 * node scripts/seed-products.js 100 --keep
 * node scripts/seed-products.js 50 --dry-run --verbose
 * node scripts/seed-products.js 30 --category 507f1f77bcf86cd799439011
 */

import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import connectDB from '../src/config/db.config.js';

// Cấu hình
const CONFIG = {
  DEFAULT_COUNT: 100,
  MAX_COUNT: 5000,
  BATCH_SIZE: 200
};

// Dữ liệu mẫu cho sản phẩm theo từng danh mục
const productTemplates = {
  // Đồ uống
  'Cà phê': [
    { name: 'Cà phê đen đá', brand: 'Highlands Coffee', description: 'Cà phê đen đậm đà, thơm ngon' },
    { name: 'Cà phê sữa đá', brand: 'Highlands Coffee', description: 'Cà phê sữa ngọt dịu, béo thơm' },
    { name: 'Cà phê muối', brand: 'Highlands Coffee', description: 'Cà phê muối vị mặn ngọt đặc trưng' },
    { name: 'Cà phê latte', brand: 'Starbucks', description: 'Latte sữa béo thơm nhẹ' },
    { name: 'Cà phê americano', brand: 'Starbucks', description: 'Americano đậm vị cà phê nguyên chất' },
    { name: 'Cappuccino', brand: 'Starbucks', description: 'Cappuccino bọt sữa mịn màng' },
    { name: 'Mocha', brand: 'Starbucks', description: 'Mocha chocolate và cà phê' },
    { name: 'Espresso', brand: 'Starbucks', description: 'Espresso đậm đặc nguyên chất' }
  ],
  'Trà': [
    { name: 'Trà đào cam sả', brand: 'Trà Nguyễn', description: 'Trà đào thơm mát sả' },
    { name: 'Trà táo quế', brand: 'Trà Nguyễn', description: 'Trà táo ấm áp vị quế' },
    { name: 'Trà gừng mật ong', brand: 'Trà Nguyễn', description: 'Trà gừng ấm nóng mật ong' },
    { name: 'Trà hoa cúc', brand: 'Trà Nguyễn', description: 'Trà hoa cúc thanh mát' },
    { name: 'Trà sen', brand: 'Trà Nguyễn', description: 'Trà sen hương thơm tinh tế' },
    { name: 'Trà atiso', brand: 'Trà Nguyễn', description: 'Trà atiso tốt cho sức khỏe' },
    { name: 'Trà lài', brand: 'Trà Nguyễn', description: 'Trà lài thơm ngát' },
    { name: 'Trà xanh', brand: 'Trà Nguyễn', description: 'Trà xanh antioxidant' }
  ],
  'Sinh tố': [
    { name: 'Sinh tố xoài', brand: 'The Coffee House', description: 'Sinh tố xoài ngọt ngào' },
    { name: 'Sinh tố dứa', brand: 'The Coffee House', description: 'Sinh tố dứa chua ngọt' },
    { name: 'Sinh tố chuối', brand: 'The Coffee House', description: 'Sinh tố chuối béo ngậy' },
    { name: 'Sinh tố bơ', brand: 'The Coffee House', description: 'Sinh tố bơ creamy' },
    { name: 'Sinh tố dâu tây', brand: 'The Coffee House', description: 'Sinh tố dâu tươi mát' },
    { name: 'Sinh tố cam', brand: 'The Coffee House', description: 'Sinh tố cam vitamin C' },
    { name: 'Sinh tố ổi', brand: 'The Coffee House', description: 'Sinh tố ổi chua ngọt' },
    { name: 'Sinh tố mãng cầu', brand: 'The Coffee House', description: 'Sinh tố mãng cầu đặc trưng' }
  ],
  'Nước ép': [
    { name: 'Nước ép cam', brand: 'Fresh Plus', description: 'Nước ép cam tươi nguyên chất' },
    { name: 'Nướcép táo', brand: 'Fresh Plus', description: 'Nước ép táo ngọt lành' },
    { name: 'Nước ép cà rốt', brand: 'Fresh Plus', description: 'Nước ép cà rốt vitamin A' },
    { name: 'Nước ép cần tây', brand: 'Fresh Plus', description: 'Nước ép cần tây detox' },
    { name: 'Nước ép dưa hấu', brand: 'Fresh Plus', description: 'Nước ép dưa hấu mát lạnh' },
    { name: 'Nước ép bưởi', brand: 'Fresh Plus', description: 'Nước ép bưởi thanh mát' },
    { name: 'Nước ép ổi', brand: 'Fresh Plus', description: 'Nước ép ổi giàu vitamin' },
    { name: 'Nước ép khổ qua', brand: 'Fresh Plus', description: 'Nước ép khổ qua tốt cho sức khỏe' }
  ],

  // Đồ ăn
  'Bánh mì': [
    { name: 'Bánh mì kẹp thịt', brand: 'Bánh mì Phượng', description: 'Bánh mì thịt nướng thơm lừng' },
    { name: 'Bánh mì bì', brand: 'Bánh mì Phượng', description: 'Bánh mì bì heo thơm ngon' },
    { name: 'Bánh mì chả', brand: 'Bánh mì Phượng', description: 'Bánh mì chả lụa' },
    { name: 'Bánh mì pate', brand: 'Bánh mì Phượng', description: 'Bánh mì pate béo ngậy' },
    { name: 'Bánh mì trứng', brand: 'Bánh mì Phượng', description: 'Bánh mì trứng ốp la' },
    { name: 'Bánh mì nướng', brand: 'Bánh mì Phượng', description: 'Bánh mì nướng giòn rụm' },
    { name: 'Bánh mì sandwich', brand: 'Bánh mì Phượng', description: 'Bánh mì sandwich phương Tây' },
    { name: 'Bánh mì vegetarian', brand: 'Bánh mì Phượng', description: 'Bánh mì chay lành mạnh' }
  ],
  'Bánh ngọt': [
    { name: 'Bánh croissant', brand: 'Paris Baguette', description: 'Bánh sừng bò béo ngậy' },
    { name: 'Bánh su kem', brand: 'Paris Baguette', description: 'Bánh su kem mềm mịn' },
    { name: 'Bánh tiramisu', brand: 'Paris Baguette', description: 'Bánh tiramisu Ý' },
    { name: 'Bánh cheesecake', brand: 'Paris Baguette', description: 'Bánh phô mai New York' },
    { name: 'Bánh brownie', brand: 'Paris Baguette', description: 'Bánh brownie sô cô la' },
    { name: 'Bánh macaron', brand: 'Paris Baguette', description: 'Bánh macaron Pháp' },
    { name: 'Bánh mousse', brand: 'Paris Baguette', description: 'Bánh mousse nhẹ nhàng' },
    { name: 'Bánh éclair', brand: 'Paris Baguette', description: 'Bánh éclair sô cô la' }
  ],
  'Đồ ăn nhanh': [
    { name: 'Hamburger bò', brand: 'McDonald\'s', description: 'Hamburger bò tươi ngon' },
    { name: 'Cheeseburger', brand: 'McDonald\'s', description: 'Cheeseburger phô mai' },
    { name: 'Pizza hải sản', brand: 'Pizza Hut', description: 'Pizza hải sản tươi sống' },
    { name: 'Pizza thịt nguội', brand: 'Pizza Hut', description: 'Pizza thịt nguội phô mai' },
    { name: 'Gà rán', brand: 'KFC', description: 'Gà rán giòn tan' },
    { name: 'Cánh gà', brand: 'KFC', description: 'Cánh gà cay nồng' },
    { name: 'Hot dog', brand: 'KFC', description: 'Hot dog xúc xích' },
    { name: 'Mì cay', brand: 'KFC', description: 'Mì cay Hàn Quốc' }
  ],

  // Đồ dùng
  'Giày dép': [
    { name: 'Giày thể thao Nike', brand: 'Nike', description: 'Giày thể thao Nike Air Max' },
    { name: 'Giày chạy bộ Adidas', brand: 'Adidas', description: 'Giày chạy bộ Adidas Ultraboost' },
    { name: 'Dép lê Birkenstock', brand: 'Birkenstock', description: 'Dép lê thoải mái' },
    { name: 'Sandal nữ', brand: 'Zara', description: 'Sandal thời trang nữ' },
    { name: 'Giày boots da', brand: 'Zara', description: 'Giày boots da thật' },
    { name: 'Giày cao gót', brand: 'Zara', description: 'Giày cao gót 10cm' },
    { name: 'Dép quai ngang', brand: 'Havaianas', description: 'Dép quai ngang Brazil' },
    { name: 'Giày sneaker', brand: 'Converse', description: 'Giày sneaker classic' }
  ],
  'Quần áo': [
    { name: 'Áo thun cotton', brand: 'Uniqlo', description: 'Áo thun cotton 100%' },
    { name: 'Áo sơ mi nam', brand: 'Zara', description: 'Áo sơ mi công sở' },
    { name: 'Quần jeans slim', brand: 'Levi\'s', description: 'Quần jeans slim fit' },
    { name: 'Quần short kaki', brand: 'Zara', description: 'Quần short kaki casual' },
    { name: 'Váy hoa nhí', brand: 'Zara', description: 'Váy hoa nhí vintage' },
    { name: 'Áo khoác bomber', brand: 'Nike', description: 'Áo khoác bomber thể thao' },
    { name: 'Quần dài jogger', brand: 'Adidas', description: 'Quần jogger thoải mái' },
    { name: 'Đồ lót cotton', brand: 'Uniqlo', description: 'Đồ lót cotton organic' }
  ],
  'Đồ điện tử': [
    { name: 'iPhone 15 Pro', brand: 'Apple', description: 'iPhone 15 Pro 256GB' },
    { name: 'Samsung Galaxy S24', brand: 'Samsung', description: 'Samsung Galaxy S24 Ultra' },
    { name: 'iPad Pro', brand: 'Apple', description: 'iPad Pro 12.9 inch' },
    { name: 'MacBook Air', brand: 'Apple', description: 'MacBook Air M2' },
    { name: 'AirPods Pro', brand: 'Apple', description: 'AirPods Pro 2nd gen' },
    { name: 'Loa JBL', brand: 'JBL', description: 'Loa bluetooth JBL Flip' },
    { name: 'Sạc dự phòng Anker', brand: 'Anker', description: 'Sạc dự phòng 20000mAh' },
    { name: 'Tai nghe Sony', brand: 'Sony', description: 'Tai nghe không dây Sony WH-1000XM5' }
  ],
  'Mỹ phẩm': [
    { name: 'Kem dưỡng da', brand: 'Innisfree', description: 'Kem dưỡng da Green Tea' },
    { name: 'Sữa rửa mặt', brand: 'Cetaphil', description: 'Sữa rửa mặt dịu nhẹ' },
    { name: 'Nước hoa Chanel', brand: 'Chanel', description: 'Nước hoa Chanel No.5' },
    { name: 'Son môi MAC', brand: 'MAC', description: 'Son môi MAC Ruby Woo' },
    { name: 'Phấn phủ', brand: 'Innisfree', description: 'Phấn phủ khoáng' },
    { name: 'Mascara', brand: 'Maybelline', description: 'Mascara dài mi' },
    { name: 'Kem chống nắng', brand: 'Anessa', description: 'Kem chống nắng SPF50+' },
    { name: 'Tẩy trang', brand: 'Bioderma', description: 'Nước tẩy trang micellar' }
  ]
};

// Brands theo từng category
const categoryBrands = {
  'Cà phê': ['Highlands Coffee', 'Starbucks', 'The Coffee House', 'Phúc Long', 'Trung Nguyên'],
  'Trà': ['Trà Nguyễn', 'Trà Long', 'Trà Thái Nguyên', 'Trà Xanh 0 Độ', 'Trà Oolong'],
  'Sinh tố': ['The Coffee House', 'Highlands Coffee', 'Smoothie King', 'Jamba Juice', 'Boost Juice'],
  'Nước ép': ['Fresh Plus', 'Juice It Up', 'Pressed Juicery', 'Naked Juice', 'Tropicana'],
  'Bánh mì': ['Bánh mì Phượng', 'Bánh mì Huỳnh Hoa', 'Bánh mì Bảy Hổ', 'Bánh mì Hòa Mã', 'Bánh mì Lê Gia'],
  'Bánh ngọt': ['Paris Baguette', ' Tous Les Jours', 'Bánh mì ABC', 'Kinh Đô', 'Bibica'],
  'Đồ ăn nhanh': ['McDonald\'s', 'KFC', 'Pizza Hut', 'Lotteria', 'Burger King'],
  'Giày dép': ['Nike', 'Adidas', 'Puma', 'Converse', 'Vans', 'New Balance'],
  'Quần áo': ['Zara', 'H&M', 'Uniqlo', 'Nike', 'Adidas', 'Mango'],
  'Đồ điện tử': ['Apple', 'Samsung', 'Sony', 'LG', 'Xiaomi', 'Huawei'],
  'Mỹ phẩm': ['Innisfree', 'The Face Shop', 'MAC', 'Chanel', 'Dior', 'L\'Oréal']
};

// Parse arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    count: CONFIG.DEFAULT_COUNT,
    keep: false,
    dryRun: false,
    verbose: false,
    categoryId: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!isNaN(arg) && i === 0) {
      options.count = Math.min(parseInt(arg), CONFIG.MAX_COUNT);
    } else if (arg === '--keep') {
      options.keep = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--category' && i + 1 < args.length) {
      options.categoryId = args[i + 1];
      i++; // Skip next argument
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
const createUniqueSlug = async (name) => {
  if (slugCache.has(name)) {
    return slugCache.get(name);
  }

  let slug = generateSlug(name);
  let counter = 1;

  while (await Product.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  slugCache.set(name, slug);
  return slug;
};

// Tạo dữ liệu ngẫu nhiên cho description
const generateRandomDescription = (productName, category) => {
  const templates = [
    `${productName} chất lượng cao, ${category}`,
    `${productName} chính hãng, giá tốt nhất`,
    `${productName} mới nhất 2024, bảo hành uy tín`,
    `${productName} được ưa chuộng nhất hiện nay`,
    `${productName} nhập khẩu chính ngách`,
    `${productName} ưu đãi đặc biệt, giao hàng nhanh`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};

// Lấy danh sách categories
const getCategories = async (specificCategoryId = null) => {
  if (specificCategoryId) {
    return await Category.findById(specificCategoryId);
  }
  return await Category.find({ isActive: true });
};

// Tạo sản phẩm ngẫu nhiên cho một category
const generateProductsForCategory = async (category, count, options = {}) => {
  const { dryRun = false, verbose = false } = options;
  const products = [];
  
  // Lấy template cho category này
  const templates = productTemplates[category.name] || [];
  const brands = categoryBrands[category.name] || ['Generic Brand', 'Local Brand', 'Import Brand'];
  
  // Tạo số lượng sản phẩm
  for (let i = 0; i < count; i++) {
    let productData;
    
    if (templates.length > 0 && i < templates.length) {
      // Sử dụng template có sẵn
      const template = templates[i];
      productData = {
        name: template.name,
        brand: template.brand,
        description: template.description,
        categoryId: category._id,
        isActive: true
      };
    } else {
      // Tạo sản phẩm ngẫu nhiên
      const randomBrand = brands[Math.floor(Math.random() * brands.length)];
      const randomSuffix = Math.floor(Math.random() * 1000);
      const baseName = templates.length > 0 ? templates[0].name : `Sản phẩm ${category.name}`;
      const productName = i < templates.length ? templates[i].name : `${baseName} ${randomSuffix}`;
      
      productData = {
        name: productName,
        brand: randomBrand,
        description: generateRandomDescription(productName, category.name),
        categoryId: category._id,
        isActive: Math.random() > 0.1 // 90% active
      };
    }
    
    // Thêm slug
    productData.slug = await createUniqueSlug(productData.name);
    
    // Thêm image URL ngẫu nhiên (placeholder)
    productData.image = `https://picsum.photos/seed/${productData.slug}/400/300.jpg`;
    
    if (!dryRun) {
      try {
        const product = new Product(productData);
        const savedProduct = await product.save();
        products.push(savedProduct);
        
        if (verbose) {
          console.log(`✅ Tạo sản phẩm: ${productData.name} (${category.name})`);
        }
      } catch (error) {
        console.error(`❌ Lỗi tạo sản phẩm ${productData.name}:`, error.message);
      }
    } else {
      products.push({ ...productData, _id: `temp_${i}` });
      if (verbose) {
        console.log(`📋 Sẽ tạo sản phẩm: ${productData.name} (${category.name})`);
      }
    }
  }
  
  return products;
};

// Tạo dữ liệu ngẫu nhiên
const generateRandomProducts = async (options = {}) => {
  const { count = CONFIG.DEFAULT_COUNT, keep = false, dryRun = false, verbose = false, categoryId } = options;

  try {
    // Xóa dữ liệu cũ nếu không keep
    if (!keep && !dryRun) {
      if (categoryId) {
        await Product.deleteMany({ categoryId });
        console.log(`🗑️ Đã xóa sản phẩm cũ cho category ${categoryId}`);
      } else {
        await Product.deleteMany({});
        console.log('🗑️ Đã xóa tất cả dữ liệu sản phẩm cũ');
      }
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu cũ');
    }

    // Lấy categories
    const categories = await getCategories(categoryId);
    
    if (!categories || (Array.isArray(categories) && categories.length === 0)) {
      console.error('❌ Không tìm thấy category nào!');
      return;
    }

    const categoryArray = Array.isArray(categories) ? categories : [categories];
    const productsPerCategory = Math.ceil(count / categoryArray.length);
    const createdProducts = [];

    console.log(`📦 Tạo sản phẩm cho ${categoryArray.length} category(s)...`);

    // Tạo sản phẩm cho từng category
    for (const category of categoryArray) {
      if (createdProducts.length >= count) break;
      
      const remainingCount = count - createdProducts.length;
      const currentCount = Math.min(productsPerCategory, remainingCount);
      
      const categoryProducts = await generateProductsForCategory(category, currentCount, { dryRun, verbose });
      createdProducts.push(...categoryProducts);
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'} ${createdProducts.length} sản phẩm!`);

    // Hiển thị thống kê
    if (!dryRun) {
      const stats = await Product.aggregate([
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { categoryName: '$category.name', count: 1 } },
        { $sort: { count: -1 } }
      ]);

      console.log(`📊 Thống kê sản phẩm theo category:`);
      stats.forEach(stat => {
        console.log(`   - ${stat.categoryName}: ${stat.count} sản phẩm`);
      });
    }

    console.log(`   - Tổng cộng: ${createdProducts.length} sản phẩm`);
    console.log(`   - Trạng thái: ${dryRun ? 'DRY RUN' : 'Đã lưu vào database'}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi tạo dữ liệu:', error.message);
    throw error;
  }
};

// Hiển thị help
const showHelp = () => {
  console.log(`
📖 Script Tạo Dữ Liệu Products

Sử dụng:
  node scripts/seed-products.js [số lượng] [options]

Options:
  --keep           : Giữ lại dữ liệu cũ
  --dry-run        : Chỉ hiển thị, không thực hiện
  --verbose        : Hiển thị log chi tiết
  --category [id]  : Chỉ tạo sản phẩm cho category cụ thể
  --help           : Hiển thị help này

Ví dụ:
  node scripts/seed-products.js 200
  node scripts/seed-products.js 100 --keep
  node scripts/seed-products.js 50 --dry-run --verbose
  node scripts/seed-products.js 30 --category 507f1f77bcf86cd799439011

Giới hạn:
  - Số lượng tối đa: ${CONFIG.MAX_COUNT}
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

    console.log(`🚀 Bắt đầu tạo ${options.count} sản phẩm ngẫu nhiên...`);
    console.log(`📋 Options: keep=${options.keep}, dry-run=${options.dryRun}, verbose=${options.verbose}, category=${options.categoryId}\n`);

    if (!options.dryRun) {
      await connectDB();
    }

    await generateRandomProducts(options);

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
  generateRandomProducts,
  getCategories,
  generateProductsForCategory,
  parseArgs
};

// Export cho CommonJS (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateRandomProducts,
    getCategories,
    generateProductsForCategory,
    parseArgs
  };
}
