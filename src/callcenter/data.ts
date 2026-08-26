// ========================================
// بيانات نظام كول سنتر المطاعم
// ========================================

// ========== الموظفين ==========
const EMPLOYEES = [
  { id: 1, name: 'آية عصام', username: 'aya', password: 'aya123', role: 'agent', branch: 'all' },
  { id: 2, name: 'سارة أحمد', username: 'sara', password: 'sara123', role: 'agent', branch: 'all' },
  { id: 3, name: 'نور محمد', username: 'noor', password: 'noor123', role: 'agent', branch: 'all' },
  { id: 4, name: 'محمد خالد', username: 'mohamed', password: 'mo123', role: 'supervisor', branch: 'all' },
  { id: 5, name: 'المدير', username: 'admin', password: 'admin123', role: 'admin', branch: 'all' }
];

// ========== السائقين ==========
const DRIVERS = [
  { id: 101, name: 'أحمد علي',     phone: '99887766', branchId: 1 },
  { id: 102, name: 'يوسف محمود',  phone: '99887755', branchId: 1 },
  { id: 103, name: 'محمود سعيد',  phone: '99887744', branchId: 2 },
  { id: 104, name: 'خالد عبدالله', phone: '99887733', branchId: 2 },
  { id: 105, name: 'عمر إبراهيم', phone: '99887722', branchId: 3 },
  { id: 106, name: 'علي حسن',     phone: '99887711', branchId: 3 },
  { id: 107, name: 'حسين سامي',   phone: '99887700', branchId: 4 },
  { id: 108, name: 'مصطفى نبيل',  phone: '99886699', branchId: 4 },
  { id: 109, name: 'كريم رضا',    phone: '99886688', branchId: 5 },
  { id: 110, name: 'سامح فؤاد',   phone: '99886677', branchId: 5 }
];

// ========== الفروع ==========
const BRANCHES = [
  {
    id: 1,
    name: 'فرع أم الهيمان',
    areas: ['أم الهيمان', 'الفنطاس', 'المهبولة', 'أبو حليفة', 'الفحيحيل', 'المنقف', 'الأحمدي', 'صباح الأحمد', 'الرقة', 'هدية']
  },
  {
    id: 2,
    name: 'فرع سعد العبدالله',
    areas: ['سعد العبدالله', 'جليب الشيوخ', 'الفردوس', 'خيطان', 'الرابية', 'الأندلس', 'اشبيلية', 'الحساوي', 'العمرية', 'الصليبيخات']
  },
  {
    id: 3,
    name: 'فرع حطين',
    areas: ['حطين', 'السلام', 'الشهداء', 'المسيلة', 'صباح السالم', 'الفنيطيس', 'العدان', 'القرين', 'القصور', 'المسايل']
  },
  {
    id: 4,
    name: 'فرع الزهراء',
    areas: ['الزهراء', 'حولي', 'السالمية', 'الجابرية', 'الرميثية', 'بيان', 'مشرف', 'سلوى', 'الشعب', 'الصديق']
  },
  {
    id: 5,
    name: 'فرع الخالدية',
    areas: ['الخالدية', 'كيفان', 'الشامية', 'الدعية', 'العديلية', 'القادسية', 'الدسمة', 'المنصورية', 'بنيد القار', 'الصوابر']
  }
];

// ========== تصنيفات المنيو ==========
const MENU_CATEGORIES = [
  { id: 'all',        name: 'عرض الكل',    nameEn: 'View All',     icon: '📋', color: '#6b7280' },
  { id: 'juices',     name: 'عصائر طازجة', nameEn: 'Fresh Juices', icon: '🍊', color: '#f97316',
    imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=240&h=240&fit=crop&q=80' },
  { id: 'cocktails',  name: 'كوكتيلات',    nameEn: 'Cocktails',    icon: '🍹', color: '#ec4899',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=240&h=240&fit=crop&q=80' },
  { id: 'milkshakes', name: 'ميلك شيك',    nameEn: 'Milkshakes',   icon: '🥤', color: '#8b5cf6',
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=240&h=240&fit=crop&q=80' },
  { id: 'waffles',    name: 'وافل',        nameEn: 'Waffles',      icon: '🧇', color: '#eab308',
    imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=240&h=240&fit=crop&q=80' },
  { id: 'pancakes',   name: 'بان كيك',     nameEn: 'Pancakes',     icon: '🥞', color: '#f59e0b',
    imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=240&h=240&fit=crop&q=80' },
  { id: 'crepes',     name: 'كريب',        nameEn: 'Crepes',       icon: '🥯', color: '#d97706',
    imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=240&h=240&fit=crop&q=80' },
  { id: 'icecream',   name: 'آيس كريم',   nameEn: 'Ice Cream',     icon: '🍦', color: '#06b6d4',
    imageUrl: 'https://images.unsplash.com/photo-1576506542790-51244b486a6b?w=240&h=240&fit=crop&q=80' },
  { id: 'coffee',     name: 'قهوة',        nameEn: 'Coffee',        icon: '☕', color: '#78350f',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=240&h=240&fit=crop&q=80' },
  { id: 'molten',     name: 'مولتن كيك',   nameEn: 'Molten Cake',   icon: '🍰', color: '#7c2d12',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=240&h=240&fit=crop&q=80' }
];

// ========== أصناف المنيو ==========
const MENU_ITEMS = [
  // === عصائر طازجة ===
  { id: 101, categoryId: 'juices', name: 'عصير برتقال طازج', nameEn: 'Fresh Orange Juice', price: 0.750, description: 'برتقال طبيعي ١٠٠٪', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [0.750, 1.000, 1.250, 1.500, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=300&fit=crop&q=80' },
  { id: 102, categoryId: 'juices', name: 'عصير ليمون بالنعناع', nameEn: 'Lemon Mint', price: 0.850, description: 'ليمون طازج مع نعناع أخضر', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [0.850, 1.100, 1.350, 1.600, 2.600],
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=300&h=300&fit=crop&q=80' },
  { id: 103, categoryId: 'juices', name: 'عصير مانجو', nameEn: 'Mango Juice', price: 1.000, description: 'مانجو طازج بدون سكر', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.000, 1.250, 1.500, 1.750, 2.750],
    imageUrl: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=300&h=300&fit=crop&q=80' },
  { id: 104, categoryId: 'juices', name: 'عصير فراولة', nameEn: 'Strawberry Juice', price: 1.000, description: 'فراولة طازجة', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.000, 1.250, 1.500, 1.750, 2.750],
    imageUrl: 'https://images.unsplash.com/photo-1591567306029-f0303f9a3b30?w=300&h=300&fit=crop&q=80' },
  { id: 105, categoryId: 'juices', name: 'عصير أناناس', nameEn: 'Pineapple Juice', price: 1.000, description: 'أناناس طبيعي', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.000, 1.250, 1.500, 1.750, 2.750],
    imageUrl: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=300&h=300&fit=crop&q=80' },
  { id: 106, categoryId: 'juices', name: 'عصير جوافة', nameEn: 'Guava Juice', price: 0.850, description: 'جوافة بالحليب', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [0.850, 1.100, 1.350, 1.600, 2.600],
    imageUrl: 'https://images.unsplash.com/photo-1577003833619-76bbd7f82948?w=300&h=300&fit=crop&q=80' },
  { id: 107, categoryId: 'juices', name: 'عصير كيوي', nameEn: 'Kiwi Juice', price: 1.000, description: 'كيوي طازج', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.000, 1.250, 1.500, 1.750, 2.750],
    imageUrl: 'https://images.unsplash.com/photo-1585059895524-72359e06133a?w=300&h=300&fit=crop&q=80' },
  { id: 108, categoryId: 'juices', name: 'عصير بطيخ', nameEn: 'Watermelon Juice', price: 0.750, description: 'بطيخ طازج مبرد', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [0.750, 1.000, 1.250, 1.500, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1571575173700-afb9492e6a50?w=300&h=300&fit=crop&q=80' },

  // === كوكتيلات ===
  { id: 201, categoryId: 'cocktails', name: 'كوكتيل فواكه مشكلة', nameEn: 'Mixed Fruits Cocktail', price: 1.500, description: 'مزيج فواكه موسمية', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.250, 1.500, 1.750, 2.000, 3.500],
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300&h=300&fit=crop&q=80' },
  { id: 202, categoryId: 'cocktails', name: 'كوكتيل مانجو بالفراولة', nameEn: 'Mango Strawberry', price: 1.500, description: 'مانجو مع فراولة طازجة', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.250, 1.500, 1.750, 2.000, 3.500],
    imageUrl: 'https://images.unsplash.com/photo-1551538885-1a8e88dbbf3d?w=300&h=300&fit=crop&q=80' },
  { id: 203, categoryId: 'cocktails', name: 'كوكتيل أفوكادو', nameEn: 'Avocado Cocktail', price: 1.750, description: 'أفوكادو طازج بالعسل', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.500, 1.750, 2.000, 2.250, 4.000],
    imageUrl: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300&h=300&fit=crop&q=80' },
  { id: 204, categoryId: 'cocktails', name: 'كوكتيل موز بالحليب', nameEn: 'Banana Milk', price: 1.250, description: 'موز طبيعي بالحليب الطازج', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.000, 1.250, 1.500, 1.750, 3.000],
    imageUrl: 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=300&h=300&fit=crop&q=80' },
  { id: 205, categoryId: 'cocktails', name: 'كوكتيل توت مشكل', nameEn: 'Mixed Berry', price: 1.500, description: 'توت أزرق وأحمر وفراولة', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.250, 1.500, 1.750, 2.000, 3.500],
    imageUrl: 'https://images.unsplash.com/photo-1612203284663-c9c3a7e6f4ab?w=300&h=300&fit=crop&q=80' },
  { id: 206, categoryId: 'cocktails', name: 'كوكتيل استوائي', nameEn: 'Tropical Cocktail', price: 1.750, description: 'مانجو وأناناس وجوز الهند', sizes: ['صغير', 'وسط', 'كبير', 'نص لتر', 'لتر ونص'], sizePrices: [1.500, 1.750, 2.000, 2.250, 4.000],
    imageUrl: 'https://images.unsplash.com/photo-1502740479091-635887520276?w=300&h=300&fit=crop&q=80' },

  // === ميلك شيك ===
  { id: 301, categoryId: 'milkshakes', name: 'ميلك شيك شوكولاتة', nameEn: 'Chocolate Milkshake', price: 1.500, description: 'شوكولاتة بلجيكية غنية', sizes: ['عادي', 'كبير'], sizePrices: [1.500, 2.250],
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=300&fit=crop&q=80' },
  { id: 302, categoryId: 'milkshakes', name: 'ميلك شيك فراولة', nameEn: 'Strawberry Milkshake', price: 1.500, description: 'فراولة طازجة مع آيس كريم', sizes: ['عادي', 'كبير'], sizePrices: [1.500, 2.250],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop&q=80' },
  { id: 303, categoryId: 'milkshakes', name: 'ميلك شيك فانيلا', nameEn: 'Vanilla Milkshake', price: 1.250, description: 'فانيلا طبيعية كريمية', sizes: ['عادي', 'كبير'], sizePrices: [1.250, 2.000],
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop&q=80' },
  { id: 304, categoryId: 'milkshakes', name: 'ميلك شيك أوريو', nameEn: 'Oreo Milkshake', price: 1.750, description: 'أوريو مع آيس كريم فانيلا', sizes: ['عادي', 'كبير'], sizePrices: [1.750, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1568901839119-631418a3910d?w=300&h=300&fit=crop&q=80' },
  { id: 305, categoryId: 'milkshakes', name: 'ميلك شيك لوتس', nameEn: 'Lotus Milkshake', price: 1.750, description: 'بسكويت لوتس مع كراميل', sizes: ['عادي', 'كبير'], sizePrices: [1.750, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=300&fit=crop&q=80' },
  { id: 306, categoryId: 'milkshakes', name: 'ميلك شيك كراميل', nameEn: 'Caramel Milkshake', price: 1.500, description: 'كراميل مع آيس كريم', sizes: ['عادي', 'كبير'], sizePrices: [1.500, 2.250],
    imageUrl: 'https://images.unsplash.com/photo-1576506542790-51244b486a6b?w=300&h=300&fit=crop&q=80' },

  // === وافل ===
  { id: 401, categoryId: 'waffles', name: 'وافل شوكولاتة', nameEn: 'Chocolate Waffle', price: 2.000, description: 'وافل مقرمش مع صوص شوكولاتة', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=300&h=300&fit=crop&q=80' },
  { id: 402, categoryId: 'waffles', name: 'وافل نوتيلا', nameEn: 'Nutella Waffle', price: 2.250, description: 'وافل مع نوتيلا وبندق', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1568051243857-fff5c8c0fb27?w=300&h=300&fit=crop&q=80' },
  { id: 403, categoryId: 'waffles', name: 'وافل لوتس', nameEn: 'Lotus Waffle', price: 2.250, description: 'وافل مع صوص لوتس وبسكويت', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1581398045906-23f5dec57b81?w=300&h=300&fit=crop&q=80' },
  { id: 404, categoryId: 'waffles', name: 'وافل فواكه طازجة', nameEn: 'Fresh Fruit Waffle', price: 2.500, description: 'وافل مع فواكه موسمية وكريمة', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=300&h=300&fit=crop&q=80' },
  { id: 405, categoryId: 'waffles', name: 'وافل كراميل', nameEn: 'Caramel Waffle', price: 2.000, description: 'وافل مع صوص كراميل مملح', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=300&h=300&fit=crop&q=80' },
  { id: 406, categoryId: 'waffles', name: 'وافل آيس كريم', nameEn: 'Ice Cream Waffle', price: 2.750, description: 'وافل مع سكوبين آيس كريم', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=300&h=300&fit=crop&q=80' },

  // === بان كيك ===
  { id: 501, categoryId: 'pancakes', name: 'بان كيك شوكولاتة', nameEn: 'Chocolate Pancake', price: 1.750, description: 'بان كيك مع صوص شوكولاتة', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=300&h=300&fit=crop&q=80' },
  { id: 502, categoryId: 'pancakes', name: 'بان كيك نوتيلا', nameEn: 'Nutella Pancake', price: 2.000, description: 'بان كيك مع نوتيلا وموز', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1554926011-fe9adea3bf6b?w=300&h=300&fit=crop&q=80' },
  { id: 503, categoryId: 'pancakes', name: 'بان كيك لوتس', nameEn: 'Lotus Pancake', price: 2.000, description: 'بان كيك مع صوص وبسكويت لوتس', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1565299543923-37dd37887442?w=300&h=300&fit=crop&q=80' },
  { id: 504, categoryId: 'pancakes', name: 'بان كيك بالفواكه', nameEn: 'Fruit Pancake', price: 2.250, description: 'بان كيك مع فواكه طازجة وعسل', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=300&fit=crop&q=80' },
  { id: 505, categoryId: 'pancakes', name: 'بان كيك كراميل', nameEn: 'Caramel Pancake', price: 1.750, description: 'بان كيك مع صوص كراميل', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=300&h=300&fit=crop&q=80' },
  { id: 506, categoryId: 'pancakes', name: 'بان كيك عسل', nameEn: 'Honey Pancake', price: 1.500, description: 'بان كيك كلاسيك مع عسل طبيعي', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1554520735-0a6b8b6ce8b7?w=300&h=300&fit=crop&q=80' },

  // === كريب ===
  { id: 601, categoryId: 'crepes', name: 'كريب شوكولاتة', nameEn: 'Chocolate Crepe', price: 1.750, description: 'كريب فرنسي مع صوص شوكولاتة بلجيكية', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=300&h=300&fit=crop&q=80' },
  { id: 602, categoryId: 'crepes', name: 'كريب نوتيلا بالموز', nameEn: 'Nutella Banana Crepe', price: 2.000, description: 'كريب مع نوتيلا وشرائح موز', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=300&fit=crop&q=80' },
  { id: 603, categoryId: 'crepes', name: 'كريب لوتس', nameEn: 'Lotus Crepe', price: 2.000, description: 'كريب مع صوص لوتس وبسكويت مكسر', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=300&fit=crop&q=80' },
  { id: 604, categoryId: 'crepes', name: 'كريب فواكه طازجة', nameEn: 'Fresh Fruit Crepe', price: 2.250, description: 'كريب مع فواكه موسمية وكريمة', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=300&h=300&fit=crop&q=80' },
  { id: 605, categoryId: 'crepes', name: 'كريب جبن بالعسل', nameEn: 'Cheese Honey Crepe', price: 1.750, description: 'كريب مع جبن كريمي وعسل طبيعي', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=300&h=300&fit=crop&q=80' },
  { id: 606, categoryId: 'crepes', name: 'كريب كراميل بالتفاح', nameEn: 'Caramel Apple Crepe', price: 2.000, description: 'كريب مع تفاح مكرمل وقرفة', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=300&fit=crop&q=80' },

  // === آيس كريم ===
  { id: 701, categoryId: 'icecream', name: 'آيس كريم فانيلا', nameEn: 'Vanilla Ice Cream', price: 0.750, description: 'فانيلا طبيعية كريمية - سكوب واحد', sizes: ['سكوب', 'سكوبين', 'ثلاث سكوب'], sizePrices: [0.750, 1.250, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop&q=80' },
  { id: 702, categoryId: 'icecream', name: 'آيس كريم شوكولاتة', nameEn: 'Chocolate Ice Cream', price: 0.750, description: 'شوكولاتة بلجيكية فاخرة', sizes: ['سكوب', 'سكوبين', 'ثلاث سكوب'], sizePrices: [0.750, 1.250, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=300&fit=crop&q=80' },
  { id: 703, categoryId: 'icecream', name: 'آيس كريم فراولة', nameEn: 'Strawberry Ice Cream', price: 0.750, description: 'فراولة طازجة مع كريمة', sizes: ['سكوب', 'سكوبين', 'ثلاث سكوب'], sizePrices: [0.750, 1.250, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&h=300&fit=crop&q=80' },
  { id: 704, categoryId: 'icecream', name: 'آيس كريم بستاشيو', nameEn: 'Pistachio Ice Cream', price: 1.000, description: 'بستاشيو إيراني فاخر', sizes: ['سكوب', 'سكوبين', 'ثلاث سكوب'], sizePrices: [1.000, 1.750, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1633933037036-4fef9b41dfdd?w=300&h=300&fit=crop&q=80' },
  { id: 705, categoryId: 'icecream', name: 'آيس كريم لوتس', nameEn: 'Lotus Ice Cream', price: 1.000, description: 'بسكويت لوتس مع كاراميل', sizes: ['سكوب', 'سكوبين', 'ثلاث سكوب'], sizePrices: [1.000, 1.750, 2.500],
    imageUrl: 'https://images.unsplash.com/photo-1505394033641-40c6ad1178bd?w=300&h=300&fit=crop&q=80' },
  { id: 706, categoryId: 'icecream', name: 'بانانا سبليت', nameEn: 'Banana Split', price: 2.500, description: 'موز مع 3 سكوبات آيس كريم وصوصات', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=300&h=300&fit=crop&q=80' },
  { id: 707, categoryId: 'icecream', name: 'صانداي شوكولاتة', nameEn: 'Chocolate Sundae', price: 2.000, description: 'آيس كريم مع صوص شوكولاتة ومكسرات', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=300&h=300&fit=crop&q=80' },

  // === قهوة ===
  { id: 801, categoryId: 'coffee', name: 'إسبريسو', nameEn: 'Espresso', price: 0.750, description: 'قهوة إيطالية أصلية مركزة', sizes: ['سنجل', 'دبل'], sizePrices: [0.750, 1.000],
    imageUrl: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=300&h=300&fit=crop&q=80' },
  { id: 802, categoryId: 'coffee', name: 'كابتشينو', nameEn: 'Cappuccino', price: 1.250, description: 'إسبريسو مع رغوة حليب كثيفة', sizes: ['وسط', 'كبير'], sizePrices: [1.250, 1.500],
    imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300&h=300&fit=crop&q=80' },
  { id: 803, categoryId: 'coffee', name: 'لاتيه', nameEn: 'Latte', price: 1.250, description: 'إسبريسو مع حليب ساخن وفنون لاتيه', sizes: ['وسط', 'كبير'], sizePrices: [1.250, 1.500],
    imageUrl: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=300&h=300&fit=crop&q=80' },
  { id: 804, categoryId: 'coffee', name: 'موكا', nameEn: 'Mocha', price: 1.500, description: 'لاتيه مع شوكولاتة بلجيكية', sizes: ['وسط', 'كبير'], sizePrices: [1.500, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1578314675229-cb95f9d92e72?w=300&h=300&fit=crop&q=80' },
  { id: 805, categoryId: 'coffee', name: 'أمريكانو', nameEn: 'Americano', price: 1.000, description: 'إسبريسو مع ماء ساخن', sizes: ['وسط', 'كبير'], sizePrices: [1.000, 1.250],
    imageUrl: 'https://images.unsplash.com/photo-1521302080334-4bebac2763a6?w=300&h=300&fit=crop&q=80' },
  { id: 806, categoryId: 'coffee', name: 'فلات وايت', nameEn: 'Flat White', price: 1.250, description: 'إسبريسو مع حليب مخملي', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1607681034540-2c46cc71896d?w=300&h=300&fit=crop&q=80' },
  { id: 807, categoryId: 'coffee', name: 'آيس لاتيه', nameEn: 'Iced Latte', price: 1.500, description: 'لاتيه بارد مع ثلج', sizes: ['وسط', 'كبير'], sizePrices: [1.500, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=300&h=300&fit=crop&q=80' },
  { id: 808, categoryId: 'coffee', name: 'قهوة تركية', nameEn: 'Turkish Coffee', price: 0.750, description: 'قهوة تركية أصلية بالهيل', sizes: ['سادة', 'وسط', 'حلوة'], sizePrices: [0.750, 0.750, 0.750],
    imageUrl: 'https://images.unsplash.com/photo-1559525839-d9acfd1ed7d6?w=300&h=300&fit=crop&q=80' },
  { id: 809, categoryId: 'coffee', name: 'قهوة عربية', nameEn: 'Arabic Coffee', price: 0.500, description: 'قهوة عربية بالهيل والزعفران', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=300&h=300&fit=crop&q=80' },
  { id: 810, categoryId: 'coffee', name: 'هوت شوكليت', nameEn: 'Hot Chocolate', price: 1.500, description: 'شوكولاتة ساخنة مع مارشميلو', sizes: ['وسط', 'كبير'], sizePrices: [1.500, 1.750],
    imageUrl: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=300&h=300&fit=crop&q=80' },

  // === مولتن كيك ===
  { id: 901, categoryId: 'molten', name: 'مولتن شوكولاتة', nameEn: 'Chocolate Molten', price: 2.250, description: 'كيك شوكولاتة بقلب سائل دافئ', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&h=300&fit=crop&q=80' },
  { id: 902, categoryId: 'molten', name: 'مولتن نوتيلا', nameEn: 'Nutella Molten', price: 2.500, description: 'كيك بقلب نوتيلا سائل', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=300&h=300&fit=crop&q=80' },
  { id: 903, categoryId: 'molten', name: 'مولتن لوتس', nameEn: 'Lotus Molten', price: 2.500, description: 'كيك بقلب لوتس كراميل سائل', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=300&fit=crop&q=80' },
  { id: 904, categoryId: 'molten', name: 'مولتن كراميل مملح', nameEn: 'Salted Caramel Molten', price: 2.500, description: 'كيك بقلب كراميل مملح', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1612203284663-c9c3a7e6f4ab?w=300&h=300&fit=crop&q=80' },
  { id: 905, categoryId: 'molten', name: 'مولتن فستق', nameEn: 'Pistachio Molten', price: 2.750, description: 'كيك بقلب كريم فستق', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1565808229224-264b6877bcca?w=300&h=300&fit=crop&q=80' },
  { id: 906, categoryId: 'molten', name: 'مولتن شوكولاتة بيضاء', nameEn: 'White Chocolate Molten', price: 2.500, description: 'كيك بقلب شوكولاتة بيضاء', sizes: null, sizePrices: null,
    imageUrl: 'https://images.unsplash.com/photo-1551404973-761c83cd8339?w=300&h=300&fit=crop&q=80' }
];

// ========== إضافات ==========
const EXTRAS = [
  { id: 1, name: 'كريمة مخفوقة', price: 0.250 },
  { id: 2, name: 'آيس كريم فانيلا', price: 0.500 },
  { id: 3, name: 'صوص شوكولاتة إضافي', price: 0.250 },
  { id: 4, name: 'صوص كراميل إضافي', price: 0.250 },
  { id: 5, name: 'صوص نوتيلا إضافي', price: 0.350 },
  { id: 6, name: 'فواكه إضافية', price: 0.500 },
  { id: 7, name: 'بسكويت لوتس إضافي', price: 0.250 },
  { id: 8, name: 'بندق محمص', price: 0.300 },
  { id: 9, name: 'عسل طبيعي', price: 0.250 },
  { id: 10, name: 'بدون سكر', price: 0.000 }
];

// ========== حالات الطلب ==========
// ========== أسباب إلغاء الطلب ==========
// أنواع الشكوى — الخادم يشترط `category` غير فارغ. القيمة المخزَّنة هي `id`
// (ثابتة عبر اللغات) والعرض بـ`label`.
const COMPLAINT_CATEGORIES = [
  { id: 'late',          label: 'تأخير في التوصيل',        labelEn: 'Late delivery' },
  { id: 'missing_items', label: 'أصناف ناقصة',             labelEn: 'Missing items' },
  { id: 'wrong_items',   label: 'أصناف خاطئة',             labelEn: 'Wrong items' },
  { id: 'quality',       label: 'جودة الطعام',             labelEn: 'Food quality' },
  { id: 'driver',        label: 'سلوك السائق',             labelEn: 'Driver behaviour' },
  { id: 'price',         label: 'خطأ في السعر أو الفاتورة', labelEn: 'Price or invoice error' },
  { id: 'other',         label: 'أخرى',                    labelEn: 'Other' },
]

const CANCELLATION_REASONS = [
  { id: 'late',         label: 'الطلب متأخر',           labelEn: 'Order is late',            icon: 'clock' },
  { id: 'taste',        label: 'مشكلة في الطعم',         labelEn: 'Taste problem',            icon: 'utensils' },
  { id: 'wrong_items',  label: 'أصناف خاطئة في الطلب',   labelEn: 'Wrong items in the order',  icon: 'alert-circle' },
  { id: 'missing_items',label: 'أصناف ناقصة',            labelEn: 'Missing items',            icon: 'list' },
  { id: 'customer',     label: 'رغبة العميل',            labelEn: 'Customer request',         icon: 'user' },
  { id: 'wrong_address',label: 'عنوان خاطئ / غير دقيق',  labelEn: 'Wrong / unclear address',  icon: 'map-pin' },
  { id: 'unavailable',  label: 'صنف غير متوفر',          labelEn: 'Item unavailable',         icon: 'ban' },
  { id: 'duplicate',    label: 'طلب مكرر',               labelEn: 'Duplicate order',          icon: 'copy' },
  { id: 'no_driver',    label: 'لا يوجد سائق متاح',      labelEn: 'No driver available',      icon: 'bike' },
  { id: 'other',        label: 'سبب آخر',                labelEn: 'Another reason',           icon: 'edit' }
];

const ORDER_STATUSES = [
  { id: 'sent', name: 'لم يصل الفرع', nameEn: 'Not at branch yet', color: '#94a3b8', icon: 'badge-new' },
  { id: 'new', name: 'جديد', nameEn: 'New', color: '#3b82f6', icon: 'badge-new' },
  { id: 'preparing', name: 'جاري التحضير', nameEn: 'Preparing', color: '#f59e0b', icon: 'chef-hat' },
  { id: 'ready', name: 'جاهز', nameEn: 'Ready', color: '#8b5cf6', icon: 'check-circle' },
  { id: 'onway', name: 'في الطريق', nameEn: 'On the way', color: '#06b6d4', icon: 'bike' },
  { id: 'delivered', name: 'تم التسليم', nameEn: 'Delivered', color: '#22c55e', icon: 'package' },
  { id: 'cancelled', name: 'ملغي', nameEn: 'Cancelled', color: '#ef4444', icon: 'x-circle' }
];

// ========== مصادر الطلب (channels) وطرق الدفع المتاحة لكل مصدر ==========
const PAYMENT_METHODS = [
  { id: 'cash', name: 'كاش',    nameEn: 'Cash',  icon: 'banknote', color: '#16a34a' },
  { id: 'knet', name: 'كي نت',  nameEn: 'K-Net', icon: 'credit-card',     color: '#2563eb' },
  { id: 'link', name: 'لينك',   nameEn: 'Link',  icon: 'link',            color: '#7c3aed' }
];

const PAYMENT_CHANNELS = [
  {
    id: 'phone', name: 'الفون', nameEn: 'Phone',
    icon: 'phone', color: '#2563eb',
    logo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#2563eb"/><path d="M14 14h6l2 5-3 2.5c1.5 3 4 5.5 7 7l2.5-3 5 2v6c0 1.5-1 2.5-2.5 2.5C20.5 36 12 27.5 12 17c0-1.5 1-2.5 2-3z" fill="#fff"/></svg>`,
    methods: ['cash', 'knet', 'link']
  },
  {
    id: 'talabat', name: 'طلبات', nameEn: 'Talabat',
    icon: 'bowl', color: '#ff5a00',
    logo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#ff5a00"/><circle cx="19" cy="14" r="1.5" fill="#fff" opacity="0.8"/><circle cx="24" cy="11.5" r="1.5" fill="#fff" opacity="0.8"/><circle cx="29" cy="14" r="1.5" fill="#fff" opacity="0.8"/><path d="M12 21h24a2 2 0 0 1 2 2 13 13 0 0 1-26 0 2 2 0 0 1 2-2z" fill="#fff"/><rect x="11" y="36" width="26" height="2" rx="1" fill="#fff"/></svg>`,
    methods: ['cash', 'knet']
  },
  {
    id: 'carriage', name: 'كاري', nameEn: 'Carriage',
    icon: 'shopping-bag', color: '#f4b400',
    logo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#f4b400"/><path d="M16 18h16l-1.5 16a3 3 0 0 1-3 2.7H20.5a3 3 0 0 1-3-2.7z" fill="#fff"/><path d="M18 18a6 6 0 0 1 12 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
    methods: ['cash', 'knet']
  },
  {
    id: 'jahez', name: 'جاهز', nameEn: 'Jahez',
    icon: 'bike', color: '#00a651',
    logo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#00a651"/><text x="24" y="34" font-family="Tahoma, Arial, sans-serif" font-size="26" font-weight="900" text-anchor="middle" fill="#fff">ج</text></svg>`,
    methods: ['cash', 'knet']
  },
  {
    id: 'deliveroo', name: 'ديليفرو', nameEn: 'Deliveroo',
    icon: 'bicycle', color: '#00ccbc',
    logo: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="#00ccbc"/><path d="M28 12c-2.5 0-4.5 1.4-5.5 3.5-2-1.2-4.5-1-6 .5-2 2-2 5 .5 7.5l-3.5 6c-1 1.8 0 4 2 4h2.5l-1 2.5h4.5l2-3.5 5 2c2.5 1 5-1 5-3.5v-7.5c2-1 3.5-3 3.5-5.5 0-3.5-3.5-6.5-8-6.5z" fill="#fff"/></svg>`,
    methods: ['cash', 'knet']
  }
];

// ========== أنواع الطلب ==========
const ORDER_TYPES = [
  { id: 'delivery', name: 'توصيل', nameEn: 'Delivery', icon: 'bike' },
  { id: 'pickup', name: 'استلام من الفرع', nameEn: 'Branch pickup', icon: 'store' }
];

// ========== عملاء تجريبيين ==========
const SAMPLE_CUSTOMERS = [
  {
    id: 1,
    name: 'أحمد المحمد',
    phone: '99743039',
    phone2: '',
    addresses: [
      { id: 1, area: 'الروضة', block: '2', street: '10', building: '5', floor: 'أرضي', apartment: '' }
    ],
    notes: 'يفضل بدون سكر',
    isBlacklisted: false,
    createdAt: '2026-01-15'
  },
  {
    id: 2,
    name: 'فاطمة العلي',
    phone: '66409952',
    phone2: '55123456',
    addresses: [
      { id: 1, area: 'حطين', block: '3', street: '5', building: '12', floor: '2', apartment: '4' },
      { id: 2, area: 'الزهراء', block: '1', street: '2', building: '10', floor: '', apartment: '' }
    ],
    notes: '',
    isBlacklisted: false,
    createdAt: '2026-02-20'
  },
  {
    id: 3,
    name: 'محمد الفهد',
    phone: '50282559',
    phone2: '',
    addresses: [
      { id: 1, area: 'أم الهيمان', block: '1', street: '3', building: '8', floor: '1', apartment: '2' }
    ],
    notes: 'حساسية من المكسرات',
    isBlacklisted: false,
    createdAt: '2026-03-10'
  },
  {
    id: 4,
    name: 'سارة الخالد',
    phone: '99707726',
    phone2: '',
    addresses: [
      { id: 1, area: 'السالمية', block: '5', street: '15', building: '22', floor: '3', apartment: '7' }
    ],
    notes: '',
    isBlacklisted: false,
    createdAt: '2026-03-25'
  },
  {
    id: 5,
    name: 'عبدالله الراشد',
    phone: '55887744',
    phone2: '99112233',
    addresses: [
      { id: 1, area: 'الخالدية', block: '4', street: '8', building: '15', floor: 'أرضي', apartment: '' }
    ],
    notes: 'عميل VIP',
    isBlacklisted: false,
    createdAt: '2026-04-01'
  }
];

// ========== طلبات تجريبية ==========
const SAMPLE_ORDERS = [
  {
    id: 1,
    invoiceNo: '562447',
    dailyNo: 24,
    customerId: 1,
    customerName: 'أحمد المحمد',
    customerPhone: '99743039',
    branchId: 4,
    branchName: 'فرع الزهراء',
    employeeId: 1,
    employeeName: 'آية عصام',
    type: 'delivery',
    status: 'delivered',
    items: [
      { itemId: 103, name: 'عصير مانجو', size: 'كبير', quantity: 2, price: 1.500, extras: ['بدون سكر'], extrasPrice: 0 },
      { itemId: 401, name: 'وافل شوكولاتة', size: null, quantity: 1, price: 2.000, extras: ['كريمة مخفوقة'], extrasPrice: 0.250 }
    ],
    subtotal: 5.250,
    deliveryFee: 0.500,
    total: 5.750,
    address: 'الروضة، ق 2، ش 10',
    notes: 'بدون سكر في العصير',
    createdAt: '2026-05-20T10:30:00',
    updatedAt: '2026-05-20T11:15:00'
  },
  {
    id: 2,
    invoiceNo: '1116555',
    dailyNo: 0,
    customerId: 3,
    customerName: 'محمد الفهد',
    customerPhone: '50282559',
    branchId: 1,
    branchName: 'فرع أم الهيمان',
    employeeId: 2,
    employeeName: 'سارة أحمد',
    type: 'delivery',
    status: 'preparing',
    items: [
      { itemId: 301, name: 'ميلك شيك شوكولاتة', size: 'كبير', quantity: 1, price: 2.250, extras: [], extrasPrice: 0 },
      { itemId: 502, name: 'بان كيك نوتيلا', size: null, quantity: 2, price: 2.000, extras: ['فواكه إضافية'], extrasPrice: 0.500 }
    ],
    subtotal: 6.750,
    deliveryFee: 0.500,
    total: 7.250,
    address: 'أم الهيمان، ق 1، ش 3',
    notes: 'بدون مكسرات',
    createdAt: '2026-05-20T12:00:00',
    updatedAt: '2026-05-20T12:00:00'
  },
  {
    id: 3,
    invoiceNo: '600882',
    dailyNo: 15,
    customerId: 4,
    customerName: 'سارة الخالد',
    customerPhone: '99707726',
    branchId: 4,
    branchName: 'فرع الزهراء',
    employeeId: 1,
    employeeName: 'آية عصام',
    type: 'delivery',
    status: 'onway',
    items: [
      { itemId: 201, name: 'كوكتيل فواكه مشكلة', size: 'كبير', quantity: 1, price: 2.250, extras: [], extrasPrice: 0 },
      { itemId: 403, name: 'وافل لوتس', size: null, quantity: 1, price: 2.250, extras: ['آيس كريم فانيلا'], extrasPrice: 0.500 }
    ],
    subtotal: 5.000,
    deliveryFee: 0.500,
    total: 5.500,
    address: 'السالمية، ق 5، ش 15',
    notes: '',
    createdAt: '2026-05-20T13:00:00',
    updatedAt: '2026-05-20T13:45:00'
  },
  {
    id: 4,
    invoiceNo: '238429',
    dailyNo: 18,
    customerId: 2,
    customerName: 'فاطمة العلي',
    customerPhone: '66409952',
    branchId: 3,
    branchName: 'فرع حطين',
    employeeId: 1,
    employeeName: 'آية عصام',
    type: 'pickup',
    status: 'ready',
    items: [
      { itemId: 305, name: 'ميلك شيك لوتس', size: 'عادي', quantity: 3, price: 1.750, extras: [], extrasPrice: 0 }
    ],
    subtotal: 5.250,
    deliveryFee: 0.000,
    total: 5.250,
    address: 'حطين، ق 3، ش 5',
    notes: '',
    createdAt: '2026-05-20T14:00:00',
    updatedAt: '2026-05-20T14:30:00'
  }
];

// ========== رسوم التوصيل ==========
const DELIVERY_FEE = 0.500;

// ========== إعدادات النظام ==========
const SYSTEM_SETTINGS = {
  companyName: 'Premium POS',
  currency: 'د.ك',
  deliveryFee: 0.500,
  taxRate: 0,
  workingHours: { start: '08:00', end: '00:00' }
};

// ── ES module exports (نفس الداتا الأصلية 1:1) ──
export { EMPLOYEES, DRIVERS, BRANCHES, MENU_CATEGORIES, MENU_ITEMS, EXTRAS, CANCELLATION_REASONS, COMPLAINT_CATEGORIES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_CHANNELS, ORDER_TYPES, SAMPLE_CUSTOMERS, SAMPLE_ORDERS, DELIVERY_FEE, SYSTEM_SETTINGS }
