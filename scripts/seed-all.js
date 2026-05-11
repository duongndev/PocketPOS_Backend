#!/usr/bin/env node

/**
 * Script TẠO DỮ LIỆU HOÀN CHỈNH - TỐI ƯU
 * Tạo Categories, Products và Product Variants trong 1 file duy nhất
 * 
 * Sử dụng:
 * node scripts/seed-all.js [options]
 * 
 * Options:
 * --categories [số lượng]   : Số lượng categories (default: 50)
 * --products [số lượng]     : Số lượng products (default: 100)
 * --variants [số lượng]     : Số lượng variants trung bình mỗi product (default: 3)
 * --only [type]             : Chỉ tạo loại dữ liệu cụ thể (categories/products/variants/all)
 * --keep                    : Giữ lại dữ liệu cũ
 * --dry-run                 : Chỉ hiển thị, không thực hiện
 * --verbose                 : Hiển thị log chi tiết
 * --category [id]           : Chỉ tạo cho category cụ thể
 * --batch-size [size]       : Batch size cho processing (default: 100)
 * --help                    : Hiển thị help
 * 
 * Ví dụ:
 * node scripts/seed-all.js
 * node scripts/seed-all.js --categories 30 --products 200 --variants 4
 * node scripts/seed-all.js --only categories
 * node scripts/seed-all.js --only products --variants 5
 * node scripts/seed-all.js --keep --verbose
 * node scripts/seed-all.js --dry-run --categories 20 --products 50 --variants 2
 */

import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import ProductVariant from '../src/models/product_variant.model.js';
import { generateSlug } from '../src/controllers/category.controller.js';
import connectDB from '../src/config/db.config.js';

// ===== CONFIG =====
const CONFIG = {
  DEFAULT_CATEGORIES: 50,
  DEFAULT_PRODUCTS: 100,
  DEFAULT_VARIANTS: 3,
  MAX_CATEGORIES: 1000,
  MAX_PRODUCTS: 5000,
  MAX_VARIANTS: 10,
  BATCH_SIZE: 100
};

// ===== DATA TEMPLATES =====

// Categories mẫu
const SAMPLE_CATEGORIES = [
  // Đồ uống
  { name: 'Cà phê', description: 'Các loại cà phê nóng và lạnh' },
  { name: 'Trà', description: 'Trà truyền thống và trà hiện đại' },
  { name: 'Sinh tố', description: 'Sinh tố trái cây tươi ngon' },
  { name: 'Nước ép', description: 'Nước ép trái cây tự nhiên' },
  { name: 'Nước ngọt', description: 'Các loại nước ngọt có ga và không ga' },
  { name: 'Sữa', description: 'Sữa tươi và các sản phẩm từ sữa' },
  { name: 'Đồ uống nóng', description: 'Các loại đồ uống nóng ấm áp' },
  { name: 'Đồ uống lạnh', description: 'Các loại đồ uống lạnh mát lạnh' },

  // Đồ ăn
  { name: 'Bánh mì', description: 'Bánh mì kẹp và bánh mì sandwich' },
  { name: 'Bánh ngọt', description: 'Các loại bánh ngọt và bánh tráng miệng' },
  { name: 'Bánh mặn', description: 'Các loại bánh mặn và bánh ăn vặt' },
  { name: 'Đồ ăn nhanh', description: 'Hamburger, pizza, và đồ ăn nhanh khác' },
  { name: 'Mì ăn liền', description: 'Các loại mì ăn liền và mì gói' },
  { name: 'Mì tươi', description: 'Mì tươi và các loại mì tự làm' },
  { name: 'Cơm', description: 'Các món cơm và cơm hộp' },
  { name: 'Phở', description: 'Phở truyền thống và các biến thể' },
  { name: 'Bún', description: 'Bún và các món ăn từ bún' },
  { name: 'Món xào', description: 'Các món xào và món nóng' },
  { name: 'Món luộc', description: 'Các món luộc và món hấp' },
  { name: 'Món nướng', description: 'Các món nướng và BBQ' },

  // Đồ dùng
  { name: 'Giày dép', description: 'Giày, dép và các loại footwear' },
  { name: 'Quần áo', description: 'Quần áo thời trang và đồ mặc' },
  { name: 'Túi xách', description: 'Túi xách, balo và ví' },
  { name: 'Phụ kiện', description: 'Phụ kiện thời trang và trang sức' },
  { name: 'Đồ điện tử', description: 'Thiết bị điện tử và gia dụng' },
  { name: 'Đồ gia dụng', description: 'Đồ dùng trong gia đình' },
  { name: 'Sách', description: 'Sách và tài liệu học tập' },
  { name: 'Văn phòng phẩm', description: 'Dụng cụ văn phòng và học tập' },
  { name: 'Đồ chơi', description: 'Đồ chơi trẻ em và giải trí' },
  { name: 'Mỹ phẩm', description: 'Mỹ phẩm và đồ chăm sóc cá nhân' },
  { name: 'Đồ thể thao', description: 'Dụng cụ thể thao và outdoor' },
  { name: 'Đồ sức khỏe', description: 'Sản phẩm chăm sóc sức khỏe' },

  // Khác
  { name: 'Khuyến mãi', description: 'Các chương trình khuyến mãi và giảm giá' },
  { name: 'Sản phẩm mới', description: 'Sản phẩm mới ra mắt' },
  { name: 'Sản phẩm bán chạy', description: 'Sản phẩm bán chạy nhất' },
  { name: 'Sản phẩm đặc biệt', description: 'Sản phẩm đặc biệt và giới hạn' },

  // Thêm các danh mục mới
  { name: 'Đồ đông lạnh', description: 'Thực phẩm đông lạnh và bảo quản' },
  { name: 'Rau củ quả', description: 'Rau củ quả tươi và hữu cơ' },
  { name: 'Thịt và cá', description: 'Thịt tươi, cá tươi và hải sản' },
  { name: 'Ngũ cốc', description: 'Ngũ cốc và các sản phẩm từ ngũ cốc' },
  { name: 'Đồ hộp', description: 'Đồ hộp và thực phẩm chế biến' },
  { name: 'Gia vị', description: 'Gia vị và nguyên liệu nấu ăn' },
  { name: 'Bánh kẹo', description: 'Bánh kẹo và đồ ăn vặt' },
  { name: 'Sản phẩm địa phương', description: 'Đặc sản và sản phẩm địa phương' },
  { name: 'Hàng nhập khẩu', description: 'Sản phẩm nhập khẩu chất lượng cao' },
  { name: 'Sản phẩm organic', description: 'Sản phẩm organic và tự nhiên' },
  { name: 'Đồ dùng cá nhân', description: 'Đồ dùng cá nhân và vệ sinh' },
  { name: 'Chăm sóc nhà cửa', description: 'Sản phẩm chăm sóc nhà cửa' },
  { name: 'Thú cưng', description: 'Đồ dùng và thức ăn cho thú cưng' },
  { name: 'Sân vườn', description: 'Dụng cụ và vật tư sân vườn' },
  { name: 'Ô tô xe máy', description: 'Phụ tùng và đồ dùng ô tô xe máy' },
  { name: 'Điện thoại', description: 'Điện thoại và phụ kiện' },
  { name: 'Máy tính', description: 'Máy tính và linh kiện' },
  { name: 'Âm thanh', description: 'Thiết bị âm thanh và nhạc cụ' },
  { name: 'Máy ảnh', description: 'Máy ảnh và thiết bị nhiếp ảnh' },
  { name: 'Đồng hồ', description: 'Đồng hồ và phụ kiện thời gian' }
];

// Sub categories
const SUB_CATEGORIES = {
  'Cà phê': ['Cà phê đen', 'Cà phê sữa', 'Cà phê muối', 'Cà phê trứng', 'Cà phê latte', 'Cà phê đá', 'Cà phê nâu', 'Cà phê phin'],
  'Trà': ['Trà xanh', 'Trà đào', 'Trà táo', 'Trà gừng', 'Trà hoa cúc', 'Trà sen', 'Trà atiso', 'Trà lài'],
  'Bánh mì': ['Bánh mì kẹp thịt', 'Bánh mì bì', 'Bánh mì chả', 'Bánh mì pate', 'Bánh mì trứng', 'Bánh mì nướng', 'Bánh mì sandwich'],
  'Giày dép': ['Giày thể thao', 'Giày da', 'Dép lê', 'Dép xốp', 'Sandal', 'Giày boots', 'Giày cao gót', 'Dép quai ngang'],
  'Quần áo': ['Áo thun', 'Áo sơ mi', 'Quần jeans', 'Quần short', 'Váy', 'Áo khoác', 'Quần dài', 'Đồ lót'],
  'Đồ ăn nhanh': ['Hamburger', 'Pizza', 'KFC', 'Lẩu', 'Gà rán', 'Hot dog', 'Burger', 'Mì cay'],
  'Đồ uống': ['Nước suối', 'Nước khoáng', 'Nước trái cây', 'Nước detox', 'Nước electrolyte', 'Nước tăng lực'],
  'Mỹ phẩm': ['Kem dưỡng da', 'Sữa rửa mặt', 'Mỹ phẩm trang điểm', 'Nước hoa', 'Mỹ phẩm nam', 'Mỹ phẩm organic'],
  'Đồ điện tử': ['Điện thoại', 'Máy tính bảng', 'Laptop', 'Tai nghe', 'Loa bluetooth', 'Sạc dự phòng'],
  'Sách': ['Sách giáo khoa', 'Sách văn học', 'Sách kỹ năng', 'Sách kinh doanh', 'Truyện tranh', 'Sách thiếu nhi']
};

// Product templates với variants
const PRODUCT_TEMPLATES = {
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
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '40', color: 'đen', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '41', color: 'trắng', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2500000, attributes: { size: '42', color: 'xanh', material: 'da tổng hợp' } },
        { name: 'Nike Air Max 90', price: 2600000, attributes: { size: '43', color: 'đỏ', material: 'da thật' } }
      ]
    },
    {
      name: 'Giày Adidas Ultraboost',
      brand: 'Adidas',
      description: 'Giày chạy bộ Adidas',
      variants: [
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '40', color: 'xám', technology: 'boost' } },
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '41', color: 'đen', technology: 'boost' } },
        { name: 'Ultraboost 21', price: 3200000, attributes: { size: '42', color: 'trắng', technology: 'boost' } },
        { name: 'Ultraboost 22', price: 3500000, attributes: { size: '43', color: 'xanh', technology: 'boost 2.0' } }
      ]
    }
  ],
  'Quần áo': [
    {
      name: 'Áo thun Uniqlo',
      brand: 'Uniqlo',
      description: 'Áo thun cotton chất lượng cao',
      variants: [
        { name: 'Áo thun trắng', price: 250000, attributes: { size: 'S', color: 'trắng', material: 'cotton 100%' } },
        { name: 'Áo thun đen', price: 250000, attributes: { size: 'M', color: 'đen', material: 'cotton 100%' } },
        { name: 'Áo thun xanh', price: 250000, attributes: { size: 'L', color: 'xanh', material: 'cotton 100%' } },
        { name: 'Áo thun XL', price: 280000, attributes: { size: 'XL', color: 'đỏ', material: 'cotton organic' } }
      ]
    }
  ],
  'Đồ điện tử': [
    {
      name: 'iPhone 15',
      brand: 'Apple',
      description: 'iPhone 15 mới nhất',
      variants: [
        { name: 'iPhone 15 128GB', price: 21990000, attributes: { storage: '128GB', color: 'đen', network: '5G' } },
        { name: 'iPhone 15 256GB', price: 24990000, attributes: { storage: '256GB', color: 'trắng', network: '5G' } },
        { name: 'iPhone 15 512GB', price: 28990000, attributes: { storage: '512GB', color: 'xanh', network: '5G' } },
        { name: 'iPhone 15 Pro', price: 32990000, attributes: { storage: '256GB', color: 'titan', network: '5G' } }
      ]
    },
    {
      name: 'Samsung Galaxy',
      brand: 'Samsung',
      description: 'Samsung Galaxy S24',
      variants: [
        { name: 'Galaxy S24', price: 20990000, attributes: { storage: '128GB', color: 'đen', screen: '6.2"' } },
        { name: 'Galaxy S24+', price: 25990000, attributes: { storage: '256GB', color: 'trắng', screen: '6.7"' } },
        { name: 'Galaxy S24 Ultra', price: 32990000, attributes: { storage: '512GB', color: 'xám', screen: '6.8"' } }
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

// Brands theo category
const CATEGORY_BRANDS = {
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

// Attributes mặc định theo category
const DEFAULT_ATTRIBUTES = {
  'Cà phê': ['size', 'type', 'ice', 'milk', 'strength'],
  'Trà': ['size', 'flavor', 'additive', 'sweetener', 'type'],
  'Sinh tố': ['size', 'fruit', 'type', 'sweetness', 'ice'],
  'Đồ ăn nhanh': ['size', 'meat', 'cheese', 'spicy', 'layers'],
  'Giày dép': ['size', 'color', 'material', 'style', 'technology'],
  'Quần áo': ['size', 'color', 'material', 'style', 'fit'],
  'Đồ điện tử': ['storage', 'color', 'network', 'screen', 'generation'],
  'Mỹ phẩm': ['shade', 'finish', 'type', 'size', 'formula']
};

// Price ranges theo category
const PRICE_RANGES = {
  'Cà phê': { min: 20000, max: 60000 },
  'Trà': { min: 25000, max: 50000 },
  'Sinh tố': { min: 35000, max: 60000 },
  'Đồ ăn nhanh': { min: 40000, max: 300000 },
  'Giày dép': { min: 500000, max: 5000000 },
  'Quần áo': { min: 100000, max: 1000000 },
  'Đồ điện tử': { min: 10000000, max: 50000000 },
  'Mỹ phẩm': { min: 200000, max: 2000000 }
};

// ===== UTILITIES =====

// Parse arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    categories: CONFIG.DEFAULT_CATEGORIES,
    products: CONFIG.DEFAULT_PRODUCTS,
    variants: CONFIG.DEFAULT_VARIANTS,
    only: 'all',
    keep: false,
    dryRun: false,
    verbose: false,
    categoryId: null,
    batchSize: CONFIG.BATCH_SIZE
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--categories' && i + 1 < args.length) {
      options.categories = Math.min(parseInt(args[i + 1]), CONFIG.MAX_CATEGORIES);
      i++;
    } else if (arg === '--products' && i + 1 < args.length) {
      options.products = Math.min(parseInt(args[i + 1]), CONFIG.MAX_PRODUCTS);
      i++;
    } else if (arg === '--variants' && i + 1 < args.length) {
      options.variants = Math.min(parseInt(args[i + 1]), CONFIG.MAX_VARIANTS);
      i++;
    } else if (arg === '--only' && i + 1 < args.length) {
      const validTypes = ['categories', 'products', 'variants', 'all'];
      options.only = validTypes.includes(args[i + 1]) ? args[i + 1] : 'all';
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
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      options.batchSize = Math.min(parseInt(args[i + 1]), 500);
      i++;
    }
  }

  return options;
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

// Tạo giá ngẫu nhiên
const generatePrice = (category, basePrice = null) => {
  const range = PRICE_RANGES[category] || { min: 50000, max: 500000 };

  if (basePrice) {
    const variance = basePrice * 0.2;
    return Math.round(basePrice + (Math.random() - 0.5) * 2 * variance);
  }

  return Math.round(range.min + Math.random() * (range.max - range.min));
};

// Tạo attributes ngẫu nhiên
const generateRandomAttributes = (category, existingAttributes = {}) => {
  const possibleAttributes = DEFAULT_ATTRIBUTES[category] || ['size', 'color', 'type'];
  const attributes = { ...existingAttributes };

  const missingAttributes = possibleAttributes.filter(attr => !attributes[attr]);
  const numToAdd = Math.min(Math.floor(Math.random() * 2) + 1, missingAttributes.length);

  for (let i = 0; i < numToAdd; i++) {
    const attr = missingAttributes[i];
    const values = {
      size: ['S', 'M', 'L', 'XL', 'XXL'],
      color: ['đen', 'trắng', 'xanh', 'đỏ', 'vàng', 'xám', 'nâu', 'hồng'],
      type: ['basic', 'premium', 'deluxe', 'standard'],
      material: ['cotton', 'polyester', 'da', 'vải', 'nhựa'],
      style: ['cổ điển', 'hiện đại', 'thể thao', 'công sở']
    };

    const possibleValues = values[attr] || ['default'];
    attributes[attr] = possibleValues[Math.floor(Math.random() * possibleValues.length)];
  }

  return attributes;
};

// Tạo description ngẫu nhiên
const generateRandomDescription = (baseName) => {
  const templates = [
    `Chuyên cung cấp ${baseName} chất lượng cao`,
    `Danh mục ${baseName} đa dạng mẫu mã`,
    `${baseName} giá tốt nhất thị trường`,
    `${baseName} chính hãng, bảo hành uy tín`,
    `Phân phối ${baseName} sỉ và lẻ`,
    `${baseName} nhập khẩu chính ngách`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};

// Validate category data
const validateCategoryData = (category) => {
  if (!category.name || category.name.trim().length === 0) {
    throw new Error('Tên danh mục không được để trống');
  }
  if (category.name.length > 100) {
    throw new Error('Tên danh mục không quá 100 ký tự');
  }
  if (category.description && category.description.length > 500) {
    throw new Error('Mô tả không quá 500 ký tự');
  }
  return true;
};

// Lấy categories
const getCategories = async (specificCategoryId = null) => {
  if (specificCategoryId) {
    return await Category.findById(specificCategoryId);
  }
  return await Category.find({ isActive: true });
};

// ===== GENERATION FUNCTIONS =====

// Tạo categories
const generateCategories = async (options = {}) => {
  const { count = CONFIG.DEFAULT_CATEGORIES, keep = false, dryRun = false, verbose = false } = options;

  try {
    if (!keep && !dryRun) {
      await Category.deleteMany({});
      console.log('🗑️ Đã xóa dữ liệu categories cũ');
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu categories cũ');
    }

    const createdCategories = [];
    const categoryMap = new Map();

    // Tạo danh mục chính
    const parentCategories = SAMPLE_CATEGORIES.slice(0, Math.min(count, SAMPLE_CATEGORIES.length));

    for (let i = 0; i < parentCategories.length; i++) {
      const sample = parentCategories[i];

      try {
        validateCategoryData(sample);
        const slug = await createUniqueSlug(sample.name, Category);

        const category = new Category({
          name: sample.name,
          slug,
          description: sample.description,
          parentId: null,
          sortOrder: i,
          isActive: true
        });

        if (!dryRun) {
          const savedCategory = await category.save();
          createdCategories.push(savedCategory);
          categoryMap.set(sample.name, savedCategory._id);
        } else {
          createdCategories.push({ ...category.toObject(), _id: `temp_${i}` });
          categoryMap.set(sample.name, `temp_${i}`);
        }

        if (verbose) {
          console.log(`✅ ${dryRun ? 'Sẽ tạo' : 'Tạo'} category: ${sample.name}`);
        }
      } catch (error) {
        console.error(`❌ Lỗi tạo category ${sample.name}:`, error.message);
      }
    }

    // Tạo danh mục con
    for (const [parentName, subNames] of Object.entries(SUB_CATEGORIES)) {
      const parentId = categoryMap.get(parentName);

      if (parentId && createdCategories.length < count) {
        for (const subName of subNames) {
          if (createdCategories.length >= count) break;

          try {
            validateCategoryData({ name: subName });
            const slug = await createUniqueSlug(subName, Category);

            const subCategory = new Category({
              name: subName,
              slug,
              description: `Danh mục con của ${parentName}`,
              parentId,
              sortOrder: createdCategories.length,
              isActive: true
            });

            if (!dryRun) {
              const savedSubCategory = await subCategory.save();
              createdCategories.push(savedSubCategory);
            } else {
              createdCategories.push({ ...subCategory.toObject(), _id: `temp_sub_${createdCategories.length}` });
            }

            if (verbose) {
              console.log(`  📁 ${dryRun ? 'Sẽ tạo' : 'Tạo'} category con: ${subName} (cha: ${parentName})`);
            }
          } catch (error) {
            console.error(`❌ Lỗi tạo category con ${subName}:`, error.message);
          }
        }
      }
    }

    // Thêm dữ liệu ngẫu nhiên nếu cần
    if (createdCategories.length < count) {
      const remaining = count - createdCategories.length;

      for (let i = 0; i < remaining; i++) {
        const randomIndex = Math.floor(Math.random() * SAMPLE_CATEGORIES.length);
        const sample = SAMPLE_CATEGORIES[randomIndex];
        const randomSuffix = Math.floor(Math.random() * 1000);
        const name = `${sample.name} ${randomSuffix}`;

        try {
          validateCategoryData({ name });
          const slug = await createUniqueSlug(name, Category);

          const parentIds = Array.from(categoryMap.values()).filter(id => typeof id === 'string' && id.startsWith('temp_') === false);
          const parentId = Math.random() > 0.5 && parentIds.length > 0
            ? parentIds[Math.floor(Math.random() * parentIds.length)]
            : null;

          const category = new Category({
            name,
            slug,
            description: generateRandomDescription(sample.name),
            parentId,
            sortOrder: createdCategories.length,
            isActive: Math.random() > 0.1
          });

          if (!dryRun) {
            const savedCategory = await category.save();
            createdCategories.push(savedCategory);
          } else {
            createdCategories.push({ ...category.toObject(), _id: `temp_random_${i}` });
          }

          if (verbose || i % 10 === 0) {
            console.log(`🎲 ${dryRun ? 'Sẽ tạo' : 'Tạo'} category ngẫu nhiên: ${name}`);
          }
        } catch (error) {
          console.error(`❌ Lỗi tạo category ngẫu nhiên ${name}:`, error.message);
        }
      }
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'} ${createdCategories.length} categories!`);
    return createdCategories;
  } catch (error) {
    console.error('❌ Lỗi tạo categories:', error.message);
    throw error;
  }
};

// Tạo products với variants - OPTIMIZED
const generateProductsWithVariants = async (options = {}) => {
  const { products = CONFIG.DEFAULT_PRODUCTS, variants = CONFIG.DEFAULT_VARIANTS, keep = false, dryRun = false, verbose = false, categoryId, batchSize = CONFIG.BATCH_SIZE } = options;

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

    // Tạo sản phẩm theo batch để tránh treo
    let productCount = 0;

    for (const category of categoryArray) {
      if (productCount >= products) break;

      const remainingCount = products - productCount;
      const currentCount = Math.min(productsPerCategory, remainingCount);
      const templates = PRODUCT_TEMPLATES[category.name] || [];

      // Process in batches
      for (let batchStart = 0; batchStart < currentCount; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, currentCount);
        const batchProducts = [];

        // Prepare batch data
        for (let i = batchStart; i < batchEnd; i++) {
          let productData;
          let variantTemplates = [];

          if (templates.length > 0 && i < templates.length) {
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
            const randomSuffix = Math.floor(Math.random() * 1000);
            const baseName = templates.length > 0 ? templates[0].name : `Sản phẩm ${category.name}`;
            const productName = i < templates.length ? templates[i].name : `${baseName} ${randomSuffix}`;

            productData = {
              name: productName,
              brand: CATEGORY_BRANDS[category.name]?.[Math.floor(Math.random() * (CATEGORY_BRANDS[category.name]?.length || 3))] || 'Generic Brand',
              description: generateRandomDescription(productName),
              categoryId: category._id,
              isActive: Math.random() > 0.1
            };
          }

          // Generate slug without async to avoid blocking
          const slugBase = generateSlug(productData.name);
          productData.slug = `${slugBase}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          productData.image = `https://picsum.photos/seed/${productData.slug}/400/300.jpg`;

          batchProducts.push({ productData, variantTemplates });
        }

        // Process batch
        if (!dryRun) {
          // Save products in batch
          const savedProducts = await Product.insertMany(
            batchProducts.map(item => item.productData),
            { ordered: false }
          );

          createdProducts.push(...savedProducts);

          // Create variants for each product
          for (let i = 0; i < savedProducts.length; i++) {
            const savedProduct = savedProducts[i];
            const { variantTemplates } = batchProducts[i];
            const numVariants = Math.min(variantTemplates.length || variants, CONFIG.MAX_VARIANTS);
            const variantsToCreate = [];

            for (let j = 0; j < numVariants; j++) {
              let variantData;

              if (j < variantTemplates.length) {
                const templateVariant = variantTemplates[j];
                variantData = {
                  productId: savedProduct._id,
                  name: templateVariant.name,
                  sku: createUniqueSKU(savedProduct.name, templateVariant.name),
                  barcode: generateBarcode(),
                  price: templateVariant.price,
                  costPrice: Math.round(templateVariant.price * 0.7),
                  stock: Math.floor(Math.random() * 100) + 10,
                  unit: 'piece',
                  conversionValue: 1,
                  attributes: new Map(Object.entries(templateVariant.attributes)),
                  isActive: true
                };
              } else {
                const variantName = `${savedProduct.name} - Variant ${j + 1}`;
                const price = generatePrice(category.name);

                variantData = {
                  productId: savedProduct._id,
                  name: variantName,
                  sku: createUniqueSKU(savedProduct.name, `VAR${j + 1}`),
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

              // Generate slug without async
              const slugBase = generateSlug(variantData.name);
              variantData.slug = `${slugBase}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

              variantsToCreate.push(variantData);
            }

            // Save variants in batch
            if (variantsToCreate.length > 0) {
              try {
                const savedVariants = await ProductVariant.insertMany(variantsToCreate, { ordered: false });
                createdVariants.push(...savedVariants);

                if (verbose) {
                  console.log(`✅ Tạo product: ${savedProduct.name} với ${savedVariants.length} variants`);
                }
              } catch (error) {
                console.error(`❌ Lỗi tạo variants cho ${savedProduct.name}:`, error.message);
              }
            }
          }

          // Progress indicator
          if (verbose || batchEnd % 10 === 0) {
            console.log(`📦 Đã tạo ${createdProducts.length}/${products} products...`);
          }
        } else {
          // Dry run - just count
          for (const { productData, variantTemplates } of batchProducts) {
            createdProducts.push({ ...productData, _id: `temp_${productCount}` });
            const numVariants = Math.min(variantTemplates.length || variants, CONFIG.MAX_VARIANTS);

            for (let j = 0; j < numVariants; j++) {
              createdVariants.push({ _id: `temp_variant_${productCount}_${j}` });
            }

            if (verbose) {
              console.log(`📋 Sẽ tạo product: ${productData.name} với ${numVariants} variants`);
            }
          }
        }

        productCount += batchProducts.length;

        // Small delay to prevent overwhelming
        if (!dryRun && batchEnd < currentCount) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'}:`);
    console.log(`   - Products: ${createdProducts.length}`);
    console.log(`   - Variants: ${createdVariants.length}`);
    console.log(`   - Trung bình: ${(createdVariants.length / createdProducts.length).toFixed(1)} variants/product`);

    return { products: createdProducts, variants: createdVariants };
  } catch (error) {
    console.error('❌ Lỗi tạo products và variants:', error.message);
    throw error;
  }
};

// ===== MAIN FUNCTION =====

const showHelp = () => {
  console.log(`
📖 Script Tạo Dữ Liệu HOÀN CHỈNH - TỐI ƯU

Sử dụng:
  node scripts/seed-all.js [options]

Options:
  --categories [số lượng]   : Số lượng categories (default: 50)
  --products [số lượng]     : Số lượng products (default: 100)
  --variants [số lượng]     : Số lượng variants trung bình mỗi product (default: 3)
  --only [type]             : Chỉ tạo loại dữ liệu (categories/products/variants/all)
  --keep                    : Giữ lại dữ liệu cũ
  --dry-run                 : Chỉ hiển thị, không thực hiện
  --verbose                 : Hiển thị log chi tiết
  --category [id]           : Chỉ tạo cho category cụ thể
  --batch-size [size]       : Batch size cho processing (default: 100)
  --help                    : Hiển thị help này

Ví dụ:
  node scripts/seed-all.js
  node scripts/seed-all.js --categories 30 --products 200 --variants 4
  node scripts/seed-all.js --only categories
  node scripts/seed-all.js --only products --variants 5
  node scripts/seed-all.js --keep --verbose
  node scripts/seed-all.js --dry-run --categories 20 --products 50 --variants 2

Giới hạn:
  - Categories tối đa: ${CONFIG.MAX_CATEGORIES}
  - Products tối đa: ${CONFIG.MAX_PRODUCTS}
  - Variants tối đa mỗi sản phẩm: ${CONFIG.MAX_VARIANTS}
  - Batch size tối đa: 500
`);
};

const main = async () => {
  try {
    const options = parseArgs();

    if (process.argv.includes('--help')) {
      showHelp();
      return;
    }

    console.log(`🚀 Bắt đầu tạo dữ liệu...`);
    console.log(`📋 Options:`);
    console.log(`   - Categories: ${options.categories}`);
    console.log(`   - Products: ${options.products}`);
    console.log(`   - Variants per product: ${options.variants}`);
    console.log(`   - Only: ${options.only}`);
    console.log(`   - Keep: ${options.keep}`);
    console.log(`   - Dry-run: ${options.dryRun}`);
    console.log(`   - Verbose: ${options.verbose}`);
    console.log(`   - Category: ${options.categoryId || 'Tất cả'}\n`);

    if (!options.dryRun) {
      await connectDB();
    }

    let categoryResults = [];
    let productResults = { products: [], variants: [] };

    // Chỉ tạo categories
    if (options.only === 'categories') {
      categoryResults = await generateCategories(options);
    }
    // Chỉ tạo products (kiểm tra categories tồn tại)
    else if (options.only === 'products' || options.only === 'variants') {
      productResults = await generateProductsWithVariants(options);
    }
    // Tạo tất cả
    else {
      // Tạo categories trước
      console.log('📂 Tạo Categories trước...');
      categoryResults = await generateCategories(options);

      // Sau đó tạo products và variants
      console.log('\n📦 Tạo Products và Variants sau...');
      productResults = await generateProductsWithVariants(options);
    }

    // Hiển thị thống kê cuối cùng
    if (!options.dryRun) {
      console.log(`\n📊 Thống kê cuối cùng:`);

      if (options.only === 'categories' || options.only === 'all') {
        const categoryCount = await Category.countDocuments();
        console.log(`   - Total Categories: ${categoryCount}`);
      }

      if (options.only === 'products' || options.only === 'variants' || options.only === 'all') {
        const productCount = await Product.countDocuments();
        const variantCount = await ProductVariant.countDocuments();
        console.log(`   - Total Products: ${productCount}`);
        console.log(`   - Total Variants: ${variantCount}`);

        if (productCount > 0) {
          const stats = await Product.aggregate([
            { $group: { _id: '$categoryId', count: { $sum: 1 } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: '$category' },
            { $project: { categoryName: '$category.name', count: 1 } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]);

          console.log(`\n📈 Top 10 categories có nhiều products nhất:`);
          stats.forEach((stat, index) => {
            console.log(`   ${index + 1}. ${stat.categoryName}: ${stat.count} products`);
          });
        }
      }
    }

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
      process.exit(0);
    }
  }
};

// Chạy script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export cho module system
export {
  generateCategories,
  generateProductsWithVariants,
  getCategories,
  parseArgs
};

// Export cho CommonJS (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCategories,
    generateProductsWithVariants,
    getCategories,
    parseArgs
  };
}
