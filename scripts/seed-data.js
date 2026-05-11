#!/usr/bin/env node

/**
 * Script tạo dữ liệu ngẫu nhiên cho Categories và Products
 * Phiên bản gộp - Tạo categories trước, sau đó tạo products
 * 
 * Sử dụng:
 * node scripts/seed-data.js [options]
 * 
 * Options:
 * --categories [số lượng] : Số lượng categories (default: 50)
 * --products [số lượng]   : Số lượng products (default: 100)
 * --keep                  : Giữ lại dữ liệu cũ
 * --dry-run              : Chỉ hiển thị dữ liệu sẽ tạo, không thực hiện
 * --verbose              : Hiển thị log chi tiết
 * --categories-only      : Chỉ tạo categories
 * --products-only        : Chỉ tạo products (yêu cầu categories đã tồn tại)
 * 
 * Ví dụ:
 * node scripts/seed-data.js
 * node scripts/seed-data.js --categories 20 --products 200
 * node scripts/seed-data.js --keep --verbose
 * node scripts/seed-data.js --categories-only
 * node scripts/seed-data.js --products-only
 */

import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';
import Product from '../src/models/product.model.js';
import { generateSlug } from '../src/controllers/category.controller.js';
import connectDB from '../src/config/db.config.js';

// Cấu hình
const CONFIG = {
  DEFAULT_CATEGORIES: 50,
  DEFAULT_PRODUCTS: 100,
  MAX_CATEGORIES: 1000,
  MAX_PRODUCTS: 5000,
  BATCH_SIZE: 100
};

// Dữ liệu mẫu cho danh mục
const sampleCategories = [
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

// Tên danh mục con
const subCategories = {
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
    { name: 'Nước ép táo', brand: 'Fresh Plus', description: 'Nước ép táo ngọt lành' },
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
    categories: CONFIG.DEFAULT_CATEGORIES,
    products: CONFIG.DEFAULT_PRODUCTS,
    keep: false,
    dryRun: false,
    verbose: false,
    categoriesOnly: false,
    productsOnly: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--categories' && i + 1 < args.length) {
      options.categories = Math.min(parseInt(args[i + 1]), CONFIG.MAX_CATEGORIES);
      i++;
    } else if (arg === '--products' && i + 1 < args.length) {
      options.products = Math.min(parseInt(args[i + 1]), CONFIG.MAX_PRODUCTS);
      i++;
    } else if (arg === '--keep') {
      options.keep = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--categories-only') {
      options.categoriesOnly = true;
    } else if (arg === '--products-only') {
      options.productsOnly = true;
    }
  }

  return options;
};

// Tạo slug duy nhất cho category
const categorySlugCache = new Map();
const createUniqueCategorySlug = async (name) => {
  if (categorySlugCache.has(name)) {
    return categorySlugCache.get(name);
  }

  let slug = generateSlug(name);
  let counter = 1;

  while (await Category.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  categorySlugCache.set(name, slug);
  return slug;
};

// Tạo slug duy nhất cho product
const productSlugCache = new Map();
const createUniqueProductSlug = async (name) => {
  if (productSlugCache.has(name)) {
    return productSlugCache.get(name);
  }

  let slug = generateSlug(name);
  let counter = 1;

  while (await Product.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  productSlugCache.set(name, slug);
  return slug;
};

// Validate dữ liệu category
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

// Tạo dữ liệu ngẫu nhiên cho description
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

// Tạo categories
const generateCategories = async (options = {}) => {
  const { count = CONFIG.DEFAULT_CATEGORIES, keep = false, dryRun = false, verbose = false } = options;

  try {
    // Xóa dữ liệu cũ nếu không keep
    if (!keep && !dryRun) {
      await Category.deleteMany({});
      console.log('🗑️ Đã xóa dữ liệu categories cũ');
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu categories cũ');
    }

    const createdCategories = [];
    const categoryMap = new Map();

    // Tạo danh mục chính
    const parentCategories = sampleCategories.slice(0, Math.min(count, sampleCategories.length));

    for (let i = 0; i < parentCategories.length; i++) {
      const sample = parentCategories[i];

      try {
        validateCategoryData(sample);
        const slug = await createUniqueCategorySlug(sample.name);

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
    for (const [parentName, subNames] of Object.entries(subCategories)) {
      const parentId = categoryMap.get(parentName);

      if (parentId && createdCategories.length < count) {
        for (const subName of subNames) {
          if (createdCategories.length >= count) break;

          try {
            validateCategoryData({ name: subName });
            const slug = await createUniqueCategorySlug(subName);

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
        const randomIndex = Math.floor(Math.random() * sampleCategories.length);
        const sample = sampleCategories[randomIndex];
        const randomSuffix = Math.floor(Math.random() * 1000);
        const name = `${sample.name} ${randomSuffix}`;

        try {
          validateCategoryData({ name });
          const slug = await createUniqueCategorySlug(name);

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

// Tạo products cho categories
const generateProducts = async (options = {}) => {
  const { count = CONFIG.DEFAULT_PRODUCTS, keep = false, dryRun = false, verbose = false } = options;

  try {
    // Kiểm tra categories đã tồn tại
    const categories = await Category.find({ isActive: true });
    
    if (!categories || categories.length === 0) {
      console.error('❌ Không tìm thấy category nào! Vui lòng tạo categories trước.');
      if (!dryRun) {
        console.log('💡 Gợi ý: Chạy script với --categories-only trước, hoặc không dùng --products-only');
      }
      return [];
    }

    // Xóa dữ liệu cũ nếu không keep
    if (!keep && !dryRun) {
      await Product.deleteMany({});
      console.log('🗑️ Đã xóa dữ liệu products cũ');
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu products cũ');
    }

    const productsPerCategory = Math.ceil(count / categories.length);
    const createdProducts = [];

    console.log(`📦 Tạo products cho ${categories.length} categories...`);

    // Tạo sản phẩm cho từng category
    for (const category of categories) {
      if (createdProducts.length >= count) break;
      
      const remainingCount = count - createdProducts.length;
      const currentCount = Math.min(productsPerCategory, remainingCount);
      
      // Lấy template cho category này
      const templates = productTemplates[category.name] || [];
      const brands = categoryBrands[category.name] || ['Generic Brand', 'Local Brand', 'Import Brand'];
      
      // Tạo số lượng sản phẩm
      for (let i = 0; i < currentCount; i++) {
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
            isActive: Math.random() > 0.1
          };
        }
        
        // Thêm slug
        productData.slug = await createUniqueProductSlug(productData.name);
        
        // Thêm image URL ngẫu nhiên
        productData.image = `https://picsum.photos/seed/${productData.slug}/400/300.jpg`;
        
        if (!dryRun) {
          try {
            const product = new Product(productData);
            const savedProduct = await product.save();
            createdProducts.push(savedProduct);
            
            if (verbose) {
              console.log(`✅ Tạo product: ${productData.name} (${category.name})`);
            }
          } catch (error) {
            console.error(`❌ Lỗi tạo product ${productData.name}:`, error.message);
          }
        } else {
          createdProducts.push({ ...productData, _id: `temp_${i}` });
          if (verbose) {
            console.log(`📋 Sẽ tạo product: ${productData.name} (${category.name})`);
          }
        }
      }
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'} ${createdProducts.length} products!`);
    return createdProducts;
  } catch (error) {
    console.error('❌ Lỗi tạo products:', error.message);
    throw error;
  }
};

// Hiển thị help
const showHelp = () => {
  console.log(`
📖 Script Tạo Dữ Liệu Categories và Products

Sử dụng:
  node scripts/seed-data.js [options]

Options:
  --categories [số lượng] : Số lượng categories (default: 50)
  --products [số lượng]   : Số lượng products (default: 100)
  --keep                  : Giữ lại dữ liệu cũ
  --dry-run              : Chỉ hiển thị, không thực hiện
  --verbose              : Hiển thị log chi tiết
  --categories-only      : Chỉ tạo categories
  --products-only        : Chỉ tạo products (yêu cầu categories đã tồn tại)
  --help                 : Hiển thị help này

Ví dụ:
  node scripts/seed-data.js
  node scripts/seed-data.js --categories 20 --products 200
  node scripts/seed-data.js --keep --verbose
  node scripts/seed-data.js --categories-only
  node scripts/seed-data.js --products-only

Giới hạn:
  - Categories tối đa: ${CONFIG.MAX_CATEGORIES}
  - Products tối đa: ${CONFIG.MAX_PRODUCTS}
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

    console.log(`🚀 Bắt đầu tạo dữ liệu...`);
    console.log(`📋 Options:`);
    console.log(`   - Categories: ${options.categories}`);
    console.log(`   - Products: ${options.products}`);
    console.log(`   - Keep: ${options.keep}`);
    console.log(`   - Dry-run: ${options.dryRun}`);
    console.log(`   - Verbose: ${options.verbose}`);
    console.log(`   - Categories only: ${options.categoriesOnly}`);
    console.log(`   - Products only: ${options.productsOnly}\n`);

    if (!options.dryRun) {
      await connectDB();
    }

    // Chỉ tạo categories
    if (options.categoriesOnly) {
      await generateCategories(options);
    }
    // Chỉ tạo products (kiểm tra categories tồn tại)
    else if (options.productsOnly) {
      await generateProducts(options);
    }
    // Tạo cả categories và products
    else {
      // Tạo categories trước
      console.log('📂 Tạo Categories trước...');
      await generateCategories(options);
      
      // Sau đó tạo products
      console.log('\n📦 Tạo Products sau...');
      await generateProducts(options);
    }

    // Hiển thị thống kê cuối cùng
    if (!options.dryRun && !options.categoriesOnly) {
      const categoryCount = await Category.countDocuments();
      const productCount = await Product.countDocuments();
      
      console.log(`\n📊 Thống kê cuối cùng:`);
      console.log(`   - Total Categories: ${categoryCount}`);
      console.log(`   - Total Products: ${productCount}`);
      
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
  generateCategories,
  generateProducts,
  parseArgs
};

// Export cho CommonJS (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateCategories,
    generateProducts,
    parseArgs
  };
}
