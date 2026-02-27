/**
 * BaseRepository<T, K>
 *
 * Generic Repository interface following the arcana-cloud-springboot pattern.
 * Provides standard CRUD operations for all domain entities.
 *
 * T = Entity type
 * K = Primary key type (e.g. number, string)
 */
export interface BaseRepository<T, K> {
  /**
   * Persist a new entity.
   */
  save(data: unknown): Promise<T>;

  /**
   * Partially update an entity identified by its primary key.
   */
  update(id: K, data: Partial<T>): Promise<T>;

  /**
   * Find an entity by its primary key. Returns null when not found.
   */
  findById(id: K): Promise<T | null>;

  /**
   * Return all entities (no pagination). Use domain-specific paginated methods
   * when you need pagination.
   */
  findAll(): Promise<T[]>;

  /**
   * Count the total number of entities.
   */
  count(): Promise<number>;

  /**
   * Remove the entity identified by the given primary key.
   * Returns true on success, false when the entity did not exist.
   */
  deleteById(id: K): Promise<boolean>;

  /**
   * Return true when an entity with the given primary key exists.
   */
  existsById(id: K): Promise<boolean>;
}
