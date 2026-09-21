DROP TABLE azimut.control_point;

ALTER TABLE azimut.plan_calibration
  DROP CONSTRAINT plan_calibration_residuals_ordered,
  DROP CONSTRAINT plan_calibration_affine_complete;

ALTER TABLE azimut.plan_calibration
  DROP COLUMN affine_a,
  DROP COLUMN affine_b,
  DROP COLUMN affine_c,
  DROP COLUMN affine_d,
  DROP COLUMN affine_e,
  DROP COLUMN affine_f,
  DROP COLUMN mean_residual_m,
  DROP COLUMN max_residual_m;
