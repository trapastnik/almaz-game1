export type FoodCategory = "good" | "sometimes";

export type FoodItem = {
  id: string;
  name: string;
  emoji: string;
  category: FoodCategory;
  fact: string;
};

export const ROUND_SIZE = 20;

export const FOODS: FoodItem[] = [
  { id: "apple", name: "Яблоко", emoji: "🍎", category: "good", fact: "В яблоке есть клетчатка и витамин C." },
  { id: "carrot", name: "Морковь", emoji: "🥕", category: "good", fact: "Морковь полезна для зрения и роста." },
  { id: "broccoli", name: "Брокколи", emoji: "🥦", category: "good", fact: "В брокколи много витаминов и железа." },
  { id: "chicken", name: "Куриная грудка", emoji: "🍗", category: "good", fact: "Куриное мясо даёт белок для мышц." },
  { id: "oatmeal", name: "Овсяная каша", emoji: "🥣", category: "good", fact: "Каша надолго даёт энергию." },
  { id: "walnut", name: "Грецкие орехи", emoji: "🌰", category: "good", fact: "Орехи содержат полезные жиры." },
  { id: "yogurt", name: "Натуральный йогурт", emoji: "🥛", category: "good", fact: "Натуральный йогурт полезен для пищеварения." },
  { id: "salmon", name: "Лосось", emoji: "🐟", category: "good", fact: "В рыбе есть полезные жирные кислоты." },
  { id: "blueberry", name: "Черника", emoji: "🫐", category: "good", fact: "Черника содержит витамины и антиоксиданты." },
  { id: "green-tea", name: "Зелёный чай", emoji: "🍵", category: "good", fact: "В зелёном чае есть антиоксиданты." },
  { id: "cottage-cheese", name: "Творог", emoji: "🥣", category: "good", fact: "Творог даёт организму кальций и белок." },
  { id: "pepper", name: "Болгарский перец", emoji: "🫑", category: "good", fact: "В сладком перце много витамина C." },
  { id: "quinoa", name: "Киноа", emoji: "🍚", category: "good", fact: "Киноа содержит белок и полезные вещества." },
  { id: "avocado", name: "Авокадо", emoji: "🥑", category: "good", fact: "Авокадо богато полезными жирами." },
  { id: "eggs", name: "Яйца", emoji: "🥚", category: "good", fact: "В яйцах есть белок и витамин D." },
  { id: "pomegranate-juice", name: "Гранатовый сок", emoji: "🧃", category: "good", fact: "Сок лучше пить понемногу и без добавленного сахара." },
  { id: "lentil", name: "Чечевица", emoji: "🫘", category: "good", fact: "Чечевица содержит растительный белок и железо." },
  { id: "greens", name: "Свежая зелень", emoji: "🌿", category: "good", fact: "В зелени много витаминов и минералов." },
  { id: "wholegrain-bread", name: "Цельнозерновой хлеб", emoji: "🍞", category: "good", fact: "В нём больше клетчатки, чем в белом хлебе." },
  { id: "almond", name: "Миндаль", emoji: "🌰", category: "good", fact: "Миндаль содержит витамин E и полезные жиры." },
  { id: "chips", name: "Картофельные чипсы", emoji: "🍟", category: "sometimes", fact: "В чипсах обычно много соли и жира." },
  { id: "soda", name: "Сладкая газировка", emoji: "🥤", category: "sometimes", fact: "В сладкой газировке очень много сахара." },
  { id: "sausages", name: "Сосиски", emoji: "🌭", category: "sometimes", fact: "В сосисках может быть много соли и жира." },
  { id: "donut", name: "Пончик", emoji: "🍩", category: "sometimes", fact: "В пончике много сахара и масла." },
  { id: "mayonnaise", name: "Майонез", emoji: "🫙", category: "sometimes", fact: "Это очень жирный соус, его нужно совсем немного." },
  { id: "burger", name: "Гамбургер", emoji: "🍔", category: "sometimes", fact: "В фастфуде часто много соли, жира и соуса." },
  { id: "ice-cream", name: "Магазинное мороженое", emoji: "🍨", category: "sometimes", fact: "Мороженое — сладкое угощение, а не ежедневная еда." },
  { id: "smoked-sausage", name: "Копчёная колбаса", emoji: "🥓", category: "sometimes", fact: "В копчёной колбасе много соли и жира." },
  { id: "candy", name: "Леденцы", emoji: "🍬", category: "sometimes", fact: "Леденцы почти полностью состоят из сахара." },
  { id: "energy-drink", name: "Энергетик", emoji: "🥫", category: "sometimes", fact: "Энергетические напитки детям нельзя." },
  { id: "croutons", name: "Солёные сухарики", emoji: "🥨", category: "sometimes", fact: "В сухариках бывает слишком много соли и добавок." },
  { id: "condensed-milk", name: "Сгущённое молоко", emoji: "🥫", category: "sometimes", fact: "Сгущённое молоко содержит очень много сахара." },
  { id: "ketchup", name: "Кетчуп с добавками", emoji: "🍅", category: "sometimes", fact: "В готовом кетчупе могут быть сахар и лишняя соль." },
  { id: "pizza", name: "Пицца с колбасой", emoji: "🍕", category: "sometimes", fact: "В такой пицце много белой муки, сыра и соли." },
  { id: "sweet-cereal", name: "Сладкие хлопья", emoji: "🥣", category: "sometimes", fact: "В сладких завтраках часто много сахара." },
  { id: "chocolate-bar", name: "Шоколадный батончик", emoji: "🍫", category: "sometimes", fact: "Батончик — это сладость, его едят понемногу." },
  { id: "fatty-meat", name: "Жирное мясо", emoji: "🥩", category: "sometimes", fact: "Очень жирное мясо лучше есть нечасто." },
  { id: "white-bread", name: "Белый хлеб", emoji: "🍞", category: "sometimes", fact: "В белом хлебе меньше клетчатки." },
  { id: "cream-cake", name: "Пирожное с кремом", emoji: "🍰", category: "sometimes", fact: "В пирожном много сахара, муки и жирного крема." },
  { id: "butter-popcorn", name: "Попкорн с маслом", emoji: "🍿", category: "sometimes", fact: "В готовом попкорне может быть много масла, соли или сахара." },
];

export function makeRound(): FoodItem[] {
  const shuffled = [...FOODS];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, ROUND_SIZE);
}
