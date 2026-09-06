export interface GroceryItem {
  id: string;
  item_name: string;
  category: 'protein' | 'veggies' | 'starch' | 'fats' | 'eggs';
  shop_amount: number | null;
  unit: 'lb' | 'cups' | 'oz' | 'carton' | null;
  checked: boolean;
}

export interface GroceryList {
  notes: string;
  adjustedTotals: AdjustedTotals;
}

export interface AdjustedTotals {
  protein_lb: number;
  veggies_cups: number;
  starch_cups: number;
  fats_oz: number;
  eggs_carton: number;
}

export interface CountdownTotals extends AdjustedTotals {
  protein_lb_remaining: number;
  veggies_cups_remaining: number;
  starch_cups_remaining: number;
  fats_oz_remaining: number;
  eggs_carton_remaining: number;
}
