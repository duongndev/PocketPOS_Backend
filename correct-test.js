// Test đúng cho chức năng tìm kiếm

const removeVietnameseDiacritics = (text) => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, d => d === 'đ' ? 'd' : 'D');
};

const createAdvancedSearchQuery = (searchTerm) => {
  if (!searchTerm) return null;
  
  const cleanedTerm = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const termWithoutDiacritics = removeVietnameseDiacritics(cleanedTerm);
  
  console.log(`Original: "${searchTerm}"`);
  console.log(`Cleaned: "${cleanedTerm}"`);
  console.log(`Without diacritics: "${termWithoutDiacritics}"`);
  
  // Tạo query tìm kiếm cả có dấu và không dấu
  return {
    $or: [
      { name: { $regex: new RegExp(cleanedTerm, 'gi') } },
      { name: { $regex: new RegExp(termWithoutDiacritics, 'gi') } },
      { description: { $regex: new RegExp(cleanedTerm, 'gi') } },
      { description: { $regex: new RegExp(termWithoutDiacritics, 'gi') } }
    ]
  };
};

// Sample data
const sampleData = [
  { name: 'Đồ uống', description: 'Các loại đồ uống giải khát' },
  { name: 'Cà phê', description: 'Cà phê ngon' },
  { name: 'Đồ ăn nhanh', description: 'Các món ăn nhanh' },
  { name: 'Trà sữa', description: 'Trà sữa các loại' }
];

// Test cases
const tests = [
  'đồ uống',
  'do uong',
  'cà phê', 
  'ca phe',
  'đồ ăn',
  'do an'
];

console.log('=== TEST TÌM KIẾM THỂ LOẠI ===\n');

tests.forEach((searchTerm, index) => {
  console.log(`${index + 1}. Testing search: "${searchTerm}"`);
  console.log('---');
  
  const query = createAdvancedSearchQuery(searchTerm);
  
  // Test each condition - lấy regex object từ $regex
  const matches = [];
  
  query.$or.forEach((condition, condIndex) => {
    const field = Object.keys(condition)[0];
    const regex = condition[field].$regex; // Lấy regex object từ $regex
    
    console.log(`   Condition ${condIndex + 1}: ${field} regex = ${regex}`);
    
    sampleData.forEach(item => {
      if (regex.test(item[field])) {
        matches.push(`${item.name} (${field})`);
      }
    });
  });
  
  console.log(`   Matches: ${[...new Set(matches)].join(', ')}`);
  console.log('');
});
