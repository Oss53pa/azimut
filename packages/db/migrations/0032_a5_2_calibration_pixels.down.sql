ALTER TABLE azimut.plan_calibration
  DROP CONSTRAINT plan_calibration_origin_px_pair_check;
ALTER TABLE azimut.plan_calibration DROP COLUMN reference_distance_m;
ALTER TABLE azimut.plan_calibration DROP COLUMN origin_y_px;
ALTER TABLE azimut.plan_calibration DROP COLUMN origin_x_px;

ALTER TABLE azimut.plan_calibration ADD COLUMN origin_x numeric NOT NULL;
ALTER TABLE azimut.plan_calibration ADD COLUMN origin_y numeric NOT NULL;
