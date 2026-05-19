import mongoose from 'mongoose';
import Category from '../src/models/category.model.js';
import connectDB from '../src/config/db.config.js';

const CONFIG = {
  DEFAULT_COUNT: 20,
  MAX_COUNT: 100
};

const sampleCategories = [
  { name: 'Cà phê', description: 'Các loại cà phê nóng và lạnh' },
  { name: 'Trà', description: 'Các loại trà thơm ngon' },
  { name: 'Sinh tố', description: 'Sinh tố trái cây tươi' },
  { name: 'Nước ép', description: 'Nước ép trái cây' },
  { name: 'Bánh mì', description: 'Bánh mì Việt Nam' },
  { name: 'Bánh ngọt', description: 'Các loại bánh ngọt' },
  { name: 'Đồ ăn nhanh', description: 'Burger, pizza, gà rán' }
];

const subCategories = {
  'Cà phê': ['Cà phê nóng', 'Cà phê đá', 'Cà phê hạt'],
  'Trà': ['Trà nóng', 'Trà đá', 'Trà lá'],
  'Sinh tố': ['Sinh tố trái cây', 'Sinh tố sữa'],
  'Nước ép': ['Nước ép trái cây', 'Nước ép rau củ'],
  'Bánh mì': ['Bánh mì kẹp', 'Bánh mì nướng'],
  'Bánh ngọt': ['Bánh Pháp', 'Bánh Việt'],
  'Đồ ăn nhanh': ['Burger', 'Pizza', 'Gà rán']
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { count: CONFIG.DEFAULT_COUNT, keep: false, dryRun: false, verbose: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keep') options.keep = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--verbose') options.verbose = true;
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
  while (await Category.findOne({ slug })) {
    slug = `${generateSlug(name)}-${counter}`;
    counter++;
  }
  return slug;
};

const generateRandomCategories = async (options = {}) => {
  const { count = CONFIG.DEFAULT_COUNT, keep = false, dryRun = false, verbose = false } = options;
  try {
    if (!keep && !dryRun) {
      await Category.deleteMany({});
      console.log('🗑️ Đã xóa dữ liệu cũ');
    }
    const createdCategories = [];
    const categoryMap = new Map();
    
    for (const sample of sampleCategories) {
      if (createdCategories.length >= count) break;
      const slug = await createUniqueSlug(sample.name);
      const categoryData = {
        name: sample.name,
        slug,
        description: sample.description,
        parentId: null,
        sortOrder: createdCategories.length,
        isActive: true
      };
      
      if (!dryRun) {
        try {
          const category = await Category.create(categoryData);
          categoryMap.set(sample.name, category._id);
          createdCategories.push(category);
          if (verbose) console.log(`✅ ${sample.name}`);
        } catch (error) {
          console.error(`❌ ${sample.name}:`, error.message);
        }
      } else {
        createdCategories.push({ ...categoryData, _id: `temp_${createdCategories.length}` });
        categoryMap.set(sample.name, `temp_${createdCategories.length}`);
        if (verbose) console.log(`📋 ${sample.name}`);
      }
    }
    
    for (const [parentName, subNames] of Object.entries(subCategories)) {
      const parentId = categoryMap.get(parentName);
      if (parentId && createdCategories.length < count) {
        for (const subName of subNames) {
          if (createdCategories.length >= count) break;
          const slug = await createUniqueSlug(subName);
          const subCategoryData = {
            name: subName,
            slug,
            description: `Danh mục con của ${parentName}`,
            parentId,
            sortOrder: createdCategories.length,
            isActive: true
          };
          
          if (!dryRun) {
            try {
              const subCategory = await Category.create(subCategoryData);
              createdCategories.push(subCategory);
              if (verbose) console.log(`  📁 ${subName} (cha: ${parentName})`);
            } catch (error) {
              console.error(`❌ ${subName}:`, error.message);
            }
          } else {
            createdCategories.push({ ...subCategoryData, _id: `temp_sub_${createdCategories.length}` });
            if (verbose) console.log(`  📋 ${subName} (cha: ${parentName})`);
          }
        }
      }
    }
    
    console.log(`${dryRun ? '📋 DRY RUN' : '🎉'} ${createdCategories.length} categories`);
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
      console.log('Usage: node scripts/seed-categories.js [count] [--keep] [--dry-run] [--verbose]');
      return;
    }
    console.log(`🚀 Tạo ${options.count} categories...`);
    if (!options.dryRun) await connectDB();
    await generateRandomCategories(options);
    console.log('✨ Hoàn thành!');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
export { generateRandomCategories, parseArgs };