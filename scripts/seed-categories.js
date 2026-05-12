#!/usr/bin/env node

/**
 * Script tạo dữ liệu ngẫu nhiên cho Categories
 * Phiên bản cải tiến với nhiều tính năng nâng cao
 * 
 * Sử dụng:
 * node scripts/seed-categories.js [số lượng] [options]
 * 
 * Options:
 * --keep     : Giữ lại dữ liệu cũ
 * --dry-run  : Chỉ hiển thị dữ liệu sẽ tạo, không thực hiện
 * --verbose  : Hiển thị log chi tiết
 * 
 * Ví dụ:
 * node scripts/seed-categories.js 100
 * node scripts/seed-categories.js 50 --keep
 * node scripts/seed-categories.js 25 --dry-run --verbose
 */

import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';
import { generateSlug } from '../src/controllers/category.controller.js';
import connectDB from '../src/config/db.config.js';

// Cấu hình
const CONFIG = {
  DEFAULT_COUNT: 50,
  MAX_COUNT: 1000,
  BATCH_SIZE: 100
};

// Dữ liệu mẫu mở rộng cho danh mục
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

  // Dịch vụ
  { name: 'Giao hàng', description: 'Dịch vụ giao hàng và vận chuyển' },
  { name: 'Thanh toán', description: 'Dịch vụ thanh toán và tài chính' },
  { name: 'Bảo hành', description: 'Dịch vụ bảo hành và sửa chữa' },
  { name: 'Tư vấn', description: 'Dịch vụ tư vấn và hỗ trợ' },
  { name: 'Cài đặt', description: 'Dịch vụ cài đặt và thiết lập' },
  { name: 'Dọn dẹp', description: 'Dịch vụ dọn dẹp và vệ sinh' },

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

// Tên danh mục con mở rộng cho các danh mục chính
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

// Parse arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    count: CONFIG.DEFAULT_COUNT,
    keep: false,
    dryRun: false,
    verbose: false
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
    }
  }

  return options;
};


// Tạo slug duy nhất với cache
const slugCache = new Map();
const createUniqueSlug = async (name) => {
  if (slugCache.has(name)) {
    return slugCache.get(name);
  }

  let slug = generateSlug(name);
  let counter = 1;

  while (await Category.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }

  slugCache.set(name, slug);
  return slug;
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

// Validate dữ liệu
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

// Tạo dữ liệu ngẫu nhiên với batch processing
const generateRandomCategories = async (options = {}) => {
  const { count = CONFIG.DEFAULT_COUNT, keep = false, dryRun = false, verbose = false } = options;

  try {
    // Xóa dữ liệu cũ nếu không keep
    if (!keep && !dryRun) {
      await Category.deleteMany({});
      console.log('🗑️ Đã xóa dữ liệu cũ');
    } else if (keep) {
      console.log('🔄 Giữ lại dữ liệu cũ');
    }

    const createdCategories = [];
    const categoryMap = new Map();

    // Tạo danh mục chính với batch processing
    const parentCategories = sampleCategories.slice(0, Math.min(count, sampleCategories.length));

    for (let i = 0; i < parentCategories.length; i++) {
      const sample = parentCategories[i];

      try {
        validateCategoryData(sample);
        const slug = await createUniqueSlug(sample.name);

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
          console.log(`✅ ${dryRun ? 'Sẽ tạo' : 'Tạo'} danh mục: ${sample.name}`);
        } else {
          console.log(`✅ ${dryRun ? 'Sẽ tạo' : 'Tạo'} danh mục: ${sample.name}`);
        }
      } catch (error) {
        console.error(`❌ Lỗi tạo danh mục ${sample.name}:`, error.message);
      }
    }

    // Tạo danh mục con với validation
    for (const [parentName, subNames] of Object.entries(subCategories)) {
      const parentId = categoryMap.get(parentName);

      if (parentId && createdCategories.length < count) {
        for (const subName of subNames) {
          if (createdCategories.length >= count) break;

          try {
            validateCategoryData({ name: subName });
            const slug = await createUniqueSlug(subName);

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
              console.log(`  📁 ${dryRun ? 'Sẽ tạo' : 'Tạo'} danh mục con: ${subName} (cha: ${parentName})`);
            } else {
              console.log(`  📁 ${dryRun ? 'Sẽ tạo' : 'Tạo'} danh mục con: ${subName}`);
            }
          } catch (error) {
            console.error(`❌ Lỗi tạo danh mục con ${subName}:`, error.message);
          }
        }
      }
    }

    // Thêm dữ liệu ngẫu nhiên nếu cần thêm với batch processing
    if (createdCategories.length < count) {
      const remaining = count - createdCategories.length;
      const batchSize = Math.min(CONFIG.BATCH_SIZE, remaining);

      for (let i = 0; i < remaining; i++) {
        const randomIndex = Math.floor(Math.random() * sampleCategories.length);
        const sample = sampleCategories[randomIndex];
        const randomSuffix = Math.floor(Math.random() * 1000);
        const name = `${sample.name} ${randomSuffix}`;

        try {
          validateCategoryData({ name });
          const slug = await createUniqueSlug(name);

          // Chọn ngẫu nhiên một danh mục cha hoặc null
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
            isActive: Math.random() > 0.1 // 90% active
          });

          if (!dryRun) {
            const savedCategory = await category.save();
            createdCategories.push(savedCategory);
          } else {
            createdCategories.push({ ...category.toObject(), _id: `temp_random_${i}` });
          }

          if (verbose || i % 10 === 0) {
            console.log(`🎲 ${dryRun ? 'Sẽ tạo' : 'Tạo'} danh mục ngẫu nhiên: ${name}`);
          }
        } catch (error) {
          console.error(`❌ Lỗi tạo danh mục ngẫu nhiên ${name}:`, error.message);
        }
      }
    }

    console.log(`\n${dryRun ? '📋 DRY RUN - Sẽ tạo' : '🎉 Đã tạo thành công'} ${createdCategories.length} danh mục!`);

    // Hiển thị thống kê
    let stats, subStats;
    if (!dryRun) {
      stats = await Category.aggregate([
        { $match: { parentId: null } },
        { $count: 'parentCategories' }
      ]);

      subStats = await Category.aggregate([
        { $match: { parentId: { $ne: null } } },
        { $count: 'subCategories' }
      ]);
    } else {
      // Tính toán cho dry run
      stats = [{ parentCategories: createdCategories.filter(c => !c.parentId).length }];
      subStats = [{ subCategories: createdCategories.filter(c => c.parentId).length }];
    }

    console.log(`📊 Thống kê:`);
    console.log(`   - Danh mục cha: ${stats[0]?.parentCategories || 0}`);
    console.log(`   - Danh mục con: ${subStats[0]?.subCategories || 0}`);
    console.log(`   - Tổng cộng: ${createdCategories.length}`);
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
📖 Script Tạo Dữ Liệu Categories

Sử dụng:
  node scripts/seed-categories.js [số lượng] [options]

Options:
  --keep     : Giữ lại dữ liệu cũ
  --dry-run  : Chỉ hiển thị, không thực hiện
  --verbose  : Hiển thị log chi tiết
  --help     : Hiển thị help này

Ví dụ:
  node scripts/seed-categories.js 100
  node scripts/seed-categories.js 50 --keep
  node scripts/seed-categories.js 25 --dry-run --verbose

Giới hạn:
  - Số lượng tối đa: ${CONFIG.MAX_COUNT}
  - Batch size: ${CONFIG.BATCH_SIZE}
`);
};

// Main function với error handling tốt hơn
const main = async () => {
  try {
    const options = parseArgs();

    // Hiển thị help
    if (process.argv.includes('--help')) {
      showHelp();
      return;
    }

    console.log(`🚀 Bắt đầu tạo ${options.count} danh mục ngẫu nhiên...`);
    console.log(`📋 Options: keep=${options.keep}, dry-run=${options.dryRun}, verbose=${options.verbose}\n`);

    if (!options.dryRun) {
      await connectDB();
    }

    await generateRandomCategories(options);

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
  generateRandomCategories,
  connectDB,
  parseArgs,
  validateCategoryData,
  generateRandomDescription
};

// Export cho CommonJS (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateRandomCategories,
    connectDB,
    parseArgs,
    validateCategoryData,
    generateRandomDescription
  };
}
