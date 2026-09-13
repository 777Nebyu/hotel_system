import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SearchFilters {
  city: string;
  keyword: string;
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  roomType: string | null;
  amenities: string[];
  sort: string;
}

interface SearchFiltersState {
  filters: SearchFilters;
  hasActiveFilters: boolean;
}

const initialFilters: SearchFilters = {
  city: '',
  keyword: '',
  minPrice: null,
  maxPrice: null,
  minRating: null,
  roomType: null,
  amenities: [],
  sort: 'rating_desc',
};

const initialState: SearchFiltersState = {
  filters: initialFilters,
  hasActiveFilters: false,
};

const searchFiltersSlice = createSlice({
  name: 'searchFilters',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<SearchFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
      state.hasActiveFilters = Boolean(
        state.filters.city ||
        state.filters.keyword ||
        state.filters.minPrice !== null ||
        state.filters.maxPrice !== null ||
        state.filters.minRating !== null ||
        state.filters.roomType !== null ||
        state.filters.amenities.length > 0 ||
        state.filters.sort !== 'rating_desc'
      );
    },
    setCity(state, action: PayloadAction<string>) {
      state.filters.city = action.payload;
    },
    setSort(state, action: PayloadAction<string>) {
      state.filters.sort = action.payload;
    },
    resetFilters() {
      return initialState;
    },
  },
});

export const { setFilters, setCity, setSort, resetFilters } = searchFiltersSlice.actions;
export default searchFiltersSlice.reducer;
