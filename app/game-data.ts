export type FoodCategory = "good" | "harmful";

export type GameLevel = 1 | 2 | 3;

export type LevelDefinition = {
  id: GameLevel;
  name: string;
  subtitle: string;
  description: string;
  harmfulHint?: string;
};

export type FoodItem = {
  id: string;
  name: string;
  emoji: string;
  category: FoodCategory;
  fact: string;
  level: GameLevel;
};

export const ROUND_SIZE = 26;
const PRODUCT_IMAGE_VERSION = "20260905-1";

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: "Уровень 1",
    subtitle: "Для детей",
    description:
      "Здесь всё видно сразу! Фрукты, овощи, каши и мясо дают силу и здоровье, а слишком сладкие и солёные продукты только обманывают вкус.",
  },
  {
    id: 2,
    name: "Уровень 2",
    subtitle: "Для детей и взрослых",
    description:
      "Некоторые продукты притворяются полезными. Ищи сахар, соль и лишние добавки, даже если на упаковке написано «витаминный» или «натуральный».",
    harmfulHint: "Будь внимательнее",
  },
  {
    id: 3,
    name: "Уровень 3",
    subtitle: "Для взрослых",
    description:
      "Самые коварные блюда можно узнать по лишнему жиру, соли и сахару. Иногда продукт можно сделать полезнее, если запечь его или убрать жирный соус.",
    harmfulHint: "Но можно исправить",
  },
];

export const FOODS: FoodItem[] = [
  { id: "l1-apple", name: "Яблоко", emoji: "🍎", category: "good", fact: "Даёт витамины и не даёт болеть!", level: 1 },
  { id: "l1-carrot", name: "Морковь", emoji: "🥕", category: "good", fact: "Помогает глазам хорошо видеть!", level: 1 },
  { id: "l1-cucumber", name: "Огурец", emoji: "🥒", category: "good", fact: "В нём много водички, утоляет жажду!", level: 1 },
  { id: "l1-tomato", name: "Помидор", emoji: "🍅", category: "good", fact: "Красный и сочный, даёт здоровье!", level: 1 },
  { id: "l1-banana", name: "Банан", emoji: "🍌", category: "good", fact: "Заряжает энергией, становишься сильным!", level: 1 },
  { id: "l1-boiled-chicken", name: "Куриная грудка (варёная)", emoji: "🍗", category: "good", fact: "Белок — это «кирпичики» для мышц, он нужен, чтобы расти!", level: 1 },
  { id: "l1-boiled-fish", name: "Отварная рыба", emoji: "🐟", category: "good", fact: "Полезна для мозга, чтобы хорошо думать!", level: 1 },
  { id: "l1-buckwheat", name: "Гречка", emoji: "🍚", category: "good", fact: "Каша даёт силу на весь день!", level: 1 },
  { id: "l1-cottage-cheese", name: "Творог", emoji: "🥣", category: "good", fact: "Укрепляет кости и зубы!", level: 1 },
  { id: "l1-boiled-egg", name: "Варёное яйцо", emoji: "🥚", category: "good", fact: "В нём белок и витамины для роста!", level: 1 },
  { id: "l1-lollipop", name: "Леденец-петушок", emoji: "🍭", category: "harmful", fact: "Очень сладкий, портит зубы!", level: 1 },
  { id: "l1-chips", name: "Чипсы", emoji: "🍟", category: "harmful", fact: "Жирные и солёные, вредят животу!", level: 1 },
  { id: "l1-cola", name: "Сладкая газировка (Кола)", emoji: "🥤", category: "harmful", fact: "В ней много сахара, лучше выпить воды!", level: 1 },
  { id: "l1-cream-cake", name: "Пирожное с кремом", emoji: "🍰", category: "harmful", fact: "Жирное и сладкое, его лучше есть редко!", level: 1 },
  { id: "l1-croutons", name: "Сухарики с приправами", emoji: "🥨", category: "harmful", fact: "Острые и солёные, раздражают желудок!", level: 1 },
  { id: "l1-mayonnaise", name: "Майонез", emoji: "🫙", category: "harmful", fact: "Очень жирный соус, тяжёлый для живота!", level: 1 },
  { id: "l1-glazed-cereal", name: "Кукурузные хлопья с глазурью", emoji: "🥣", category: "harmful", fact: "Хрустят, но это почти конфета, а не каша!", level: 1 },
  { id: "l1-ice-cream", name: "Мороженое пломбир", emoji: "🍨", category: "harmful", fact: "Холодное и сладкое — ешь его редко и понемногу!", level: 1 },
  { id: "l1-sausages", name: "Сосиски", emoji: "🌭", category: "harmful", fact: "В них мало мяса и много добавок!", level: 1 },
  { id: "l1-ketchup", name: "Кетчуп", emoji: "🍅", category: "harmful", fact: "В нём много сахара и красителей!", level: 1 },

  { id: "l2-natural-yogurt", name: "Натуральный йогурт без добавок", emoji: "🥛", category: "good", fact: "В нём только молоко и бактерии — он помогает животу!", level: 2 },
  { id: "l2-oatmeal", name: "Овсяные хлопья долгой варки", emoji: "🥣", category: "good", fact: "Настоящая каша даёт силу на всё утро!", level: 2 },
  { id: "l2-wholegrain-bread", name: "Цельнозерновой хлеб", emoji: "🍞", category: "good", fact: "В нём много клетчатки — она помогает желудку работать!", level: 2 },
  { id: "l2-nuts", name: "Сырые несолёные орехи", emoji: "🌰", category: "good", fact: "Орехи полезны, если они не солёные и не жареные!", level: 2 },
  { id: "l2-dried-apricots", name: "Курага", emoji: "🍑", category: "good", fact: "Витаминная, но ешь понемногу — в ней есть природный сахар.", level: 2 },
  { id: "l2-boiled-egg", name: "Варёное яйцо", emoji: "🥚", category: "good", fact: "Белок и витамины для роста — отличный завтрак!", level: 2 },
  { id: "l2-baked-fish", name: "Рыба запечённая без масла", emoji: "🐟", category: "good", fact: "Рыба полезна для мозга и костей, а запекать лучше, чем жарить!", level: 2 },
  { id: "l2-buckwheat", name: "Гречка", emoji: "🍚", category: "good", fact: "Каша даёт энергию и железо, чтобы не болеть!", level: 2 },
  { id: "l2-fresh-carrot", name: "Свежая морковь", emoji: "🥕", category: "good", fact: "Хрусти и грызи — витамин А полезен для глаз!", level: 2 },
  { id: "l2-cottage-cheese", name: "Творог без добавок", emoji: "🥣", category: "good", fact: "Кальций укрепляет зубы и кости!", level: 2 },
  { id: "l2-sweet-yogurt", name: "Йогурт с клубничным наполнителем", emoji: "🍓", category: "harmful", fact: "Сладкий и ароматный, но внутри много сахара — обманка!", level: 2 },
  { id: "l2-white-bread", name: "Белый хлеб (батон)", emoji: "🥖", category: "harmful", fact: "Мягкий, но почти пустой — лучше заменить его цельнозерновым хлебом.", level: 2 },
  { id: "l2-salted-peanuts", name: "Солёный арахис", emoji: "🥜", category: "harmful", fact: "Орехи хорошие, но здесь много соли — это вредно для почек!", level: 2 },
  { id: "l2-marmalade", name: "Фруктовый мармелад", emoji: "🍬", category: "harmful", fact: "Выглядит фруктовым, но внутри сахар, сироп и красители.", level: 2 },
  { id: "l2-vitamin-cookies", name: "Детское печенье с «витаминами»", emoji: "🍪", category: "harmful", fact: "На коробке пишут «витаминное», но в нём много сахара и маргарина!", level: 2 },
  { id: "l2-nuggets", name: "Наггетсы в панировке", emoji: "🍗", category: "harmful", fact: "Курица полезная, но её обжарили в масле — лучше без панировки.", level: 2 },
  { id: "l2-carrot-juice", name: "Морковный сок «натуральный» в коробке", emoji: "🧃", category: "harmful", fact: "Вкусно, но в сок добавили сахар — лучше просто морковку, а пить — воду.", level: 2 },
  { id: "l2-glazed-curd", name: "Глазированный творожный сырок", emoji: "🍫", category: "harmful", fact: "Творог хороший, но глазурь и сахар делают сырок вредным.", level: 2 },
  { id: "l2-instant-noodles", name: "Лапша быстрого приготовления", emoji: "🍜", category: "harmful", fact: "Содержит много соли и жиров, приводит к перееданию и ожирению.", level: 2 },
  { id: "l2-popcorn", name: "Попкорн", emoji: "🍿", category: "harmful", fact: "Его готовят с большим количеством масла, соли и другими добавками. Лучше приготовить без добавок дома.", level: 2 },

  { id: "l3-baked-chicken", name: "Запечённая куриная грудка", emoji: "🍗", category: "good", fact: "Мясо из духовки даёт белок для мышц без лишнего жира.", level: 3 },
  { id: "l3-baked-potato", name: "Картофель запечённый в мундире", emoji: "🥔", category: "good", fact: "Запечённый картофель полезный и сытный, особенно с кожурой!", level: 3 },
  { id: "l3-vegetable-sticks", name: "Запечённые овощные палочки", emoji: "🫑", category: "good", fact: "Они хрустят, как картошка фри, но дают витамины, а не лишний жир!", level: 3 },
  { id: "l3-boiled-corn", name: "Отварная кукуруза", emoji: "🌽", category: "good", fact: "Она сладкая от природы и даёт энергию.", level: 3 },
  { id: "l3-fresh-salad", name: "Салат из свежих овощей", emoji: "🥗", category: "good", fact: "Овощи — лучшие друзья, а жирная заправка им не нужна!", level: 3 },
  { id: "l3-steamed-fish", name: "Рыба на пару с лимоном", emoji: "🐟", category: "good", fact: "Рыба без масла полезна для мозга.", level: 3 },
  { id: "l3-buckwheat-mushrooms", name: "Гречка с грибами", emoji: "🍄", category: "good", fact: "Гречка и грибы — сытно и полезно, они дают энергию.", level: 3 },
  { id: "l3-kefir", name: "Кефир", emoji: "🥛", category: "good", fact: "Кисломолочный напиток без сахара полезен для кишечника.", level: 3 },
  { id: "l3-crispbread", name: "Цельнозерновые хлебцы", emoji: "🍞", category: "good", fact: "Хрустят, но это не чипсы — клетчатка помогает желудку.", level: 3 },
  { id: "l3-coffee", name: "Кофе", emoji: "☕", category: "good", fact: "Кофе помогает взбодриться. Важно соблюдать меру и не добавлять много сахара.", level: 3 },
  { id: "l3-butter", name: "Сливочное масло", emoji: "🧈", category: "good", fact: "Сливочное масло содержит насыщенные жиры, поэтому его лучше есть понемногу.", level: 3 },
  { id: "l3-fried-nuggets", name: "Куриные наггетсы", emoji: "🍗", category: "harmful", fact: "Их жарят в масле и панировке — получается много лишнего жира.", level: 3 },
  { id: "l3-fries", name: "Картофель фри", emoji: "🍟", category: "harmful", fact: "Он жарится в масле — это вредно для живота.", level: 3 },
  { id: "l3-pizza", name: "Пицца с колбасой и беконом", emoji: "🍕", category: "harmful", fact: "Жирное мясо и много сыра — тяжело для желудка.", level: 3 },
  { id: "l3-burger", name: "Гамбургер с майонезом", emoji: "🍔", category: "harmful", fact: "Жирная котлета, сладкая булка и майонез — всё вместе вредно.", level: 3 },
  { id: "l3-caesar", name: "Салат Цезарь", emoji: "🥗", category: "harmful", fact: "Овощи есть, но жирный соус всё портит — лучше без него.", level: 3 },
  { id: "l3-fried-fish", name: "Рыба во фритюре", emoji: "🍤", category: "harmful", fact: "Жареное тесто впитывает много масла.", level: 3 },
  { id: "l3-fried-dumplings", name: "Жареные пельмени", emoji: "🥟", category: "harmful", fact: "В них много теста и жира, лучше выбрать варёные.", level: 3 },
  { id: "l3-milkshake", name: "Молочный коктейль с сиропом", emoji: "🥤", category: "harmful", fact: "Слишком сладкий и жирный, лучше выпить кефир.", level: 3 },
  { id: "l3-chips", name: "Чипсы", emoji: "🍟", category: "harmful", fact: "Жареные, солёные, с приправами — пользы в них нет.", level: 3 },
  { id: "l3-orange-juice", name: "Свежевыжатый апельсиновый сок", emoji: "🍊", category: "harmful", fact: "Даже без добавленного сахара в соке много природного сахара и мало клетчатки — лучше съесть целый апельсин.", level: 3 },
  { id: "l3-granola", name: "Гранола", emoji: "🥣", category: "harmful", fact: "Готовая гранола может содержать много сахара и масла — важно проверять состав.", level: 3 },
  { id: "l3-fat-free-dairy", name: "Обезжиренные молочные продукты", emoji: "🥛", category: "harmful", fact: "Надпись «обезжиренный» не гарантирует пользу — важно проверить, нет ли добавленного сахара.", level: 3 },
  { id: "l3-white-rice", name: "Белый рис отварной", emoji: "🍚", category: "harmful", fact: "В белом рисе меньше клетчатки, чем в буром, поэтому его лучше сочетать с овощами.", level: 3 },
  { id: "l3-tuna", name: "Тунец", emoji: "🐟", category: "harmful", fact: "Некоторые виды тунца содержат больше ртути, поэтому важно соблюдать меру и чередовать разные виды рыбы.", level: 3 },
  { id: "l3-fitness-bars", name: "Фитнес-батончики", emoji: "🍫", category: "harmful", fact: "Название «фитнес» не гарантирует пользу: батончики могут содержать много сахара, сиропов и жиров.", level: 3 },
];

export function makeRound(level: GameLevel): FoodItem[] {
  const shuffled = FOODS.filter((food) => food.level === level);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, ROUND_SIZE);
}

export function getFoodImage(food: FoodItem, large = false): string | null {
  const collection = large ? "products-large" : "products";
  return `/${collection}/level-${food.level}/${food.id}.webp?v=${PRODUCT_IMAGE_VERSION}`;
}
