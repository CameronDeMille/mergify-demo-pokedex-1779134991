export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  sprite: string;
  ownerId: string;
}

export interface FavoriteRecord {
  userId: string;
  pokemonId: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}
