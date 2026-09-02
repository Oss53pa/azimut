export type Point = {
  readonly x_m: number;
  readonly y_m: number;
};

export type Polygon = {
  readonly vertices: readonly Point[];
};
