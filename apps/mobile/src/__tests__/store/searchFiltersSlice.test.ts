import searchFiltersReducer, { setFilters, setCity, setSort, resetFilters } from '../../store/searchFiltersSlice';

describe('searchFiltersSlice', () => {
  it('should return the initial state', () => {
    const state = searchFiltersReducer(undefined, { type: 'unknown' });
    expect(state.filters.city).toBe('');
    expect(state.filters.sort).toBe('rating_desc');
    expect(state.hasActiveFilters).toBe(false);
  });

  it('setFilters updates filters and sets hasActiveFilters', () => {
    const state = searchFiltersReducer(undefined, setFilters({ city: 'Addis Ababa' }));
    expect(state.filters.city).toBe('Addis Ababa');
    expect(state.hasActiveFilters).toBe(true);
  });

  it('setFilters with sort changes hasActiveFilters', () => {
    const state = searchFiltersReducer(undefined, setFilters({ sort: 'price_asc' }));
    expect(state.filters.sort).toBe('price_asc');
    expect(state.hasActiveFilters).toBe(true);
  });

  it('setFilters with minRating sets hasActiveFilters', () => {
    const state = searchFiltersReducer(undefined, setFilters({ minRating: 4 }));
    expect(state.filters.minRating).toBe(4);
    expect(state.hasActiveFilters).toBe(true);
  });

  it('setFilters with price range sets hasActiveFilters', () => {
    const state = searchFiltersReducer(undefined, setFilters({ minPrice: 100, maxPrice: 500 }));
    expect(state.filters.minPrice).toBe(100);
    expect(state.filters.maxPrice).toBe(500);
    expect(state.hasActiveFilters).toBe(true);
  });

  it('setFilters with amenities sets hasActiveFilters', () => {
    const state = searchFiltersReducer(undefined, setFilters({ amenities: ['wifi', 'pool'] }));
    expect(state.filters.amenities).toEqual(['wifi', 'pool']);
    expect(state.hasActiveFilters).toBe(true);
  });

  it('setCity updates city', () => {
    const state = searchFiltersReducer(undefined, setCity('Hawassa'));
    expect(state.filters.city).toBe('Hawassa');
  });

  it('setSort updates sort', () => {
    const state = searchFiltersReducer(undefined, setSort('price_desc'));
    expect(state.filters.sort).toBe('price_desc');
  });

  it('resetFilters returns to initial state', () => {
    const prev = searchFiltersReducer(undefined, setFilters({ city: 'Addis', sort: 'price_asc', minRating: 4 }));
    const state = searchFiltersReducer(prev, resetFilters());
    expect(state.filters.city).toBe('');
    expect(state.filters.sort).toBe('rating_desc');
    expect(state.hasActiveFilters).toBe(false);
  });
});
